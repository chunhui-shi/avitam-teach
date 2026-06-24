// Detect an image's true type from its leading bytes (magic numbers) rather
// than from the client-declared Content-Type. The avatar upload used to trust
// `file.type`, which the client sets freely — so a non-image, or a polyglot
// file, could be stored under an image extension. Reading the actual bytes
// closes that gap: the type the server records is the type the bytes are.

export type ImageType = 'png' | 'jpg' | 'gif' | 'webp';

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const b = bytes;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png';

  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';

  // GIF: "GIF8" (47 49 46 38)
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';

  // WEBP: "RIFF" .... "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';

  return null;
}
