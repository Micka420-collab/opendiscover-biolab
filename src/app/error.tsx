'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary. Renders a branded fallback for any uncaught error in a page
 * (below the root layout), with a `reset()` retry and a way home. Errors are logged to the
 * console for debugging; nothing is sent anywhere.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-red-400">
        Something broke
      </div>
      <div className="text-6xl select-none" aria-hidden>
        ⚠️
      </div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">This page hit an error</h1>
      <p className="max-w-md text-muted-foreground">
        A transient error stopped this page from rendering. Trying again usually clears it — if it
        keeps happening, the problem is on our side.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">reference: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
