import { describe, expect, it } from 'vitest';
import { validateMaterialBytes } from '@/lib/material-validation';

describe('course material validation', () => {
  it('accepts valid UTF-8 text and Markdown', () => {
    expect(validateMaterialBytes(Buffer.from('hello'), 'text/plain')).toBe('text/plain');
    expect(validateMaterialBytes(Buffer.from('# Lesson'), 'text/markdown')).toBe('text/markdown');
  });

  it('requires PDF magic bytes instead of trusting Content-Type', () => {
    expect(validateMaterialBytes(Buffer.from('not a pdf'), 'application/pdf')).toBeNull();
    expect(validateMaterialBytes(Buffer.from('%PDF-1.7\n'), 'application/pdf')).toBe('application/pdf');
  });

  it('rejects binary data presented as text', () => {
    expect(validateMaterialBytes(Buffer.from([0xff, 0xfe, 0x00]), 'text/plain')).toBeNull();
  });
});
