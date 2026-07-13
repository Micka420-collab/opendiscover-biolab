import './globals.css';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NavAuth } from '@/components/layout/nav-auth';
import type { Dictionary } from '@/i18n/dictionary';
import { getLocale, getMessages } from '@/i18n/server';
import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://opendiscover-biolab.vercel.app';
const repoUrl = 'https://github.com/Micka420-collab/opendiscover-biolab';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'OpenDiscover BioLab — deterministic in-silico biology lab you can play',
  description:
    'An open-source virtual biotechnology lab you run in the browser — no account, no database. 80 deterministic simulation engines where every run reproduces byte-for-byte and is a shareable, remixable link, plus AURORA: a watchable citizen-science game and plain-language help on every dial. Built for scientists, creators, and streamers.',
  keywords: [
    'in-silico biology',
    'bioinformatics',
    'simulation',
    'open source',
    'citizen science',
    'deterministic',
    'reproducible',
    'biotech',
    'science game',
    'science streaming',
  ],
  applicationName: 'OpenDiscover BioLab',
  openGraph: {
    type: 'website',
    siteName: 'OpenDiscover BioLab',
    title: 'OpenDiscover BioLab — biology you can play, reproduce byte-for-byte',
    description:
      'A deterministic in-silico biology lab in your browser — 80 engines, plain-language help, and AURORA: a watch-and-play citizen-science game. No account. Every run is a shareable, remixable link.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenDiscover BioLab',
    description:
      '80 deterministic biology engines + a watchable citizen-science game, in your browser. Every run reproduces byte-for-byte and is a shareable link.',
  },
};

type NavKey = keyof Dictionary['nav'];
type FooterKey = keyof Dictionary['footer'];

const NAV: { href: string; key: NavKey; highlight?: boolean }[] = [
  { href: '/lab', key: 'lab' },
  { href: '/aurora', key: 'play', highlight: true },
  { href: '/discover', key: 'discover' },
  { href: '/challenge', key: 'challenge' },
  { href: '/gallery', key: 'gallery' },
  { href: '/tv', key: 'tv' },
  { href: '/discoveries', key: 'discoveries' },
  { href: '/about', key: 'about' },
];

const FOOTER_EXPLORE: { href: string; key: FooterKey }[] = [
  { href: '/lab', key: 'theLab' },
  { href: '/aurora', key: 'playAurora' },
  { href: '/challenge', key: 'dailyChallenge' },
  { href: '/gallery', key: 'gallery' },
  { href: '/tv', key: 'labTv' },
];

const FOOTER_PROJECT: { href: string; key: FooterKey }[] = [
  { href: '/about', key: 'about' },
  { href: '/discoveries', key: 'discoveries' },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getMessages();
  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
        >
          {dict.nav.skipToContent}
        </a>

        <header className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 shrink-0">
              <LanguageSwitcher current={locale} label={dict.nav.language} />
              <Link href="/" className="flex items-center gap-2 font-mono text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-accent" />
                <span className="font-semibold">OpenDiscover</span>
                <span className="text-muted-foreground">/biolab</span>
              </Link>
            </div>
            <nav
              className="flex items-center gap-1.5 sm:gap-2 text-sm overflow-x-auto"
              aria-label="Primary"
            >
              {NAV.map((item) =>
                item.highlight ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-accent px-3 py-1 font-medium text-accent hover:bg-[hsl(142_71%_45%/0.12)] transition-colors"
                  >
                    ▶ {dict.nav[item.key]}
                  </Link>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {dict.nav[item.key]}
                  </Link>
                ),
              )}
              <span className="pl-1">
                <NavAuth />
              </span>
            </nav>
          </div>
        </header>

        <main id="main-content" className="w-full max-w-6xl mx-auto px-6 py-10 flex-1">
          {children}
        </main>

        <footer className="border-t border-border mt-20">
          <div className="max-w-6xl mx-auto px-6 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-accent" />
                <span className="font-semibold">OpenDiscover</span>
                <span className="text-muted-foreground">/biolab</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">{dict.footer.tagline}</p>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
              >
                ★ {dict.footer.star}
              </a>
            </div>

            <FooterCol
              title={dict.footer.exploreTitle}
              links={FOOTER_EXPLORE.map((l) => ({ href: l.href, label: dict.footer[l.key] }))}
            />
            <FooterCol
              title={dict.footer.projectTitle}
              links={FOOTER_PROJECT.map((l) => ({ href: l.href, label: dict.footer[l.key] }))}
              external={{ href: repoUrl, label: dict.footer.github }}
            />
          </div>

          <div className="border-t border-border">
            <div className="max-w-6xl mx-auto px-6 py-5 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 justify-between">
              <span>{dict.footer.license}</span>
              <span>{dict.footer.disclaimer}</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterCol({
  title,
  links,
  external,
}: {
  title: string;
  links: { href: string; label: string }[];
  external?: { href: string; label: string };
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
        {title}
      </div>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-muted-foreground hover:text-accent transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
        {external && (
          <li>
            <a
              href={external.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition-colors"
            >
              {external.label}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
