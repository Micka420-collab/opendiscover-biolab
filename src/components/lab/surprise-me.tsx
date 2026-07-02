'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

/**
 * "Surprise me" — jump to a random engine's playground. A low-friction discovery
 * mechanic: click and land somewhere you might not have picked yourself. (UI
 * randomness only; the engines themselves stay fully deterministic.)
 */
export function SurpriseMe({ slugs }: { slugs: string[] }) {
  const router = useRouter();
  function go() {
    if (slugs.length === 0) return;
    const slug = slugs[Math.floor(Math.random() * slugs.length)];
    router.push(`/lab/${slug}`);
  }
  return (
    <Button variant="outline" onClick={go}>
      🎲 Surprise me
    </Button>
  );
}
