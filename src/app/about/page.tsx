import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listEngines } from '@/lib/sim';
import Link from 'next/link';

export const metadata = {
  title: 'About — OpenDiscover BioLab',
  description:
    'What OpenDiscover BioLab is, how it judges novelty and truth, why every run is deterministic, and what it will not do.',
};

export default function AboutPage() {
  const engineCount = listEngines().length;

  return (
    <div className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-accent font-mono">About</div>
        <h1 className="text-4xl font-bold tracking-tight">A lab, a game, and an honest pipeline</h1>
        <p className="text-lg text-muted-foreground">
          OpenDiscover BioLab is an open, in-browser biotechnology lab built on one bet:{' '}
          <span className="text-foreground">
            thousands of small, focused, reproducible in-silico experiments can surface signals no
            single researcher would prioritise
          </span>
          . It pairs the throughput of a community — and a swarm of AI scientists — with a pipeline
          that triages, clusters, scores novelty, and explains, all in the open.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">What it is</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Pillar title={`🧫 ${engineCount} deterministic engines`} href="/lab" cta="Open the Lab">
            Pure, tested simulation functions across molecular biology, biophysics, systems biology,
            genetics, neuroscience, ecology, epidemiology, drug discovery and more. Same inputs →
            same outputs → same content hash, on every machine.
          </Pillar>
          <Pillar title="🌍 A game anyone can play" href="/aurora" cta="Play AURORA">
            AURORA turns the lab into a spectator-friendly discovery game: tune one dial to find a
            hidden answer, lock it in with a real engine re-run, and light up a shared globe. As fun
            to watch as to play.
          </Pillar>
          <Pillar title="🫶 Plain-language help" href="/challenge" cta="Today's challenge">
            Every engine and every challenge carries a “?” card written for someone with no biology
            or maths background — what it is, why it matters, and what to try. Science made
            approachable, so anyone can take part.
          </Pillar>
          <Pillar title="🤖 AI scientists + a pipeline" href="/discoveries" cta="Live discoveries">
            Autonomous agents run the engines as instruments and journal every step; a discovery
            pipeline triages, clusters, and vulgarises the promising results into shareable
            Discovery Cards — with peer review and open archival.
          </Pillar>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Why every run is deterministic</h2>
        <p className="text-muted-foreground">
          Reproducibility is the whole thesis. Every run is canonically hashed, so re-running the
          same engine with the same parameters anywhere reproduces the same result and the same{' '}
          <span className="text-foreground">output hash</span>. That is what makes an AI-run
          experiment exactly as auditable as a human-run one: the notebook records what was run, and
          anyone can replay it. Stochastic models stay reproducible too — every random draw comes
          from a seeded generator, never <code className="text-accent">Math.random()</code>. A run
          is already a shareable, remixable link.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">How we judge novelty</h2>
        <p className="text-muted-foreground">
          A signal is provisionally promoted only when all three hold: (a) its embedding distance
          from the literature corpus is high, (b) at least two independent contributors on disjoint
          input slices produced converging results, and (c) a frontier model reading the closest
          live literature judges it materially novel, citing the overlaps. None alone is sufficient,
          and the threshold is intentionally strict and tunable per protocol.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">How we judge truth</h2>
        <p className="text-muted-foreground">
          We don't. The platform produces <em>provisional</em> signals — transparent models, not
          clinical or applied claims. Confirmation requires open peer review: replication,
          challenge, annotation. Confirmed discoveries earn a permanent citation; retractions are
          public and explained.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">What we won't do</h2>
        <ul className="space-y-2">
          {[
            'No wet-lab protocols, no synthesis instructions.',
            'No medical advice.',
            'No dual-use-adjacent work without explicit screening.',
            'No private data — everything is CC-BY.',
          ].map((item) => (
            <li key={item} className="flex gap-2 text-muted-foreground">
              <span className="text-accent" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Acknowledgements
        </h2>
        <p className="text-sm text-muted-foreground">
          Data: NCBI, UniProt, AlphaFold DB, SmProt, sORFs.org, MGnify, Europe PMC. Infrastructure:
          Vercel (Fluid Compute, AI Gateway, Postgres + pgvector). Open-source libraries: Next.js,
          React, Drizzle ORM, the Vercel AI SDK, and Vega-Lite. Code is MIT; data, protocols and
          discoveries are CC-BY 4.0.
        </p>
        <p className="text-sm">
          <Link href="/lab" className="text-accent hover:underline">
            Start exploring the lab →
          </Link>
        </p>
      </section>
    </div>
  );
}

function Pillar({
  title,
  href,
  cta,
  children,
}: {
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col hover:border-accent transition-colors">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 mt-auto">
        <p className="text-sm text-muted-foreground">{children}</p>
        <Link href={href} className="text-sm text-accent hover:underline">
          {cta} →
        </Link>
      </CardContent>
    </Card>
  );
}
