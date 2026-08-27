import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

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

// v6 bonus proof: the Azure implementation keeps the container private. Public
// avatar reads pass through the bounded /api/assets/avatars route; course
// material is readable only by the ingestion worker through this interface.
class AzureBlobStorage implements BlobStorage {
  private container(): ContainerClient {
    const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
    const containerName = process.env.AZURE_STORAGE_CONTAINER;
    if (!accountUrl || !containerName) {
      throw new Error(
        'AZURE_STORAGE_ACCOUNT_URL and AZURE_STORAGE_CONTAINER are required for Azure Blob Storage'
      );
    }
    const service = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
    return service.getContainerClient(containerName);
  }

  async save(key: string, bytes: Buffer, contentType: string): Promise<string> {
    const blob = this.container().getBlockBlobClient(key);
    await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType } });
    return `/api/assets/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async read(key: string): Promise<Buffer> {
    return Buffer.from(await this.container().getBlockBlobClient(key).downloadToBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.container().deleteBlob(key, { deleteSnapshots: 'include' });
  }
}

// One line decides which implementation the whole app uses.
export const storage: BlobStorage =
  process.env.STORAGE_DRIVER === 'azure'
    ? new AzureBlobStorage()
    : new LocalDiskStorage();
