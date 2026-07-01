import { LiveDiscoveryFeed } from '@/components/discovery/live-feed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { recentDiscoveries } from '@/lib/db/queries';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const seed = await recentDiscoveries(5).catch(() => []);

  return (
    <div className="space-y-20">
      <section className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-6">
          <div className="inline-block text-xs uppercase tracking-widest text-accent font-mono">
            Open · Reproducible · Agent-augmented
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Discover by testing.
            <br />
            <span className="text-muted-foreground">Vulgarize what you just found.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            OpenDiscover is a citizen-science platform for in-silico biology. You run a short,
            reproducible experiment on public data. A multi-agent pipeline (Claude Opus + UniProt +
            Europe PMC tool-use) watches for unexpected patterns across thousands of submissions,
            scores their novelty against the live literature, and auto-generates a Discovery Card
            the moment a signal emerges — in your name.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/experiments">Run an experiment →</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/discoveries">Browse discoveries</Link>
            </Button>
          </div>
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

      <section className="grid md:grid-cols-3 gap-6">
        <Step n="1" title="Pick a protocol">
          Deterministic in-browser (TypeScript or Pyodide Python) or server-side (Vercel Sandbox)
          experiments on NCBI, UniProt, AlphaFold, MGnify.
        </Step>
        <Step n="2" title="Submit your result">
          Output is hashed for reproducibility, embedded by text-embedding-3-large, and clustered
          across other contributors via pgvector HNSW kNN.
        </Step>
        <Step n="3" title="The agent vulgarizes">
          Claude Opus 4.7 grounds the claim against live UniProt and Europe PMC searches. If novel
          AND corroborated, Sonnet 4.6 generates a Discovery Card. Inngest replays each step.
        </Step>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Tech under the hood</CardTitle>
            <CardDescription>
              Every layer is open, multi-tenant, and instrumented end-to-end.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Tech
                name="Vercel AI Gateway"
                detail="Opus 4.7 · Sonnet 4.6 · Haiku 4.5 · text-embedding-3-large"
              />
              <Tech name="Inngest" detail="Durable, replayable pipeline with per-step traces" />
              <Tech
                name="Drizzle + pgvector"
                detail="Native HNSW kNN, edge-compatible, typed joins"
              />
              <Tech
                name="Vercel Sandbox"
                detail="Isolated Python execution for canary replication"
              />
              <Tech
                name="MCP server"
                detail="Agents (Claude Code, Cursor) contribute alongside humans"
              />
              <Tech name="Better Auth" detail="GitHub · ORCID · magic link · Sign in with Vercel" />
              <Tech
                name="Mol* + Vega-Lite"
                detail="3D protein structures + auto-generated visualizations"
              />
              <Tech
                name="BotID + Upstash RL"
                detail="Rate limiting and adversarial-bot filtering"
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
              We start with{' '}
              <strong className="text-foreground">
                small ORF mining in understudied bacterial genomes
              </strong>{' '}
              — a domain with a known long tail of undocumented coding sequences and
              well-characterized validation pathways. Every promoted Discovery has at least two
              independent disjoint contributors and a Claude Opus literature-grounded novelty
              judgment with cited overlaps.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
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
