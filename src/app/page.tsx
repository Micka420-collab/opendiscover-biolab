import { LiveDiscoveryFeed } from '@/components/discovery/live-feed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MODELS } from '@/lib/ai/gateway';
import { recentDiscoveries } from '@/lib/db/queries';
import { listDomains, listEngines } from '@/lib/sim';
import { domainLabel } from '@/lib/sim/domain-labels';
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
  const engines = listEngines();
  const engineCount = engines.length;
  const domains = listDomains().map((key) => ({
    key,
    label: domainLabel(key),
    count: engines.filter((e) => e.domain === key).length,
  }));

  return (
    <div className="space-y-24">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-6">
          <div className="inline-block text-xs uppercase tracking-widest text-accent font-mono">
            Play it · Watch it · Reproduce it — no account
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Biology you can <span className="text-accent">play</span>.
            <br />
            <span className="text-muted-foreground">Every run reproduces byte-for-byte.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            OpenDiscover BioLab is an open-source virtual biotechnology lab that runs entirely in
            your browser — no login, no database, no secrets. {engineCount} deterministic engines
            turn each <span className="text-foreground">(engine + parameters)</span> into a stable,
            content-hashed result that reproduces exactly on any machine. Tune a real model like a
            game, and every run is already a shareable, remixable link.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg">
              <Link href="/aurora">▶ Play AURORA</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/lab">Open the Lab — {engineCount} engines</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/challenge">Today&apos;s challenge</Link>
            </Button>
          </div>

          {/* Stat strip */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px pt-4 rounded-lg overflow-hidden border border-border bg-border">
            <Stat value={String(engineCount)} label="simulation engines" />
            <Stat value={String(domains.length)} label="fields of biology" />
            <Stat value="Plain words" label="help on every dial" />
            <Stat value="0" label="accounts needed" />
          </dl>
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

      {/* ── AURORA game highlight ────────────────────────────────────────── */}
      <section>
        <Card className="border-accent bg-[hsl(142_71%_45%/0.06)]">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 p-2 md:p-4">
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-widest text-accent font-mono">
                🌍 AURORA — the game
              </div>
              <h2 className="text-3xl font-bold leading-tight">
                Find a hidden answer. Light up the Earth.
              </h2>
              <p className="text-muted-foreground max-w-xl">
                A spectator-first citizen-science game built on the real engines. Each round shows a
                fully-visible fitness landscape — slide one dial to hunt the target band, then{' '}
                <span className="text-foreground">lock it in</span>. Locking re-runs the actual
                engine and checks the result, so a win is a genuine, hashable discovery that lights
                a beacon on a shared globe. As fun to <span className="text-foreground">watch</span>{' '}
                as to play.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <Link href="/aurora">▶ Play now</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/aurora/overlay">📺 Watch / stream mode</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 content-start">
              <MiniPoint icon="🎯" title="Daily gauntlet">
                A 5-round puzzle, date-seeded so it&apos;s identical for everyone on Earth — plus
                endless and hands-free Watch modes.
              </MiniPoint>
              <MiniPoint icon="🔒" title="No fakes">
                Every lock is a real engine re-run checked against the bar — never an interpolation.
              </MiniPoint>
              <MiniPoint icon="♿" title="For everyone">
                Reduced-motion friendly, keyboard- and screen-reader-accessible, and no account.
              </MiniPoint>
            </div>
          </div>
        </Card>
      </section>

      {/* ── CrossLab game highlight ──────────────────────────────────────── */}
      <section>
        <Card className="transition-colors hover:border-accent">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 p-2 md:p-4">
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-widest text-accent font-mono">
                🧬 CrossLab — genetics you can guess
              </div>
              <h2 className="text-3xl font-bold leading-tight">
                Two parents in. Predict the babies.
              </h2>
              <p className="text-muted-foreground max-w-xl">
                The most beginner-friendly way into real biology. You&apos;re shown two organisms —
                pea plants, dragons, snapdragons — and you{' '}
                <span className="text-foreground">predict what their offspring will look like</span>
                . Then the deterministic{' '}
                <Link href="/lab/breeding" className="text-accent hover:underline">
                  breeding
                </Link>{' '}
                engine reveals the truth: a Punnett square, the real odds, and a litter of actual
                babies. Mendel&apos;s genetics, turned into a guessing game the whole chat can play
                along with.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <Link href="/cross">🧬 Play CrossLab</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/cross?mode=endless">Endless mode</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 content-start">
              <MiniPoint icon="🔮" title="Hypothesis first">
                Call the most common look — then bet its exact share for bonus points. The reveal
                shows you exactly why.
              </MiniPoint>
              <MiniPoint icon="🍼" title="See the litter">
                Every round ends with a set of real, seeded offspring popping in — the abstract
                ratio made concrete.
              </MiniPoint>
              <MiniPoint icon="🌱" title="No background needed">
                Dominant, recessive, Punnett square — each term has a plain-language
                &ldquo;?&rdquo;. Watch two brown mice have a white pup.
              </MiniPoint>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Domain breadth ───────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-accent font-mono">The breadth</div>
          <h2 className="text-2xl font-bold">
            {engineCount} engines across {domains.length} fields of biology
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            From the action potential to predator–prey cycles, PCR to pharmacokinetics — each a
            pure, tested function you can run, tune, and share. Pick a field to explore its engines.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {domains.map((d) => (
            <Link
              key={d.key}
              href={`/lab?domain=${d.key}`}
              className="group flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 hover:border-accent hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium truncate">{d.label}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground group-hover:text-accent transition-colors">
                {d.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Plain-language help ──────────────────────────────────────────── */}
      <section>
        <Card>
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center p-2 md:p-4">
            <div className="text-6xl md:text-7xl text-center md:px-4" aria-hidden>
              🫶
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-accent font-mono">
                Made approachable
              </div>
              <h2 className="text-2xl font-bold">A “?” that explains everything, in plain words</h2>
              <p className="text-muted-foreground max-w-2xl">
                Citizen science only works if a stranger can understand what they&apos;re doing. So
                every engine and every challenge carries a plain-language help card — what it is,
                why it matters for people and the planet, and what to try — written for someone with{' '}
                <span className="text-foreground">no biology or maths background</span>, with the
                technical term available on demand and never a bare equation in the friendly copy.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ── For creators & streamers ─────────────────────────────────────── */}
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
          <Feature title="📺 OBS overlay + Lab TV" href="/tv">
            Add <code className="text-accent">/overlay</code> to any experiment link for a
            transparent, big-type card that auto-runs — drop it into OBS as a browser source. Or
            leave <span className="text-foreground">Lab TV</span> running to auto-cycle live
            experiments.
          </Feature>
        </div>
      </section>

      {/* ── How the lab works ────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">How the lab works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step n="1" title="Pick an engine">
            {engineCount} engines across molecular biology, protein biophysics, systems biology,
            population genetics, neuroscience, ecology, bioprocess, biochemistry, epidemiology and
            drug discovery. Each is a pure function with a Zod-validated parameter form.
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

      {/* ── The autonomous citizen-science pipeline (original engine, kept) ── */}
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function MiniPoint({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="text-xl leading-none pt-0.5" aria-hidden>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
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
