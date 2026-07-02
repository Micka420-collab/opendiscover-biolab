import { LiveDiscoveryFeed } from '@/components/discovery/live-feed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MODELS } from '@/lib/ai/gateway';
import { recentDiscoveries } from '@/lib/db/queries';
import { listEngines } from '@/lib/sim';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/** 'anthropic/claude-opus-4-8' -> 'Opus 4.8' for human-readable copy. */
function pretty(model: string): string {
  const id = (model.split('/').pop() ?? model).replace(/^claude-/, '');
  const spaced = id.replace(/-(\d+)(?:-(\d+))?$/, (_m, a, b) => (b ? ` ${a}.${b}` : ` ${a}`));
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default async function HomePage() {
  const seed = await recentDiscoveries(5).catch(() => []);
  const engineCount = listEngines().length;

  return (
    <div className="space-y-24">
      <section className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-6">
          <div className="inline-block text-xs uppercase tracking-widest text-accent font-mono">
            In-silico · Deterministic · No account
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Invent biology, live.
            <br />
            <span className="text-muted-foreground">Every run reproduces byte-for-byte.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            OpenDiscover BioLab is an open-source virtual biotechnology lab you run in the browser —
            no login, no database, no secrets. {engineCount} deterministic simulation engines turn
            each <span className="text-foreground">(engine + parameters)</span> into a stable,
            content-hashed result that reproduces exactly on any machine. That determinism is the
            creator superpower: any run is already a shareable, remixable link. Invent something on
            stream, drop the link in chat, and your viewers land on the <em>exact</em> same
            experiment.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/lab">Run an experiment — no account →</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/challenge">Today&apos;s challenge</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/lab/breeding">Play the Breeding Lab</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse the community&apos;s{' '}
            <Link href="/gallery" className="text-accent hover:underline">
              experiment gallery
            </Link>{' '}
            or the{' '}
            <Link href="/discoveries" className="text-accent hover:underline">
              live discovery feed
            </Link>
            .
          </p>
        </div>
        <LiveDiscoveryFeed
          initialEvents={seed.map((d) => ({
            type: 'promoted',
            discoveryId: d.id,
            title: d.title,
            summary: d.summary,
            noveltyScore: d.noveltyScore,
            at: new Date(d.createdAt).getTime(),
          }))}
        />
      </section>

      {/* For creators & streamers */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-accent font-mono">
            For creators & streamers
          </div>
          <h2 className="text-2xl font-bold">
            A lab that&apos;s built to be watched, shared, remixed
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Feature title="🔗 Share & remix links" href="/lab">
            Every run encodes into a <code className="text-accent">?x=</code> permalink. Viewers
            open it, reproduce your exact result and hash, then tweak one slider to remix it — no
            account, no upload.
          </Feature>
          <Feature title="🎯 A daily challenge" href="/challenge">
            One puzzle a day, derived purely from the date — the same for everyone on Earth. Tune
            the parameters, beat the target, share your best attempt. Your recurring
            &ldquo;today&apos;s episode&rdquo; hook.
          </Feature>
          <Feature title="📺 OBS overlay mode" href="/lab/breeding">
            Add <code className="text-accent">/overlay</code> to any experiment link for a
            transparent, big-type result card that auto-runs — drop it straight into OBS as a
            browser source.
          </Feature>
        </div>
      </section>

      {/* How the lab works */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">How the lab works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step n="1" title="Pick an engine">
            {engineCount} engines across molecular biology, protein biophysics, systems biology,
            population genetics, bioprocess, epidemiology and drug discovery. Each is a pure
            function with a Zod-validated parameter form.
          </Step>
          <Step n="2" title="Run it — deterministically">
            No clock, no network, no unseeded randomness. The same parameters always produce the
            same numbers and the same content hash, so a result is auditable and replayable
            anywhere.
          </Step>
          <Step n="3" title="Share the exact run">
            The link carries the engine and every parameter. Anyone who opens it reproduces the run
            byte-for-byte — then remixes it into their own.
          </Step>
        </div>
      </section>

      {/* The autonomous citizen-science pipeline (original engine, kept) */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-accent font-mono">
            Community discovery pipeline
          </div>
          <h2 className="text-2xl font-bold">
            Thousands of small experiments, one agent watching for signal
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Step n="1" title="Submit a result">
            Output is hashed for reproducibility, embedded, and clustered against other contributors
            via pgvector HNSW kNN.
          </Step>
          <Step n="2" title="An agent grounds it">
            {pretty(MODELS.novelty)} reads the closest live literature (UniProt + Europe PMC) and
            judges whether the signal is materially novel, citing the overlaps.
          </Step>
          <Step n="3" title="A Discovery Card appears">
            If novel and independently corroborated, {pretty(MODELS.vulgarize)} writes a
            plain-language Discovery Card — in your name. Every step is durable and replayable.
          </Step>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Under the hood</CardTitle>
            <CardDescription>
              Every layer is open, reproducible, and instrumented end-to-end.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Tech
                name="Vercel AI Gateway"
                detail={`${pretty(MODELS.scientist)} · ${pretty(MODELS.vulgarize)} · ${pretty(MODELS.triage)}`}
              />
              <Tech
                name="Deterministic engines"
                detail="Pure functions, seeded PRNG, content-hashed runs"
              />
              <Tech name="Inngest" detail="Durable, replayable pipeline with per-step traces" />
              <Tech
                name="Drizzle + pgvector"
                detail="Native HNSW kNN, edge-compatible, typed joins"
              />
              <Tech name="Vercel Sandbox" detail="Isolated execution for canary replication" />
              <Tech
                name="MCP server"
                detail="Agents (Claude Code, Cursor) run engines alongside humans"
              />
              <Tech
                name="Mol* + Vega-Lite"
                detail="3D structures + auto-generated visualizations"
              />
              <Tech
                name="Better Auth · BotID"
                detail="GitHub · ORCID · magic link · bot filtering"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Why this can produce real discoveries</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 max-w-3xl">
            <p>
              30–40% of microbial protein-coding genes have no functional annotation. Public
              sequence data is enormous and underexplored. Thousands of focused micro-analyses
              surface signals no single researcher would prioritize.
            </p>
            <p>
              These are transparent{' '}
              <strong className="text-foreground">models, not clinical or applied claims</strong>.
              Every promoted discovery has at least two independent contributors and a
              literature-grounded novelty judgment with cited overlaps — and every result, human or
              agent, is reproducible from its hash.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Feature({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full hover:border-accent transition-colors">
        <CardHeader>
          <CardTitle className="text-lg group-hover:text-accent transition-colors">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{children}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="font-mono text-xs text-accent">STEP {n}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

function Tech({ name, detail }: { name: string; detail: string }) {
  return (
    <div>
      <div className="font-semibold">{name}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
