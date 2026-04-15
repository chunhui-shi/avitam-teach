import { describe, it, expect } from 'vitest';
import { installCookieMock } from '../helpers/mock-next-cookies';

installCookieMock();

import { useTestDb } from '../helpers/db-setup';
import { makeRequest } from '../helpers/request';
import { createUser } from '../helpers/fixtures';

import { POST as loginPOST } from '@/app/api/auth/login/route';

useTestDb();

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets a session cookie', async () => {
    const user = await createUser({
      email: 'carol@example.com',
      password: 'password12345',
    });

    const res = await loginPOST(
      makeRequest({ body: { email: user.email, password: user.password } })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({ email: user.email });
    expect(res.headers.get('set-cookie') ?? '').toMatch(/avitam_session=/);
  });

  it('returns the same generic error for wrong password and non-existent user', async () => {
    await createUser({
      email: 'dave@example.com',
      password: 'password12345',
    });

    const wrongPw = await loginPOST(
      makeRequest({ body: { email: 'dave@example.com', password: 'nope12345' } })
    );
    const noUser = await loginPOST(
      makeRequest({ body: { email: 'ghost@example.com', password: 'nope12345' } })
    );

    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);

    const wrongBody = await wrongPw.json();
    const noBody = await noUser.json();
    // No user enumeration: same error string for both.
    expect(wrongBody.error).toBe(noBody.error);
  });

  it('rejects a request missing fields with 400', async () => {
    const res = await loginPOST(makeRequest({ body: { email: 'x@y.com' } }));
    expect(res.status).toBe(400);
  });
});
