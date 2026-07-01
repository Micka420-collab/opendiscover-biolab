'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GLOWZOA_GENES,
  STARTER_SPECIMENS,
  type Specimen,
  buildCrossParams,
  discoverNew,
  rarityScore,
  rarityTier,
} from '@/lib/lab/breeding-game';
import { useMemo, useState } from 'react';

interface Offspring {
  genotype: string;
  phenotype: string;
  rarity: number;
}

const TIER_CLASS: Record<string, string> = {
  common: 'border-border text-muted-foreground',
  uncommon: 'border-emerald-500/50 text-emerald-400',
  rare: 'border-sky-500/60 text-sky-400',
  legendary: 'border-fuchsia-500/70 text-fuchsia-400',
};

function bodyEmoji(phenotype: string): string {
  if (phenotype.includes('Teal')) return '🟢';
  if (phenotype.includes('Amber')) return '🟠';
  return '⚪';
}

export function BreedingGame() {
  const [aId, setAId] = useState(STARTER_SPECIMENS[0].id);
  const [bId, setBId] = useState(STARTER_SPECIMENS[3].id);
  const [litter, setLitter] = useState<Offspring[]>([]);
  const [ratio, setRatio] = useState<string>('');
  const [dex, setDex] = useState<string[]>([]);
  const [justFound, setJustFound] = useState<string[]>([]);
  const [crosses, setCrosses] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentA = useMemo(() => STARTER_SPECIMENS.find((s) => s.id === aId) as Specimen, [aId]);
  const parentB = useMemo(() => STARTER_SPECIMENS.find((s) => s.id === bId) as Specimen, [bId]);

  async function cross() {
    setLoading(true);
    setError(null);
    try {
      const params = buildCrossParams(parentA, parentB, {
        offspringCount: 8,
        // Vary the seed each cross so repeated crosses feel alive, yet stay reproducible per count.
        seed: `${parentA.id}x${parentB.id}#${crosses}`,
        genes: GLOWZOA_GENES,
      });
      const resp = await fetch('/api/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'breeding', params }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);

      const detail = json.result.detail as {
        phenotypeDistribution: { phenotype: string; probability: number }[];
        phenotypicRatio: string;
        sampledOffspring: { genotype: string; phenotype: string }[];
      };
      const probOf = new Map(detail.phenotypeDistribution.map((d) => [d.phenotype, d.probability]));
      const offspring: Offspring[] = detail.sampledOffspring.map((o) => ({
        ...o,
        rarity: rarityScore(probOf.get(o.phenotype) ?? 0),
      }));

      const fresh = discoverNew(
        dex,
        offspring.map((o) => o.phenotype),
      );
      setLitter(offspring);
      setRatio(detail.phenotypicRatio);
      setDex((prev) => [...prev, ...fresh]);
      setJustFound(fresh);
      setCrosses((c) => c + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Parent pickers */}
      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <ParentPicker label="Parent A" value={aId} onChange={setAId} />
        <div className="text-center text-2xl">✕</div>
        <ParentPicker label="Parent B" value={bId} onChange={setBId} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={cross} disabled={loading}>
          {loading ? 'Crossing…' : `🧬 Cross ${parentA.name} × ${parentB.name}`}
        </Button>
        {crosses > 0 && (
          <span className="text-xs text-muted-foreground">
            {crosses} cross{crosses > 1 ? 'es' : ''} · phenotype ratio {ratio}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {justFound.length > 0 && (
        <div className="rounded-md border border-fuchsia-500/50 bg-fuchsia-500/10 px-4 py-3 text-sm">
          ✨ Discovered {justFound.length} new phenotype{justFound.length > 1 ? 's' : ''}:{' '}
          <span className="font-medium text-fuchsia-300">{justFound.join(', ')}</span>
        </div>
      )}

      {/* Litter */}
      {litter.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Offspring</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {litter.map((o, i) => {
              const tier = rarityTier(o.rarity);
              return (
                <Card key={`${o.genotype}-${i}`} className={TIER_CLASS[tier]}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="text-3xl text-center">{bodyEmoji(o.phenotype)}</div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {o.phenotype.split(', ').map((trait) => (
                        <Badge key={trait} variant="muted" className="text-[10px]">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <code className="text-muted-foreground">{o.genotype}</code>
                      <span className="capitalize">
                        {tier} · 1/{o.rarity}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Phenotype dex */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Phenotype dex <span className="text-muted-foreground text-sm">({dex.length} found)</span>
        </h2>
        {dex.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cross specimens to discover phenotypes — rarer combinations score higher.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dex.map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ParentPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const specimen = STARTER_SPECIMENS.find((s) => s.id === value) as Specimen;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{specimen.emoji}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-sm"
          >
            {STARTER_SPECIMENS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {GLOWZOA_GENES.map((g) => (
            <code key={g.symbol} className="text-[10px] text-muted-foreground" title={g.name}>
              {specimen.genotype[g.symbol]?.join('')}
            </code>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
