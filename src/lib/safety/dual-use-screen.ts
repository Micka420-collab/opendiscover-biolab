/**
 * Dual-use safety screening.
 *
 * Action levels:
 *   - "block"  : reject submission with explanation
 *   - "review" : accept but freeze pipeline until human reviewer clears it
 *   - "log"    : run normally, recorded for audit
 *
 * Two layers:
 *   1. Static keyword/accession block-list (IGSC framework + Select Agents).
 *   2. Embedding-based "concerning concept" detector — flags submissions whose
 *      claim summary embeds close to known toxin/pathogenicity descriptions.
 */

import { cosineSimilarity, embedClaim } from '@/lib/ai/embeddings';

/* ─── Static block-list ──────────────────────────────────────────────── */

const HARD_BLOCK_KEYWORDS: ReadonlyArray<string> = [
  // CDC/USDA Select Agents — Tier 1
  'variola virus',
  'smallpox',
  'foot-and-mouth disease virus',
  'rinderpest virus',
  'african swine fever virus',
  'highly pathogenic avian influenza h5n1',
  'ebola virus',
  'marburg virus',
  'nipah virus',
  // Toxins — Schedule 1 (CWC) / IGSC controlled
  'ricin',
  'abrin',
  'botulinum toxin',
  'anthrax lethal factor',
  'tetrodotoxin',
  'saxitoxin',
  'shiga toxin',
  'stx1',
  'stx2',
  'conotoxin',
  'diacetoxyscirpenol',
  't-2 toxin',
  'aflatoxin b1',
  // Gain-of-function concern patterns
  'enhanced transmissibility',
  'enhanced virulence',
  'immune evasion engineering',
  'serial passage to increase pathogenicity',
  'airborne transmission of h5n1',
  'airborne transmission of ebola',
  // Bioweapons explicit
  'weaponizable',
  'weaponization of',
  'biological weapon',
  'bioweapon',
  'aerosolization for attack',
  'mass casualty pathogen',
];

const SOFT_REVIEW_KEYWORDS: ReadonlyArray<string> = [
  // Select Agent adjacents that need context
  'yersinia pestis',
  'francisella tularensis',
  'burkholderia mallei',
  'burkholderia pseudomallei',
  'coccidioides',
  'bacillus anthracis',
  'brucella',
  'clostridium botulinum',
  // Concerning genomic operations without clear defensive context
  'toxin gene synthesis',
  'pathogenicity island transfer',
  'virulence factor insertion',
  'lethal dose optimization',
  'drug-resistant pathogen engineering',
  // Dual-use chemistry / biology
  'nerve agent precursor',
  'vx synthesis',
  'sarin synthesis',
  'novichok',
];

/* ─── Embedding-based concept proximity ─────────────────────────────── */

const CONCERNING_CONCEPT_DESCRIPTIONS: ReadonlyArray<string> = [
  'engineering a pathogen to increase lethality or transmissibility in humans',
  'synthesis route for a biological toxin used as a weapon',
  'methods to enhance aerosol stability of dangerous pathogens',
  'gene sequences encoding lethal protein toxins for production purposes',
  'bypassing immune system defenses by modifying pathogen surface proteins',
  'enhancing antibiotic resistance in a dangerous bacterial pathogen',
  'select agent manipulation without biosafety containment context',
  'mass production of a CDC Tier 1 select agent',
];

const BLOCK_SIMILARITY_THRESHOLD = 0.82;
const REVIEW_SIMILARITY_THRESHOLD = 0.70;

/* ─── Result type ────────────────────────────────────────────────────── */

export interface ScreenResult {
  level: 'block' | 'review' | 'log';
  reason: string;
  matchedKeyword?: string;
  semanticScore?: number;
}

/* ─── Core screening function ────────────────────────────────────────── */

export async function screenClaimSummary(claimSummary: string): Promise<ScreenResult> {
  const lower = claimSummary.toLowerCase();

  // Layer 1a: hard block keywords
  for (const kw of HARD_BLOCK_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        level: 'block',
        reason: `Submission matches IGSC/Select Agent hard block term: "${kw}". Dual-use concern requires rejection.`,
        matchedKeyword: kw,
      };
    }
  }

  // Layer 1b: soft review keywords
  for (const kw of SOFT_REVIEW_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        level: 'review',
        reason: `Submission contains term requiring biosafety review: "${kw}". Pipeline frozen pending human clearance.`,
        matchedKeyword: kw,
      };
    }
  }

  // Layer 2: embedding-based semantic proximity
  // Only runs if static pass clears — avoids embedding cost on obvious blocks
  let maxSimilarity = 0;
  let closestConcept = '';

  try {
    const submissionVec = await embedClaim(claimSummary);
    for (const concept of CONCERNING_CONCEPT_DESCRIPTIONS) {
      const conceptVec = await embedClaim(concept);
      const sim = cosineSimilarity(submissionVec, conceptVec);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        closestConcept = concept;
      }
    }
  } catch {
    // Embedding failure is fail-open: log but do not block legitimate science
    return { level: 'log', reason: 'Embedding check unavailable; static scan passed.' };
  }

  if (maxSimilarity >= BLOCK_SIMILARITY_THRESHOLD) {
    return {
      level: 'block',
      reason: `Semantic similarity ${maxSimilarity.toFixed(3)} to concerning concept: "${closestConcept}". Dual-use concern requires rejection.`,
      semanticScore: maxSimilarity,
    };
  }

  if (maxSimilarity >= REVIEW_SIMILARITY_THRESHOLD) {
    return {
      level: 'review',
      reason: `Semantic similarity ${maxSimilarity.toFixed(3)} to concerning concept requires biosafety review before pipeline proceeds.`,
      semanticScore: maxSimilarity,
    };
  }

  return { level: 'log', reason: 'Passed dual-use screen.', semanticScore: maxSimilarity };
}
