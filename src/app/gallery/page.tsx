import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type GalleryEntry, galleryEntries } from '@/content/gallery';
import Link from 'next/link';

export const metadata = {
  title: 'Community Gallery — OpenDiscover BioLab',
  description:
    'A PR-contributed collection of interesting deterministic runs. Open any one in the Lab and remix it — full credit to its author.',
};

function Credit({ author, credit }: { author: string; credit: string }) {
  const isUrl = credit.startsWith('http://') || credit.startsWith('https://');
  return (
    <span className="text-xs text-muted-foreground">
      by{' '}
      {isUrl ? (
        <a
          href={credit}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {author}
        </a>
      ) : (
        <span className="text-foreground">
          {author} <span className="text-muted-foreground">({credit})</span>
        </span>
      )}
    </span>
  );
}

export default function GalleryPage() {
  const groups = new Map<string, GalleryEntry[]>();
  for (const entry of galleryEntries) {
    const list = groups.get(entry.engineTitle) ?? [];
    list.push(entry);
    groups.set(entry.engineTitle, list);
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Community gallery</h1>
        <p className="text-muted-foreground max-w-2xl">
          Interesting runs contributed by the community. Every card opens the exact experiment in
          the Lab — reproduce it, then tweak a parameter to make it your own. Want yours here?
          It&apos;s a{' '}
          <Link href="/lab" className="text-accent hover:underline">
            one-file pull request
          </Link>{' '}
          — see CONTRIBUTING.
        </p>
      </header>

      {galleryEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entries yet — be the first to contribute one.
        </p>
      ) : (
        [...groups.entries()].map(([engineTitle, entries]) => (
          <section key={engineTitle} className="space-y-4">
            <h2 className="text-lg font-semibold">{engineTitle}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <Card key={entry.slug} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="muted">{entry.engine}</Badge>
                      <Credit author={entry.author} credit={entry.credit} />
                    </div>
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <CardDescription>{entry.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="outline" className="w-full h-8 text-xs">
                      <Link href={entry.sharePath}>Open in Lab →</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
