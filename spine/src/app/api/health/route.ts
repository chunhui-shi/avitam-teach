import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Liveness/readiness probe. A load balancer or orchestrator polls this to decide
// whether to send traffic to this instance. It checks the one dependency the app
// can't serve without — the database.
export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json({ status: 'ok', db: 'up' });
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503 });
  }
}
