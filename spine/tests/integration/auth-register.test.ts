import { describe, it, expect } from 'vitest';
import { installCookieMock, clearCookies } from '../helpers/mock-next-cookies';

installCookieMock();

import { useTestDb } from '../helpers/db-setup';
import { getTestDb } from '../helpers/test-db';
import { makeRequest } from '../helpers/request';

// Import under test — must come AFTER installCookieMock() so the module
// picks up the mocked next/headers.
import { POST as registerPOST } from '@/app/api/auth/register/route';

useTestDb();

describe('POST /api/auth/register', () => {
  it('creates a user on valid payload and returns a session cookie', async () => {
    clearCookies();
    const res = await registerPOST(
      makeRequest({
        body: {
          name: 'Alice',
          email: 'alice@example.com',
          password: 'password12345',
        },
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });

    // Session cookie should be set on the response.
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/avitam_session=/);

    // And the user should exist in the DB.
    const db = await getTestDb();
    const { rows } = await db.query('SELECT id, email FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('alice@example.com');
  });

  it('rejects passwords shorter than 8 characters with 400', async () => {
    const res = await registerPOST(
      makeRequest({
        body: { name: 'Bob', email: 'bob@example.com', password: 'short' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409', async () => {
    // Seed the first user.
    await registerPOST(
      makeRequest({
        body: {
          name: 'Alice',
          email: 'dupe@example.com',
          password: 'password12345',
        },
      })
    );
    const res = await registerPOST(
      makeRequest({
        body: {
          name: 'Alice2',
          email: 'dupe@example.com',
          password: 'password12345',
        },
      })
    );
    expect(res.status).toBe(409);
  });

  it('rejects a request missing required fields with 400', async () => {
    const res = await registerPOST(
      makeRequest({ body: { email: 'nofields@example.com' } })
    );
    expect(res.status).toBe(400);
  });
});
