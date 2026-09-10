import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${(process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;
