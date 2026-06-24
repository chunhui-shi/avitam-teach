// Next.js runs register() once when the server process starts. We use it to
// validate the environment up front, so a misconfigured deploy fails loudly at
// boot instead of silently serving requests with missing configuration.
export async function register() {
  const { validateEnv } = await import('@/lib/env');
  validateEnv();
}
