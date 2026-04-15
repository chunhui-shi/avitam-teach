// Global environment setup run before each test file.
// Keeps the test suite hermetic: no .env.local bleed-through, no real API keys.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://avitam:avitam@localhost:5432/avitam_teach_v1_test';

// Pin JWT secret for the whole suite so auth round-trips are deterministic.
// (Individual tests — e.g. env-fallback.test.ts — override this on purpose.)
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests-minimum-32-chars';

// Placeholder Stripe / Anthropic so module-load doesn't explode.
// The webhook + assistant tests mock the SDKs before importing the routes.
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
process.env.ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || 'sk-ant-placeholder';

// v2-deployed: src/lib/env.ts requires NEXT_PUBLIC_APP_URL as a valid URL.
// Provide a localhost placeholder so the env validation passes under test.
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Force a clean process exit once vitest's own event loop winds down. The
// src/lib/db.ts pool holds idle TCP connections that would otherwise keep the
// node event loop alive and stall the test runner. We can't safely `.end()`
// the pool from a per-file afterAll (later files still need it), so instead
// we schedule a best-effort exit via process.on('beforeExit').
process.once('beforeExit', () => {
  // Synchronous exit is the cheapest way to release sockets during teardown.
  // Vitest has already reported results by this point.
  setTimeout(() => process.exit(0), 50).unref();
});
