import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} from '@/lib/auth';

// NOTE: The v1 codebase exports signToken/verifyToken, not signJwt/verifyJwt.
// CLAUDE.md described them with the jwt-prefixed names; the real code uses the
// shorter names. The test suite matches the real code.

describe('auth helpers', () => {
  describe('hashPassword / verifyPassword', () => {
    it('round-trips a password through bcrypt', async () => {
      const hash = await hashPassword('correct horse battery staple');
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
      await expect(
        verifyPassword('correct horse battery staple', hash)
      ).resolves.toBe(true);
      await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
    });

    it('produces a different hash for the same input each call (salt works)', async () => {
      const a = await hashPassword('same-password');
      const b = await hashPassword('same-password');
      expect(a).not.toBe(b);
      // Both still verify.
      await expect(verifyPassword('same-password', a)).resolves.toBe(true);
      await expect(verifyPassword('same-password', b)).resolves.toBe(true);
    });
  });

  describe('signToken / verifyToken', () => {
    it('round-trips a { userId, email } payload', () => {
      const token = signToken({ userId: 42, email: 'alice@example.com' });
      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(42);
      expect(decoded!.email).toBe('alice@example.com');
    });

    it('returns null for a tampered token', () => {
      const token = signToken({ userId: 1, email: 'a@b.com' });
      // Flip a character in the signature segment.
      const parts = token.split('.');
      parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A');
      const tampered = parts.join('.');
      expect(verifyToken(tampered)).toBeNull();
    });

    it('returns null for an expired token', () => {
      const secret = process.env.JWT_SECRET!;
      // Sign directly with jsonwebtoken so we can set an exp in the past.
      const expired = jwt.sign(
        { userId: 1, email: 'a@b.com' },
        secret,
        { expiresIn: '-1s' }
      );
      expect(verifyToken(expired)).toBeNull();
    });
  });
});
