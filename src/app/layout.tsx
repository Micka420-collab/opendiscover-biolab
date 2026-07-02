import './globals.css';
import { NavAuth } from '@/components/layout/nav-auth';
import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://opendiscover-biolab.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'OpenDiscover BioLab — deterministic in-silico biology lab',
  description:
    'An open-source virtual biotechnology lab you run in the browser — no account, no database. Dozens of deterministic simulation engines where every run reproduces byte-for-byte and is a shareable, remixable link. Built for scientists, creators, and streamers.',
  keywords: [
    'in-silico biology',
    'bioinformatics',
    'simulation',
    'open source',
    'citizen science',
    'deterministic',
    'reproducible',
    'biotech',
    'science streaming',
  ],
  applicationName: 'OpenDiscover BioLab',
  openGraph: {
    type: 'website',
    siteName: 'OpenDiscover BioLab',
    title: 'OpenDiscover BioLab — invent biology live, reproduce it byte-for-byte',
    description:
      'A deterministic in-silico biology lab in your browser. No account. Every run is a shareable, remixable link — invent on stream, drop the link, viewers reproduce the exact experiment.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenDiscover BioLab',
    description:
      'A deterministic in-silico biology lab in your browser. Every run reproduces byte-for-byte and is a shareable, remixable link.',
  },
};

const NAV = [
  { href: '/lab', label: 'Lab' },
  { href: '/challenge', label: 'Challenge' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/tv', label: 'TV' },
  { href: '/discoveries', label: 'Discoveries' },
  { href: '/about', label: 'About' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
        >
          Skip to content
        </a>
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-2 font-mono text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent" />
              <span className="font-semibold">OpenDiscover</span>
              <span className="text-muted-foreground">/biolab</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm" aria-label="Primary">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-accent">
                  {item.label}
                </Link>
              ))}
              <NavAuth />
            </nav>
          </div>
        </header>
        <main id="main-content" className="max-w-6xl mx-auto px-6 py-10">
          {children}
        </main>
        <footer className="border-t border-border mt-20">
          <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex flex-wrap gap-2 justify-between">
            <span>Code: MIT · Data & discoveries: CC-BY 4.0</span>
            <span>Provisional in-silico signals are models, not clinical or applied claims.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
