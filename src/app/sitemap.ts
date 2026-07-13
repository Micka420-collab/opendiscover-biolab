import { listEngines } from '@/lib/sim';
import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://opendiscover-biolab.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/lab',
    '/lab/breeding',
    '/aurora',
    '/cross',
    '/challenge',
    '/gallery',
    '/tv',
    '/discoveries',
    '/about',
  ];
  const enginePaths = listEngines().map((e) => `/lab/${e.slug}`);
  // De-dupe: '/lab/breeding' appears both as a static path and as an engine slug.
  const paths = [...new Set([...staticPaths, ...enginePaths])];
  return paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
