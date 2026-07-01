export default function AboutPage() {
  return (
    <article className="prose prose-invert max-w-3xl">
      <h1>About OpenDiscover</h1>
      <p>
        OpenDiscover is a citizen-science platform whose central bet is that{' '}
        <strong>
          thousands of small, focused, reproducible in-silico experiments can surface signals that
          no single researcher would prioritize
        </strong>
        . We pair the throughput of a community with an AI pipeline that triages, embeds, clusters,
        scores novelty, and vulgarizes — in real time.
      </p>

      <h2>How we judge novelty</h2>
      <p>
        A signal is provisionally promoted when (a) its embedding distance from the literature
        corpus is high, (b) at least two independent contributors on disjoint input slices produced
        converging results, and (c) a frontier LLM (Claude Opus 4.7) reading the closest literature
        judges the signal materially novel. None of these alone is sufficient. The promotion
        threshold is intentionally strict and tunable per protocol.
      </p>

      <h2>How we judge truth</h2>
      <p>
        We don't. The platform produces <em>provisional</em> signals. Confirmation requires open
        peer review: replication, challenge, annotation. Confirmed discoveries get a Zenodo DOI for
        permanent citation. Retractions are public and explained.
      </p>

      <h2>What we won't do</h2>
      <ul>
        <li>No wet-lab protocols, no synthesis instructions.</li>
        <li>No medical advice.</li>
        <li>No dual-use adjacent work without explicit screening.</li>
        <li>No private data — everything is CC-BY.</li>
      </ul>

      <h2>Acknowledgements</h2>
      <p>
        Data: NCBI, UniProt, AlphaFold DB, SmProt, sORFs.org, MGnify, Europe PMC. Infrastructure:
        Vercel (Fluid Compute, AI Gateway, Postgres + pgvector). Open-source libraries: Next.js,
        Prisma, AI SDK, Vega-Lite.
      </p>
    </article>
  );
}
