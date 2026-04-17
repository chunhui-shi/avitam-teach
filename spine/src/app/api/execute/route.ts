import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runUntrustedCode } from '@/lib/code-runner';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

// v3-secured: user-supplied JavaScript is executed in a SEPARATE OS process
// with an empty environment. See src/lib/code-runner.ts for the full
// security rationale. The teaching point for Chapter 7: some security
// problems cannot be fixed at the function level — they require an
// architectural change to the trust boundary.
export async function POST(req: NextRequest) {
  try {
    // 1. Session check.
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

    // 2. Input validation.
    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (code.length > 10000) {
      return NextResponse.json(
        { error: 'Code too long (max 10000 chars)' },
        { status: 400 }
      );
    }

    // 3. Business logic. Execute out-of-process.
    const result = await runUntrustedCode(code);

    // 4. Response. Shape is preserved from v0/v1/v2 so the CodeEditor UI
    // and the execute-auth test keep working without change.
    return NextResponse.json(result);
  } catch (err) {
    console.error('Execute error:', err);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
