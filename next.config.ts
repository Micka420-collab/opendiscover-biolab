import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  // The community gallery reads its entries from src/content/gallery/*.json at
  // runtime via node:fs (see src/content/gallery/index.ts). Next.js does not
  // trace raw fs reads, so those source JSON files are NOT bundled into the
  // serverless function by default — on Vercel the read then throws ENOENT and
  // the page 500s (it works locally only because the repo is on disk). Explicitly
  // include them in every route that loads the gallery module.
  outputFileTracingIncludes: {
    '/gallery': ['./src/content/gallery/**/*.json'],
    '/tv': ['./src/content/gallery/**/*.json'],
  },
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...(config.resolve?.fallback ?? {}),
        canvas: false,
      },
    };
    return config;
  },
};

export default nextConfig;
