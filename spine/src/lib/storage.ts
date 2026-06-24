import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// v4-designed: a storage abstraction.
//
// The avatar route used to call writeFile() directly, which pinned uploads to
// the local filesystem — ephemeral inside a container and not shared across
// instances (the hazard surfaced in Chapter 5). The fix is a design move, not a
// patch: put the decision behind an interface so swapping to object storage is a
// change of *implementation*, not a rewrite of the route. Isolate the decision
// you expect to revisit; the caller shouldn't know or care where bytes land.

export interface BlobStorage {
  // Store bytes under a key and return a URL that fetches them back.
  save(key: string, bytes: Buffer, contentType: string): Promise<string>;
}

class LocalDiskStorage implements BlobStorage {
  async save(key: string, bytes: Buffer): Promise<string> {
    const full = path.join(process.cwd(), 'public', 'uploads', key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return `/uploads/${key}`;
  }
}

// The production implementation we'd swap in. Left unimplemented on purpose: the
// point of the abstraction is that the avatar route does not change when this
// does. A real version PUTs to an S3-compatible bucket and returns the CDN URL:
//
//   await s3.putObject({ Bucket, Key: key, Body: bytes, ContentType });
//   return `${process.env.CDN_BASE}/${key}`;
class ObjectStorage implements BlobStorage {
  async save(): Promise<string> {
    throw new Error('ObjectStorage is not configured in this build');
  }
}

// One line decides which implementation the whole app uses.
export const storage: BlobStorage =
  process.env.STORAGE_DRIVER === 'object'
    ? new ObjectStorage()
    : new LocalDiskStorage();
