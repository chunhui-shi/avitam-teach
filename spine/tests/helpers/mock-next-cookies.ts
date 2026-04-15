import { vi } from 'vitest';

/**
 * next/headers `cookies()` reads from an async request context that only
 * exists inside a Next.js server runtime. Under vitest we don't have that
 * context, so we mock the module with an in-memory cookie store that tests
 * control directly.
 *
 * Usage (top of test file, BEFORE importing any route/lib that uses cookies):
 *
 *   import { installCookieMock, setCookie, clearCookies } from '../helpers/mock-next-cookies';
 *   installCookieMock();
 */

const store = new Map<string, string>();

export function installCookieMock() {
  vi.mock('next/headers', () => {
    return {
      cookies: async () => ({
        get: (name: string) => {
          const value = store.get(name);
          return value === undefined ? undefined : { name, value };
        },
        set: (nameOrOpts: string | { name: string; value: string }, value?: string) => {
          if (typeof nameOrOpts === 'string') {
            store.set(nameOrOpts, value ?? '');
          } else {
            store.set(nameOrOpts.name, nameOrOpts.value);
          }
        },
        delete: (name: string) => {
          store.delete(name);
        },
      }),
    };
  });
}

export function setCookie(name: string, value: string) {
  store.set(name, value);
}

export function clearCookies() {
  store.clear();
}
