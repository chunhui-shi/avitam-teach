/** @type {import('next').NextConfig} */
const nextConfig = {
  // v2-deployed: standalone output lets the Docker `runner` stage copy a
  // minimal self-contained bundle (server.js + required node_modules) instead
  // of the whole repo. See Dockerfile and docker-compose.yml.
  output: 'standalone',
};

export default nextConfig;
