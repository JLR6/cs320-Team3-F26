import type { NextConfig } from 'next';
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // necessary to redirect directly to feed instead of main page
  async redirects() {
    return [
      {
        source: '/',
        destination: '/feed',
        permanent: false, // Uses a 307 temporary redirect status code
      },
    ];
  },
};
export default config;
