'use client';

import { VegaLiteEmbed } from '@/components/charts/vega-lite-embed';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distributionToVegaLiteSpec } from '@/lib/lab/charts';
import {
  type EpistasisKind,
  type Gene,
  applyLethality,
  spec as breedingSpec,
  crossEpistatic,
  crossXLinked,
  recombinantGametes,
} from '@/lib/sim/genetics/breeding';
import { useMemo, useState } from 'react';

// These demos run entirely client-side — crossXLinked, crossEpistatic,
// applyLethality and recombinantGametes are pure functions (no RNG, no
// network), so results are instant and exactly reproduce the same textbook
// ratios verified in src/lib/sim/genetics/breeding.test.ts. They are
// deliberately NOT part of the main breeding engine's run() — see that
// engine's own description.

const inputClass = 'bg-muted/30 border border-border rounded px-2 py-1 text-sm';

// --- 1. X-linked (sex-linked) inheritance -----------------------------------

const visionGene: Gene = {
  symbol: 'A',
  name: 'Vision',
  mode: 'complete',
  dominant: 'A',
  alleles: [
    { symbol: 'A', label: 'Normal vision' },
    { symbol: 'a', label: 'Colour-blind' },
  ],
};

const MOTHER_OPTIONS: { label: string; alleles: [string, string] }[] = [
  { label: 'AA — homozygous normal', alleles: ['A', 'A'] },
  { label: 'Aa — carrier', alleles: ['A', 'a'] },
  { label: 'aa — affected', alleles: ['a', 'a'] },
];
const FATHER_OPTIONS: { label: string; allele: string }[] = [
  { label: 'A — normal', allele: 'A' },
  { label: 'a — affected', allele: 'a' },
];

function XLinkedDemo() {
  const [motherIdx, setMotherIdx] = useState(1); // carrier, the classic textbook case
  const [fatherIdx, setFatherIdx] = useState(0);
  const classes = useMemo(
    () =>
      crossXLinked(visionGene, MOTHER_OPTIONS[motherIdx].alleles, FATHER_OPTIONS[fatherIdx].allele),
    [motherIdx, fatherIdx],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">X-linked (sex-linked) inheritance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Sons are hemizygous — they get their only X (and this locus) from the mother, never the
          father. A carrier mother can pass the trait to sons even when neither parent is affected.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs space-y-1 block">
            <span className="text-muted-foreground">Mother</span>
            <select
              className={`${inputClass} w-full`}
              value={motherIdx}
              onChange={(e) => setMotherIdx(Number(e.target.value))}
            >
              {MOTHER_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-muted-foreground">Father</span>
            <select
              className={`${inputClass} w-full`}
              value={fatherIdx}
              onChange={(e) => setFatherIdx(Number(e.target.value))}
            >
              {FATHER_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {classes.map((c) => (
            <div
              key={`${c.sex}-${c.genotype}`}
              className="border border-border rounded p-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <Badge variant="muted">{c.sex === 'female' ? '♀ daughter' : '♂ son'}</Badge>
                <code>{c.genotype}</code>
              </div>
              <div className="mt-1">{c.phenotype}</div>
              <div className="text-muted-foreground">{(c.probability * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- 2. Epistasis (two-locus gene interaction) ------------------------------

const epiLocusA: Gene = {
  symbol: 'A',
  name: 'Pigment precursor',
  mode: 'complete',
  dominant: 'A',
  alleles: [
    { symbol: 'A', label: 'Precursor made' },
    { symbol: 'a', label: 'No precursor' },
  ],
};
const epiLocusB: Gene = {
  symbol: 'B',
  name: 'Pigment enzyme',
  mode: 'complete',
  dominant: 'B',
  alleles: [
    { symbol: 'B', label: 'Enzyme active' },
    { symbol: 'b', label: 'Enzyme inactive' },
  ],
};
const epiParents = {
  parentA: { A: ['A', 'a'] as [string, string], B: ['B', 'b'] as [string, string] },
  parentB: { A: ['A', 'a'] as [string, string], B: ['B', 'b'] as [string, string] },
};
const EPISTASIS_OPTIONS: { kind: EpistasisKind; label: string; ratio: string }[] = [
  { kind: 'recessive', label: 'Recessive epistasis (aa masks locus B)', ratio: '9:3:4' },
  { kind: 'dominant', label: 'Dominant epistasis (A_ masks locus B)', ratio: '12:3:1' },
  { kind: 'duplicate-recessive', label: 'Duplicate recessive (need both dominants)', ratio: '9:7' },
  {
    kind: 'duplicate-dominant',
    label: 'Duplicate dominant (either dominant suffices)',
    ratio: '15:1',
  },
];

function EpistasisDemo() {
  const [optIdx, setOptIdx] = useState(0);
  const opt = EPISTASIS_OPTIONS[optIdx];
  const classes = useMemo(
    () => crossEpistatic(epiLocusA, epiLocusB, epiParents, opt.kind),
    [opt.kind],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Epistasis (two-locus gene interaction)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Both loci are Aa Bb × Aa Bb — the standard 9:3:3:1 dihybrid baseline — re-grouped by how
          locus A's genotype masks or combines with locus B's.
        </p>
        <label className="text-xs space-y-1 block">
          <span className="text-muted-foreground">Interaction type</span>
          <select
            className={`${inputClass} w-full`}
            value={optIdx}
            onChange={(e) => setOptIdx(Number(e.target.value))}
          >
            {EPISTASIS_OPTIONS.map((o, i) => (
              <option key={o.kind} value={i}>
                {o.label} — {o.ratio}
              </option>
            ))}
          </select>
        </label>
        <VegaLiteEmbed
          spec={distributionToVegaLiteSpec(
            classes.map((c) => ({ label: c.phenotype, probability: c.probability })),
            `${opt.ratio} ratio`,
          )}
        />
      </CardContent>
    </Card>
  );
}

// --- 3. Lethal alleles -------------------------------------------------------

const coatGene: Gene = {
  symbol: 'Y',
  name: 'Coat colour',
  mode: 'complete',
  dominant: 'Y',
  alleles: [
    { symbol: 'Y', label: 'Yellow' },
    { symbol: 'a', label: 'Agouti' },
  ],
};

function LethalityDemo() {
  const preLethality = useMemo(() => {
    const r = breedingSpec.run({
      genes: [coatGene],
      parentA: { Y: ['Y', 'a'] },
      parentB: { Y: ['Y', 'a'] },
      offspringCount: 0,
    });
    return r.detail?.genotypeDistribution ?? [];
  }, []);
  const survivors = useMemo(() => applyLethality(preLethality, (g) => g === 'YY'), [preLethality]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lethal alleles distort the naive ratio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cuénot's (1905) classic mouse coat-colour cross: <code>Y</code> is dominant for yellow
          coat but homozygous-lethal — <code>YY</code> never survives. Ya × Ya gives the standard
          1:2:1 genotype ratio at conception, but exactly 2:1 among live offspring once{' '}
          <code>YY</code> is removed and the rest renormalized.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-2">At conception (1:2:1)</div>
            <VegaLiteEmbed
              spec={distributionToVegaLiteSpec(
                preLethality.map((d) => ({ label: d.genotype, probability: d.probability })),
              )}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Among survivors, YY removed (exactly 2:1)
            </div>
            <VegaLiteEmbed
              spec={distributionToVegaLiteSpec(
                survivors.map((d) => ({ label: d.genotype, probability: d.probability })),
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- 4. Linkage & recombination ---------------------------------------------

// Classic cis-coupling phase: parent carries A and B on the same chromosome
// (and a, b on the homolog). r=0 -> complete linkage (only AB/ab gametes);
// r=0.5 -> independent assortment (all 4 gametes at 0.25). These exact
// fractions ((1-r)/2 parental, r/2 recombinant) are already hand-verified in
// breeding.test.ts ("parental gametes get (1-r)/2 and recombinants r/2").
const LINKAGE_PHASE: [[string, string], [string, string]] = [
  ['A', 'B'],
  ['a', 'b'],
];
const R_OPTIONS = [0, 0.1, 0.2, 0.3, 0.5];

function LinkageDemo() {
  const [rIdx, setRIdx] = useState(2); // r = 0.2
  const r = R_OPTIONS[rIdx];
  const gametes = useMemo(() => recombinantGametes(LINKAGE_PHASE, r), [r]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linkage & recombination</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Parent's coupling is AB / ab (cis). At recombination frequency <code>r</code>, parental
          gametes (AB, ab) each get <code>(1-r)/2</code> and recombinants (Ab, aB) each get{' '}
          <code>r/2</code>. r = 0.5 recovers ordinary independent assortment.
        </p>
        <label className="text-xs space-y-1 block max-w-xs">
          <span className="text-muted-foreground">Recombination frequency r</span>
          <select
            className={`${inputClass} w-full`}
            value={rIdx}
            onChange={(e) => setRIdx(Number(e.target.value))}
          >
            {R_OPTIONS.map((v, i) => (
              <option key={v} value={i}>
                r = {v} {v === 0 ? '(complete linkage)' : v === 0.5 ? '(unlinked)' : ''}
              </option>
            ))}
          </select>
        </label>
        <VegaLiteEmbed
          spec={distributionToVegaLiteSpec(
            gametes.map((g) => ({ label: g.gamete.join(''), probability: g.frequency })),
          )}
        />
      </CardContent>
    </Card>
  );
}

export function AdvancedGenetics() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Advanced genetics</h2>
        <p className="text-sm text-muted-foreground">
          Four classical inheritance patterns beyond the simple Punnett square above, each backed by
          a hand-verified standalone helper in the <code>breeding</code> engine (not used by the
          Glowzoa crosses themselves).
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <XLinkedDemo />
        <EpistasisDemo />
        <LinkageDemo />
        <LethalityDemo />
      </div>
    </section>
  );
}
