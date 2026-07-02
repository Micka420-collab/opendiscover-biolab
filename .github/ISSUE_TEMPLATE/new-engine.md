---
name: Propose a simulation engine
about: Suggest a new deterministic in-silico engine for the lab (the no-infrastructure track)
title: "engine: <name>"
labels: [engine, enhancement]
---

## The model

<!-- What does it simulate? One or two sentences. -->

**Domain:** <!-- molecular-biology / protein / systems-biology / population-genetics / bioprocess / epidemiology / drug-discovery / structural / neuroscience / ecology / new? -->

## Parameters (sketch)

<!-- The inputs and their units/ranges — this becomes the Zod schema. -->

## Known-value check

<!-- The analytical or textbook result the engine's test will be checked against
     (e.g. a conserved quantity, an equilibrium, a closed-form limit). An engine
     must reproduce a KNOWN value, not just "run". -->

## References

<!-- Primary source(s) grounding the model. -->

## Notes

- [ ] Pure & deterministic (no clock, no network, no unseeded `Math.random`)
- [ ] I'm interested in implementing it myself
