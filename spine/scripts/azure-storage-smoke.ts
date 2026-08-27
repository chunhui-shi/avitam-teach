import { randomUUID } from 'crypto';
import { storage } from '../src/lib/storage';

async function main() {
  const key = `proof/azure-workload-identity-${randomUUID()}.txt`;
  const expected = Buffer.from('avitam-teach Azure workload identity proof');
  try {
    await storage.save(key, expected, 'text/plain');
    const actual = await storage.read(key);
    if (!actual.equals(expected)) throw new Error('Azure Blob round-trip content mismatch');
  } finally {
    await storage.remove(key);
  }
  console.log('Azure Blob workload-identity round trip passed');
}

main().catch(error => {
  console.error('[azure-storage-smoke] failed', error);
  process.exitCode = 1;
});
