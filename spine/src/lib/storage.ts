import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
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
  // Store bytes under an application-owned key and return a public URL when
  // the object is intended for public display (avatars use this today).
  save(key: string, bytes: Buffer, contentType: string): Promise<string>;
  // Private course material is read by the ingestion worker, never by a
  // browser URL. The new lifecycle is why v4's write-only seam had to evolve.
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalDiskStorage implements BlobStorage {
  private resolve(key: string): string {
    const root = path.resolve(process.cwd(), 'public', 'uploads');
    const full = path.resolve(root, key);
    if (!full.startsWith(`${root}${path.sep}`)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async save(key: string, bytes: Buffer): Promise<string> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return `/uploads/${key}`;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
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

  async read(): Promise<Buffer> {
    throw new Error('ObjectStorage is not configured in this build');
  }

  async remove(): Promise<void> {
    throw new Error('ObjectStorage is not configured in this build');
  }
}

// One line decides which implementation the whole app uses.
export const storage: BlobStorage =
  process.env.STORAGE_DRIVER === 'object'
    ? new ObjectStorage()
    : new LocalDiskStorage();
