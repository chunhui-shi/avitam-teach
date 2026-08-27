import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateEnv } from '@/lib/env';

describe('startup environment validation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('requires the Azure account URL and container for Azure storage', () => {
    vi.stubEnv('STORAGE_DRIVER', 'azure');
    vi.stubEnv('AZURE_STORAGE_ACCOUNT_URL', '');
    vi.stubEnv('AZURE_STORAGE_CONTAINER', '');

    expect(() => validateEnv()).toThrow(/AZURE_STORAGE_ACCOUNT_URL, AZURE_STORAGE_CONTAINER/);
  });

  it('accepts a complete Azure storage configuration', () => {
    vi.stubEnv('STORAGE_DRIVER', 'azure');
    vi.stubEnv('AZURE_STORAGE_ACCOUNT_URL', 'https://proof.blob.core.windows.net');
    vi.stubEnv('AZURE_STORAGE_CONTAINER', 'uploads');

    expect(() => validateEnv()).not.toThrow();
  });

  it('does not require Azure variables for local disk storage', () => {
    vi.stubEnv('STORAGE_DRIVER', 'local');
    vi.stubEnv('AZURE_STORAGE_ACCOUNT_URL', '');
    vi.stubEnv('AZURE_STORAGE_CONTAINER', '');

    expect(() => validateEnv()).not.toThrow();
  });
});
