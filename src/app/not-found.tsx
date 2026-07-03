import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata = { title: 'Not found — OpenDiscover BioLab' };

export default function NotFound() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-accent">
        404 · no such run
      </div>
      <div
        className="font-mono text-7xl font-bold text-muted-foreground/40 select-none"
        aria-hidden
      >
        404
      </div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        This experiment doesn&apos;t exist
      </h1>
      <p className="max-w-md text-muted-foreground">
        The page or run you&apos;re after isn&apos;t here — a broken link, perhaps, or a share token
        that didn&apos;t decode. Everything in the lab is reproducible, so let&apos;s get you back
        to something that runs.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <Button asChild size="lg">
          <Link href="/lab">Open the Lab</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/aurora">▶ Play AURORA</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
