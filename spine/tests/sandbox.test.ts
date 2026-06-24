import { describe, it, expect } from 'vitest';
import { runUntrustedCode } from '@/lib/code-runner';

// These exercise the real out-of-process runner (each spawns a Node child).
describe('runUntrustedCode (out-of-process sandbox)', () => {
  it('runs ordinary code and captures console output', async () => {
    const r = await runUntrustedCode('console.log("hello", 1 + 1)');
    expect(r.output).toContain('hello 2');
    expect(r.runtimeError).toBeNull();
  });

  it('a prototype-chain escape finds no secrets in the child env', async () => {
    // The classic vm escape: reach the host realm via the constructor chain.
    // It still "works" — but the child process has env: {}, so there is no
    // JWT_SECRET (or any secret) to read. The boundary is the process, not the vm.
    const r = await runUntrustedCode(
      `const f = this.constructor.constructor('return process.env.JWT_SECRET'); ` +
        `console.log(f() === undefined ? 'NO_SECRET' : 'LEAKED')`
    );
    expect(r.output).toContain('NO_SECRET');
    expect(r.output).not.toContain('LEAKED');
  });

  it('stops code that runs too long', async () => {
    const r = await runUntrustedCode('while (true) {}');
    expect(r.runtimeError).toMatch(/timed out/i);
  }, 8000);
});
