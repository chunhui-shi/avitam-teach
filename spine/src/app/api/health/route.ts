import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

/**
 * Liveness probe for load balancers and container orchestrators.
 *
 * Returns 200 + a small JSON payload unconditionally. No auth, no DB check —
 * "can the Node process respond to an HTTP request?" is the only question
 * this endpoint answers. A readiness probe (DB reachable, migrations run)
 * would be a separate endpoint; we do not ship one in v2-deployed.
 *
 * Added in v2-deployed as part of Chapter 7 delivery discipline.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: (pkg as { version: string }).version,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
