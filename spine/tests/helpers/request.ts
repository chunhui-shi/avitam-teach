import { NextRequest } from 'next/server';

interface MakeRequestOpts {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Build a NextRequest that route handlers can read. `body` is serialized to
 * JSON and the content-type header is set accordingly unless the caller
 * provides a raw `text` body in opts.headers (used by the Stripe webhook test).
 */
export function makeRequest(opts: MakeRequestOpts = {}): NextRequest {
  const method = opts.method ?? 'POST';
  const url = opts.url ?? 'http://localhost:3000/';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...opts.headers,
  };

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  return new NextRequest(url, {
    method,
    headers,
    body,
  });
}
