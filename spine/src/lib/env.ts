// Startup environment validation.
//
// The app must refuse to start if a security-critical variable is missing, rather
// than fall back to an insecure default. This is called from instrumentation.ts,
// which Next.js runs once when the server boots.

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Missing optional vars disable a feature but are not fatal.
const OPTIONAL = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Refusing to start with insecure defaults — set them and restart.`
    );
  }

  for (const name of OPTIONAL) {
    if (!process.env[name]?.trim()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[env] optional variable ${name} is not set; the related feature is disabled.`
      );
    }
  }
}
