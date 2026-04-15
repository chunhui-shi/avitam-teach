import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

// Sandboxed JavaScript execution using Node.js child_process
// Runs user code in a separate process with a timeout
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // v2-deployed: per-user rate limit (30 req/min), falls back to per-IP
    // bucket if session is somehow missing. See src/lib/rate-limit.ts.
    const identifier = session ? `user:${session.userId}` : getClientIp(req);
    const rl = checkRateLimit(RATE_LIMITS.execute, identifier);
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (code.length > 10000) {
      return NextResponse.json({ error: 'Code too long (max 10000 chars)' }, { status: 400 });
    }

    // Use Node.js vm module for sandboxed execution (server-side only)
    const { runInNewContext } = await import('vm');

    const logs: string[] = [];
    const errors: string[] = [];

    const sandbox = {
      console: {
        log: (...args: unknown[]) => {
          logs.push(args.map(a => {
            if (typeof a === 'object' && a !== null) {
              try { return JSON.stringify(a); } catch { return String(a); }
            }
            return String(a);
          }).join(' '));
        },
        error: (...args: unknown[]) => {
          errors.push(args.map(a => String(a)).join(' '));
        },
        warn: (...args: unknown[]) => {
          logs.push('[warn] ' + args.map(a => String(a)).join(' '));
        },
      },
    };

    let runtimeError: string | null = null;
    let result: unknown;

    try {
      result = runInNewContext(code, sandbox, { timeout: 3000 });
    } catch (err) {
      runtimeError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      output: logs,
      errors,
      runtimeError,
      result: result !== undefined ? String(result) : undefined,
    });
  } catch (err) {
    console.error('Execute error:', err);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
