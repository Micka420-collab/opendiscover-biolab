# Protocols — what the community can run

Every protocol is:
- **Deterministic** — same input → same output → same hash
- **Reproducible** — runs in-browser via WebAssembly, no special equipment
- **Bounded** — finite compute, no external side effects
- **Open** — source code, parameters, and outputs are CC-BY

## Active

### 1. `small-orf-mining-v1` — Small ORF mining
Scan bacterial genome slices for 20–100-aa ORFs with divergent codon usage.
**Source code:** `src/lib/science/protocols/small-orf-mining.ts`
**Why it can yield discoveries:** sub-100-aa proteins are systematically under-annotated. Codon-usage divergence flags candidates that look "out of place" in their genome — often horizontally acquired or recently evolved.

## Proposed (Phase 2)

### 2. `codon-bias-hgt-v1` — Horizontal gene transfer signature
For a given gene, compute codon-usage divergence from the genome bulk and from a panel of putative donor genomes. Flag genes whose closest codon-usage match is *not* the host.

### 3. `motif-conservation-v1` — Cross-species motif conservation
Given a short protein motif (≤25 aa), search ortholog clusters across genomes to find motifs conserved in regions *not* annotated as known PFAM/InterPro domains. High conservation in unannotated regions = candidate undiscovered functional element.

### 4. `metagenome-coabundance-v1` — Gene co-abundance patterns in MGnify
For two gene families, compute their abundance correlation across MGnify samples. Strong correlations outside known operonic structure suggest functional linkage.

## Proposed (Phase 3+)

### 5. `alphafold-structural-mining-v1`
Cluster predicted structures with no homologous PDB hits but high pLDDT, by structural similarity. Identifies novel fold candidates.

### 6. `nanoparticle-md-snippets-v1`
Short, fully-deterministic molecular dynamics snippets exploring nanoparticle–protein interaction surfaces. Distributed compute, aggregate the energy landscape.

## How to propose a new protocol

1. Open a PR adding `src/lib/science/protocols/<your-slug>.ts`
2. Implement a pure, deterministic function: `(input) => output`
3. Add a test asserting determinism (same input → same hash)
4. Add a reference corpus entry list explaining what literature your protocol is searching *outside of*
5. Define JSONSchema for input and output
6. Default `status: DRAFT` — the community votes (peer review) to promote to `ACTIVE`

## Forbidden protocols

- Wet-lab synthesis instructions of any kind
- Anything analyzing pathogen virulence factors, toxin homology, or select agents without explicit safety review
- Anything that requires private / non-CC-BY data
- Anything non-deterministic
