import { NextResponse, NextRequest } from 'next/server';

// Structured access log + a request id on every API call. The request id is
// echoed back in a header so a user-reported error can be traced to its log line.
export function middleware(req: NextRequest) {
  const requestId = crypto.randomUUID();

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      message: 'request',
      method: req.method,
      path: req.nextUrl.pathname,
      requestId,
    })
  );

  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);
  return res;
}

export const config = { matcher: '/api/:path*' };
