'use client';

/**
 * The visible payoff: the actual, seeded litter of offspring, each tinted by its
 * phenotype's colour and popping in one after another. Seeing the babies appear
 * is the moment that lands for a viewer — the abstract ratio made concrete.
 */

import { useEffect, useState } from 'react';

export function Litter({
  litter,
  emoji,
  colorFor,
  reduced,
}: {
  litter: { phenotype: string; genotype: string }[];
  emoji: string;
  colorFor: (label: string) => string;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {litter.map((baby, i) => {
        const color = colorFor(baby.phenotype);
        return (
          <div
            key={`${i}-${baby.genotype}`}
            className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-2xl ${
              reduced ? '' : 'transition-all duration-300 ease-out'
            }`}
            style={{
              borderColor: `${color}66`,
              background: `${color}14`,
              opacity: shown ? 1 : 0,
              transform: shown ? 'none' : 'scale(0.8)',
              transitionDelay: reduced ? undefined : `${i * 45}ms`,
            }}
            title={`${baby.phenotype} — ${baby.genotype}`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="sr-only">
              {baby.phenotype}, genotype {baby.genotype}
            </span>
          </div>
        );
      })}
    </div>
  );
}
