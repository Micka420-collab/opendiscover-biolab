import { listEngines } from '@/lib/sim';
import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://opendiscover-biolab.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/lab',
    '/lab/breeding',
    '/challenge',
    '/gallery',
    '/tv',
    '/discoveries',
    '/about',
  ];
  const enginePaths = listEngines().map((e) => `/lab/${e.slug}`);
  return [...staticPaths, ...enginePaths].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
