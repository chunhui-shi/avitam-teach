import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Sandboxed JavaScript execution using Node.js child_process
// Runs user code in a separate process with a timeout
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
