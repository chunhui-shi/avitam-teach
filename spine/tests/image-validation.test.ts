import { describe, it, expect } from 'vitest';
import { sniffImageType } from '@/lib/image-validation';

describe('sniffImageType (magic-byte validation, not client Content-Type)', () => {
  it('recognizes a PNG by its leading bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffImageType(png)).toBe('png');
  });

  it('recognizes a JPEG', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
  });

  it('rejects a file that is not an image, whatever it claims to be', () => {
    // A request could send this with Content-Type: image/png. The bytes decide.
    const notAnImage = Buffer.from('<script>alert(1)</script>', 'utf8');
    expect(sniffImageType(notAnImage)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffImageType(Buffer.from([]))).toBeNull();
  });
});
