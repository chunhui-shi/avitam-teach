import { describe, it, expect } from 'vitest';
import { redactSecrets } from '@/lib/redact';

describe('redactSecrets (output filter, Layer 4)', () => {
  it('redacts an Anthropic API key', () => {
    const out = redactSecrets('the key is sk-ant-api03-AbCdEf123456_xyz and that is all');
    expect(out).not.toContain('sk-ant-api03');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Stripe secret and webhook keys', () => {
    expect(redactSecrets('sk_live_AbCdEf12345678')).toBe('[REDACTED]');
    expect(redactSecrets('sk_test_AbCdEf12345678')).toBe('[REDACTED]');
    expect(redactSecrets('whsec_AbCdEf12345678')).toBe('[REDACTED]');
  });

  it('redacts a JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.abc123_DEF-456xyzAAA';
    expect(redactSecrets(`token: ${jwt}`)).not.toContain('eyJhbGci');
  });

  it('redacts a database URL with an inline password', () => {
    const out = redactSecrets('connect to postgres://app:hunter2@db.internal:5432/prod');
    expect(out).not.toContain('hunter2');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts the value of a secret-shaped env assignment but keeps the name', () => {
    const out = redactSecrets('JWT_SECRET=supersecretvalue123');
    expect(out).toContain('JWT_SECRET');
    expect(out).not.toContain('supersecretvalue123');
    expect(out).toContain('[REDACTED]');
  });

  it('leaves ordinary teaching text untouched', () => {
    const text =
      'A closure is a function bundled with its lexical scope. ' +
      'Try returning a function from another function to see it.';
    expect(redactSecrets(text)).toBe(text);
  });
});
