import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
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
