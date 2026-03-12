import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@damac/shared', '@damac/core', '@damac/db'],
  serverExternalPackages: ['puppeteer', 'adm-zip', 'bcryptjs'],
};

export default nextConfig;
