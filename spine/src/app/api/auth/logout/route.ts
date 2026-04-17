import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear both cookie-name variants so a session survives a NODE_ENV change
  // across deploys (e.g. running prod locally with NODE_ENV toggled) with
  // no stale cookie stuck in the browser.
  for (const name of ['avitam_session', '__Host-avitam_session']) {
    response.cookies.set({
      name,
      value: '',
      maxAge: 0,
      path: '/',
    });
  }
  return response;
}
