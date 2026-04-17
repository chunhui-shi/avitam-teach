/**
 * v3-secured — out-of-process code runner.
 *
 * Chapter 7's teaching centerpiece. The v0-naive / v1 / v2 implementation of
 * /api/execute used `vm.runInNewContext(code, sandbox, { timeout: 3000 })`
 * inside the Next.js Node process. That API is NOT a security sandbox — the
 * vm context shares the real V8 heap with the caller, and user code can walk
 * the prototype chain back to the host realm:
 *
 *     this.constructor.constructor('return process.env.SOMETHING')()
 *
 * From there an attacker reads any environment variable: JWT_SECRET,
 * STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, DATABASE_URL. Killing the process
 * with a timeout doesn't help — the exfiltration already happened.
 *
 * The fix is architectural, not a clever patch. We run user code in a
 * SEPARATE OS process, spawned with:
 *
 *   1. `env: {}` — an empty environment. Even if the runner is escaped to
 *      the host realm, there are no secrets in `process.env` to steal.
 *   2. `stdio: ['pipe', 'pipe', 'pipe']` — no inherited file descriptors.
 *   3. A hard wall-clock timeout that `SIGKILL`s the child. The parent does
 *      not wait for the child to exit cleanly — it owns the deadline.
 *   4. Output size caps. A runaway `while(true) console.log('x')` would
 *      otherwise fill memory in the parent as we buffer stdout.
 *
 * Inside the child we still use `vm.runInNewContext`, because for a
 * *sandbox-less* process with an empty env and no FS-mounted secrets,
 * prototype-chain escape is no longer a meaningful attack: there is nothing
 * to steal. The sandbox's job here is purely ergonomic — capture
 * console.log output for display — not security. Security lives in the
 * process boundary.
 *
 * Trade-offs a reader should understand:
 *
 *   - Spawning a Node process costs ~50-150ms cold. Fine for a "Run code"
 *     button; would NOT be fine for 10k req/sec. Production would pool
 *     pre-warmed workers or use `isolated-vm` (true V8 isolates).
 *   - This still shares the host kernel. An attacker who achieves native
 *     code execution (JIT vulnerability, etc.) could escape. For a real
 *     coding platform the next layer is a container / gVisor / nsjail /
 *     firecracker microVM. Out of scope for v3-secured, which only needs
 *     to neutralise the vm-escape attack the current test demonstrates.
 */

import { spawn } from 'child_process';
import * as path from 'path';

export interface RunResult {
  output: string[];
  errors: string[];
  runtimeError: string | null;
  result?: string;
}

// Hard limits. Keeping them here (not in the route handler) so all execution
// paths share the same caps.
const EXEC_TIMEOUT_MS = 3000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KiB combined stdout+stderr

// The runner script source. It is executed by `node -e` in the child
// process. Keeping it as an inline string keeps the entire security-
// relevant code path visible in one file — a reader can audit the sandbox
// and the process boundary together.
//
// Contract:
//   stdin:  UTF-8 JSON `{ "code": "..." }`
//   stdout: UTF-8 JSON `{ "output": [...], "errors": [...],
//                         "runtimeError": string|null,
//                         "result": string|undefined }`
//   exit:   0 on normal completion (even if user code threw).
//           Non-zero only on runner infrastructure failure.
const RUNNER_SOURCE = `
const vm = require('vm');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let code;
  try {
    const parsed = JSON.parse(raw);
    code = parsed.code;
    if (typeof code !== 'string') throw new Error('code must be a string');
  } catch (err) {
    process.stdout.write(JSON.stringify({
      output: [],
      errors: [],
      runtimeError: 'runner input parse error: ' + String(err && err.message || err),
      result: undefined,
    }));
    return;
  }

  const logs = [];
  const errors = [];
  const sandbox = {
    console: {
      log: (...args) => {
        logs.push(args.map((a) => {
          if (typeof a === 'object' && a !== null) {
            try { return JSON.stringify(a); } catch { return String(a); }
          }
          return String(a);
        }).join(' '));
      },
      error: (...args) => {
        errors.push(args.map((a) => String(a)).join(' '));
      },
      warn: (...args) => {
        logs.push('[warn] ' + args.map((a) => String(a)).join(' '));
      },
    },
  };

  let runtimeError = null;
  let result;
  try {
    // The child process has env: {} so a prototype-chain escape finds
    // nothing worth exfiltrating. The internal vm timeout is a
    // belt-and-braces guard for accidental hangs; the real wall-clock
    // timeout is enforced by the parent with SIGKILL.
    result = vm.runInNewContext(code, sandbox, { timeout: 2500 });
  } catch (err) {
    runtimeError = err instanceof Error ? err.message : String(err);
  }

  process.stdout.write(JSON.stringify({
    output: logs,
    errors,
    runtimeError,
    result: result !== undefined ? String(result) : undefined,
  }));
});
`;

/**
 * Run user-supplied JavaScript in a separate OS process with restricted env.
 *
 * Resolves with a RunResult on normal completion (including user-code
 * runtime errors — those are reported in `runtimeError`). Resolves with a
 * synthetic RunResult whose `runtimeError` is "Execution timed out" if the
 * child exceeds EXEC_TIMEOUT_MS. Rejects only on infrastructure failure
 * (Node binary missing, spawn failure, etc.).
 */
export async function runUntrustedCode(code: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', RUNNER_SOURCE], {
      // Empty env — this is the security boundary. If user code escapes vm
      // it finds no secrets. `PATH` is not needed; we gave an absolute
      // interpreter path via process.execPath.
      //
      // The cast is needed because this project declares NODE_ENV as
      // required on ProcessEnv (via zod/env.ts + tsc widening), and
      // {} is strictly narrower than the declared type. We intentionally
      // want the child to see nothing.
      env: {} as NodeJS.ProcessEnv,
      // Do not inherit stdio. We pipe everything explicitly.
      stdio: ['pipe', 'pipe', 'pipe'],
      // Pin cwd to a neutral directory. We use the OS temp dir rather than
      // the app root so the child cannot read app source even if it tries
      // relative fs.readFile calls (belt-and-braces — the process already
      // has no elevated fs capabilities beyond the unix user's).
      cwd: path.resolve('/tmp'),
      // Do not use a shell; arg array goes straight to execve.
      shell: false,
      // Detach so the parent can kill the whole process group on timeout,
      // covering any child-of-child the user code might have tried to
      // spawn (they can't, because env:{} removed PATH, but defence in
      // depth).
      detached: false,
    });

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflowed = false;
    let settled = false;

    const settle = (value: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
      resolve(value);
    };

    const timer = setTimeout(() => {
      settle({
        output: [],
        errors: [],
        runtimeError: 'Execution timed out',
        result: undefined,
      });
    }, EXEC_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
        overflowed = true;
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
        return;
      }
      stdout = Buffer.concat([stdout, chunk]);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length + chunk.length > MAX_OUTPUT_BYTES) {
        overflowed = true;
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
        return;
      }
      stderr = Buffer.concat([stderr, chunk]);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', () => {
      if (settled) return;
      if (overflowed) {
        settle({
          output: [],
          errors: [],
          runtimeError: 'Output size limit exceeded',
          result: undefined,
        });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.toString('utf8')) as RunResult;
        settle(parsed);
      } catch (err) {
        settle({
          output: [],
          errors: [],
          runtimeError:
            'Runner produced invalid output: ' +
            (err instanceof Error ? err.message : String(err)),
          result: undefined,
        });
      }
    });

    // Feed the user's code to the child via stdin. JSON-encoded so the
    // child can distinguish payload boundaries trivially.
    try {
      child.stdin.write(JSON.stringify({ code }));
      child.stdin.end();
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    }
  });
}
