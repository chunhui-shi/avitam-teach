/**
 * v3-secured — out-of-process code runner.
 *
 * Chapter 6's security centerpiece. The v0 / v1 / v2 implementation of
 * /api/execute ran `vm.runInNewContext(code, sandbox, { timeout: 3000 })`
 * inside the Next.js server process — and a comment there claimed it was a
 * "separate process." It was not. Node's `vm` is NOT a security sandbox: the
 * vm context shares the real V8 heap with the caller, and user code can walk
 * the prototype chain back to the host realm:
 *
 *     this.constructor.constructor('return process.env.SOMETHING')()
 *
 * From there an attacker reads any environment variable in the server
 * process: JWT_SECRET, STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, DATABASE_URL.
 * A timeout doesn't help — the exfiltration already happened.
 *
 * The fix is architectural, not a clever patch — and that is the teaching
 * point: some security problems can't be closed at the function level; they
 * need a change to the trust boundary. We run user code in a SEPARATE OS
 * process, spawned with:
 *
 *   1. `env: {}` — an empty environment. Even if the runner is escaped to
 *      the host realm, there are no secrets in `process.env` to steal.
 *   2. `stdio: ['pipe', 'pipe', 'pipe']` — no inherited file descriptors.
 *   3. A hard wall-clock timeout that `SIGKILL`s the child. The parent owns
 *      the deadline; it does not wait for the child to exit cleanly.
 *   4. Output size caps, so a runaway `while(true) console.log('x')` can't
 *      fill the parent's memory as we buffer stdout.
 *
 * Inside the child we still use `vm.runInNewContext`, but only to capture
 * console output for display — not for security. For a process with an empty
 * env and no mounted secrets, prototype-chain escape finds nothing worth
 * stealing. Security lives in the process boundary, not the vm.
 *
 * Trade-offs a reader should understand:
 *
 *   - Spawning a Node process costs ~50–150ms cold. Fine for a "Run code"
 *     button; not fine for 10k req/sec. Production would pool pre-warmed
 *     workers or use `isolated-vm` (true V8 isolates).
 *   - This still shares the host kernel. An attacker who achieves native
 *     code execution could escape. The next layer for a real platform is a
 *     container / gVisor / nsjail / Firecracker microVM — out of scope here,
 *     where the job is to neutralize the vm-escape the test demonstrates.
 */

import { spawn } from 'child_process';
import * as path from 'path';

export interface RunResult {
  output: string[];
  errors: string[];
  runtimeError: string | null;
  result?: string;
}

// Hard limits, kept here so every execution path shares the same caps.
const EXEC_TIMEOUT_MS = 3000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KiB combined stdout+stderr

// The runner script, executed by `node -e` in the child. Keeping it inline
// keeps the whole security-relevant path auditable in one file.
//
// Contract:
//   stdin:  UTF-8 JSON `{ "code": "..." }`
//   stdout: UTF-8 JSON RunResult
//   exit:   0 on normal completion (even if user code threw).
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
      output: [], errors: [],
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
      error: (...args) => { errors.push(args.map((a) => String(a)).join(' ')); },
      warn: (...args) => { logs.push('[warn] ' + args.map((a) => String(a)).join(' ')); },
    },
  };

  let runtimeError = null;
  let result;
  try {
    // env is {} so a prototype-chain escape finds nothing to exfiltrate.
    // This internal timeout is a belt-and-braces guard; the real deadline
    // is the parent's SIGKILL.
    result = vm.runInNewContext(code, sandbox, { timeout: 2500 });
  } catch (err) {
    runtimeError = err instanceof Error ? err.message : String(err);
  }

  process.stdout.write(JSON.stringify({
    output: logs, errors, runtimeError,
    result: result !== undefined ? String(result) : undefined,
  }));
});
`;

/**
 * Run user-supplied JavaScript in a separate OS process with an empty env.
 * Resolves with a RunResult on normal completion (user runtime errors are
 * reported in `runtimeError`), or a synthetic timeout/overflow result.
 * Rejects only on infrastructure failure (spawn failure, etc.).
 */
export async function runUntrustedCode(code: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', RUNNER_SOURCE], {
      // Empty env IS the security boundary: an escape finds no secrets.
      env: {} as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Neutral cwd so relative fs reads can't reach app source.
      cwd: path.resolve('/tmp'),
      shell: false,
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
      settle({ output: [], errors: [], runtimeError: 'Execution timed out', result: undefined });
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
        settle({ output: [], errors: [], runtimeError: 'Output size limit exceeded', result: undefined });
        return;
      }
      try {
        settle(JSON.parse(stdout.toString('utf8')) as RunResult);
      } catch (err) {
        settle({
          output: [], errors: [],
          runtimeError: 'Runner produced invalid output: ' + (err instanceof Error ? err.message : String(err)),
          result: undefined,
        });
      }
    });

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
