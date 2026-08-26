import { processNextIngestionJob } from '../src/lib/ingestion';
import pool from '../src/lib/db';

const idleMs = Number(process.env.WORKER_IDLE_MS || 2000);
let stopping = false;

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

async function main() {
  while (!stopping) {
    const processed = await processNextIngestionJob();
    if (!processed) await new Promise(resolve => setTimeout(resolve, idleMs));
  }
  await pool.end();
}

main().catch(err => {
  console.error('[knowledge-worker] fatal error', err);
  process.exitCode = 1;
});
