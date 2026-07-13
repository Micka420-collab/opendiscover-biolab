/**
 * A single organism tile — a big emoji in a colour-matched frame, with its
 * phenotype label and (optionally) its genotype. The frame colour is the
 * phenotype's palette colour, so a specimen reads as "the green one" at a glance
 * and matches the bars and litter in the reveal.
 */

export type SpecimenSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpecimenSize, string> = {
  sm: 'h-14 w-14 text-2xl',
  md: 'h-24 w-24 text-5xl',
  lg: 'h-28 w-28 text-6xl',
};

export function SpecimenCard({
  emoji,
  label,
  genotype,
  caption,
  color = '#22c55e',
  size = 'md',
}: {
  emoji: string;
  label: string;
  genotype?: string;
  caption?: string;
  color?: string;
  size?: SpecimenSize;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={`flex items-center justify-center rounded-2xl border-2 ${SIZES[size]}`}
        style={{ borderColor: color, background: `${color}1a`, boxShadow: `0 0 28px ${color}22` }}
      >
        <span aria-hidden="true">{emoji}</span>
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        {genotype && <div className="font-mono text-xs text-muted-foreground">{genotype}</div>}
        {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
      </div>
    </div>
  );
}
