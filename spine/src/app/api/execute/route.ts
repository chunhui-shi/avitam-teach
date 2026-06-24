import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rateLimited } from '@/lib/rate-limit';
import { runUntrustedCode } from '@/lib/code-runner';

// v3-secured: user code runs in a SEPARATE OS process with an empty environment
// (see src/lib/code-runner.ts). The previous version ran it via vm.runInNewContext
// inside this server process and a comment claimed it was a "separate process" — it
// wasn't, and a prototype-chain escape could read JWT_SECRET, DATABASE_URL, and the
// Stripe/Anthropic keys straight out of process.env. The fix is the process boundary.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // The runner spawns a process on every call; cap how fast one user can hammer it.
    const limited = rateLimited(`execute:${session.userId}`, 60, 60_000);
    if (limited) return limited;

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    if (code.length > 10000) {
      return NextResponse.json({ error: 'Code too long (max 10000 chars)' }, { status: 400 });
    }

    const result = await runUntrustedCode(code);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Execute error:', err);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
