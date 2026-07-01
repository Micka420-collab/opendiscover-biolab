import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NavAuth } from '@/components/layout/nav-auth';

export const metadata: Metadata = {
  title: 'OpenDiscover — Citizen Science Discovery Engine',
  description:
    'A community platform where citizens run in-silico biology experiments and an AI engine detects, scores, and vulgarizes potential discoveries in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-mono text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent" />
              <span className="font-semibold">OpenDiscover</span>
              <span className="text-muted-foreground">/citizen-science</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/experiments" className="hover:text-accent">Experiments</Link>
              <Link href="/discoveries" className="hover:text-accent">Discoveries</Link>
              <Link href="/dashboard" className="hover:text-accent">Dashboard</Link>
              <Link href="/about" className="hover:text-accent">About</Link>
              <NavAuth />
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-border mt-20">
          <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
            <span>Code: MIT · Data & discoveries: CC-BY 4.0</span>
            <span>Provisional in-silico signals are not clinical or applied claims.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
