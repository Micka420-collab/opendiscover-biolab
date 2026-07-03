/**
 * The classic Punnett square for a single-locus cross: each parent's gametes
 * label a side, and every cell is the offspring genotype it produces, dotted in
 * the phenotype's colour. This is the "how the maths works" panel — the visual
 * proof behind the ratio, shown on reveal.
 */

import { Fragment } from 'react';
import type { Punnett } from '../lib/solve';

export function PunnettGrid({
  punnett,
  colorFor,
}: {
  punnett: Punnett;
  colorFor: (label: string) => string;
}) {
  const { gametesA, gametesB, cells } = punnett;
  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `1.75rem repeat(${gametesB.length}, minmax(3.25rem, 1fr))` }}
      >
        {/* Header row: an empty corner, then parent B's gametes. */}
        <div aria-hidden="true" />
        {gametesB.map((g) => (
          <div key={`col-${g}`} className="text-center font-mono text-sm text-muted-foreground">
            {g}
          </div>
        ))}

        {/* One row per parent A gamete. */}
        {gametesA.map((ga, r) => (
          <Fragment key={`row-${ga}`}>
            <div className="flex items-center justify-center font-mono text-sm text-muted-foreground">
              {ga}
            </div>
            {(cells[r] ?? []).map((cell) => (
              <div
                key={`${ga}-${cell.genotype}`}
                className="flex flex-col items-center gap-1 rounded-md border border-border bg-muted/20 p-2"
                title={cell.phenotype}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: colorFor(cell.phenotype) }}
                />
                <span className="font-mono text-sm font-medium">{cell.genotype}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
