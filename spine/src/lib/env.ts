import { z } from 'zod';

/**
 * Startup environment validation.
 *
 * This module is the single source of truth for every process.env variable
 * the app reads. On first import it parses the environment against the
 * schema below. If the environment is invalid, any subsequent read of the
 * exported `env` object (e.g. `env.JWT_SECRET`) throws a loud, human-
 * readable error listing every missing or malformed variable.
 *
 * This is the v2-deployed fix for Known Issue #1 — it replaces the hardcoded
 * `|| 'fallback-secret-...'` string literal in src/lib/auth.ts with a
 * fail-fast check. In production the first access happens at server boot
 * (auth.ts → env.JWT_SECRET on the first signToken call), which is what
 * the docker-compose healthcheck and CI smoke test catch.
 *
 * Implementation note: validation happens eagerly on module import, but the
 * error is deferred to the first property access on `env`. This keeps the
 * unit test `tests/unit/env-fallback.test.ts` — which imports auth.ts with
 * JWT_SECRET unset and then calls signToken() — able to catch the error at
 * the signToken() call site rather than at import time.
 */

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (postgresql:// connection string)'),
  JWT_SECRET: z
    .string()
    .min(
      32,
      'JWT_SECRET is required and must be at least 32 characters (generate with: openssl rand -hex 32)'
    ),
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY is required (sk_test_... or sk_live_...)'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required (whsec_...)'),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)'),
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, 'ANTHROPIC_API_KEY is required (sk-ant-...)'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

type ParseResult =
  | { ok: true; data: Env }
  | { ok: false; error: Error };

function parseEnv(): ParseResult {
  const parsed = EnvSchema.safeParse(process.env);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  // Rewrite each issue so the message explicitly says "<NAME> is required"
  // when the underlying env var is unset. That phrasing is what operators
  // grep for and is what the env-fallback test in
  // tests/unit/env-fallback.test.ts matches.
  const issues = parsed.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    const rawValue = name ? (process.env as Record<string, string | undefined>)[name] : undefined;
    if (rawValue === undefined) {
      return `  - ${name} is required (environment variable is unset): ${issue.message}`;
    }
    return `  - ${name} is invalid: ${issue.message}`;
  });

  const message =
    'Environment validation failed. The following environment variables are ' +
    'missing or invalid:\n' +
    issues.join('\n') +
    '\n\nSet them in .env.local (development) or the runtime environment ' +
    '(Docker / CI / staging / production). See .env.example and ' +
    '.env.docker.example for the full list.';

  return { ok: false, error: new Error(message) };
}

// Parse eagerly at module import — the result (ok or error) is captured here.
const result = parseEnv();

/**
 * Typed env proxy. Accessing any property on this object throws the parse
 * error if validation failed. If validation succeeded it returns the typed
 * value directly.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    // Silently return undefined for symbol lookups (e.g. Symbol.toStringTag,
    // Symbol.iterator) so util.inspect / console.log don't accidentally
    // trigger the validation error.
    if (typeof prop === 'symbol') {
      return undefined;
    }
    if (!result.ok) {
      throw result.error;
    }
    return (result.data as Record<string, unknown>)[prop];
  },
}) as Env;
