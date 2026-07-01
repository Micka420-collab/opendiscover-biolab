# Examples — what kinds of discoveries the community could produce

Each example below is a *plausible* signal that the OpenDiscover pipeline could detect, scored, and vulgarize. They illustrate the range from "low novelty, useful annotation" to "potentially genuinely new."

---

## Example A — Plausible novel small ORF cluster (high novelty)

**Trigger.** Three independent contributors, scanning disjoint slices of a poorly-studied marine *Pelagibacterales* genome with `small-orf-mining-v1`, all report 30–50-aa ORFs with codon-bias z-scores > 3 in the same gene-poor intergenic region.

**Pipeline output.**
- Embedding distance from corpus: 0.86 (no nearby literature)
- Corroborations: 3 distinct contributors, disjoint slices ✓
- LLM novelty judgment: *novel=true, confidence=0.78*, citing SmProt and sORFs.org neighbors that cover *general* small-ORF biology but no specific homologs

**Discovery Card title.** *"Three independent scans of a marine bacterium reveal a cluster of small ORFs with sharply divergent codon usage."*

**Why this could be real.** Marine ultra-small bacteria are systematically under-annotated; codon-bias outliers in gene-poor regions are a known signature of recently acquired or under-curated coding sequences. A follow-up Phase 2 protocol (motif conservation) would test whether these ORFs are conserved across related strains.

---

## Example B — Antibiotic-resistance precursor signature (medium novelty)

**Trigger.** Across MGnify wastewater samples, contributors running `codon-bias-hgt-v1` flag a beta-lactamase-like gene family in a non-Enterobacteriaceae host whose codon usage matches *Acinetobacter*, suggesting recent horizontal transfer.

**Pipeline output.**
- Embedding distance: 0.55 (literature on related transfers exists)
- Corroborations: 5 distinct contributors across 3 sample types
- LLM judgment: *novel=false on the general phenomenon, novel=true on this specific host pairing*, score 0.71

**Discovery Card title.** *"Possible HGT of a beta-lactamase-like gene into Genus X observed across five wastewater metagenomes."*

**Why this could be real.** AMR surveillance lags behind metagenomic data accumulation. Provisional signals like this often turn into real surveillance leads when followed up by labs.

---

## Example C — Conserved unannotated motif in archaeal proteomes (high novelty)

**Trigger.** Contributors using `motif-conservation-v1` find a 12-aa motif present in 7/9 *Asgardarchaeota* genomes in regions not annotated as any PFAM domain.

**Pipeline output.**
- Embedding distance: 0.91 (no literature on this exact motif)
- Corroborations: 7 distinct contributors, each scanning a different genome
- LLM judgment: *novel=true, confidence=0.82*, follow-up suggestions: AlphaFold structural mining, ortholog clustering against eukaryotic reference set

**Discovery Card title.** *"A 12-amino-acid motif conserved across Asgardarchaeota lies entirely outside annotated domains."*

**Why this could be real.** Asgardarchaeota are the closest known archaeal relatives of eukaryotes; conserved unannotated motifs in this group regularly turn out to be eukaryotic-signature precursors.

---

## Example D — False positive that the pipeline correctly rejects (showcase)

**Trigger.** A single contributor reports an apparent ORF cluster with extreme codon bias.

**Pipeline output.**
- Embedding distance: 0.95 (no neighbors)
- Corroborations: 0 (no other contributor has scanned a similar slice)
- LLM judgment: *novel=true, confidence=0.9* (but corroboration gate fails)
- Pipeline outcome: **NOT promoted.** Submission marked `TRIAGED_INTERESTING`, awaiting corroboration.
- Cron job rechecks weekly; if no corroborator appears in 30 days, archived as low-confidence.

**Why this matters.** The hardest part of citizen science is rejecting individual enthusiasm. The corroboration gate is the structural defense against this.

---

## Example E — Refuted discovery (showcase of the dispute pipeline)

**Trigger.** A Provisional Discovery on a conserved motif gets challenged: a reviewer runs the protocol on a wider taxonomic set and demonstrates the motif is actually a fragment of a known repeat element.

**Pipeline output.**
- Status: PROVISIONAL → DISPUTED → REFUTED
- Original contributor receives notification, retains credit for the *attempt*, no reputation penalty
- Refutation is public, linked, citable

**Why this matters.** The community has to be able to be *wrong out loud*. Refutation lineage is part of the scientific record.
