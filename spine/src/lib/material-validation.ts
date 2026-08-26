export const materialContentTypes = [
  'text/plain',
  'text/markdown',
  'application/pdf',
] as const;

export type MaterialContentType = typeof materialContentTypes[number];

export function validateMaterialBytes(
  bytes: Buffer,
  declaredType: string
): MaterialContentType | null {
  if (declaredType === 'application/pdf') {
    return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-'
      ? 'application/pdf'
      : null;
  }
  if (declaredType !== 'text/plain' && declaredType !== 'text/markdown') return null;
  if (bytes.includes(0)) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return declaredType;
  } catch {
    return null;
  }
}
