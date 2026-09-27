import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // libsql native bindings: keep route handlers on Node runtime (set per-route).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
