import Link from 'next/link';
import { AdvancedGenetics } from './advanced-genetics';
import { BreedingGame } from './breeding-game';

export const metadata = { title: 'Breeding Lab — OpenDiscover BioLab' };

export default function BreedingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href="/lab" className="hover:text-foreground">
            Lab
          </Link>{' '}
          / Breeding
        </div>
        <h1 className="text-3xl font-bold">🧬 Breeding Lab</h1>
        <p className="text-muted-foreground max-w-2xl">
          Cross two <em>Glowzoa</em> specimens and discover new phenotypes. Every litter is drawn
          from the real Mendelian <code>breeding</code> engine — complete dominance, incomplete
          dominance, and codominance across four loci — so the ratios are genuine and every cross is
          reproducible. Hunt for rare combinations to fill your phenotype dex.
        </p>
      </header>

      <BreedingGame />

      <AdvancedGenetics />

      <footer className="text-xs text-muted-foreground border-t border-border pt-4">
        Powered by the{' '}
        <Link href="/lab/breeding" className="underline">
          breeding
        </Link>{' '}
        simulation engine · genotypes shown per locus (B body colour · G bioluminescence · P
        membrane · F flagella). Cross results come from <code>POST /api/lab/run</code>.
      </footer>
    </div>
  );
}
