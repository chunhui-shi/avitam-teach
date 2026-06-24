/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  // Run src/instrumentation.ts register() at server startup (env validation).
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
