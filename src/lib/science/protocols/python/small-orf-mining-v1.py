#!/usr/bin/env python3
"""
Sandbox/Pyodide reference implementation of small-orf-mining-v1.

Must produce *byte-identical* JSON to the TypeScript runner for the determinism
gate to pass. Reads {input.json} as argv[1], writes JSON to stdout.

No network. No filesystem outside /work. No random / time / locale-dependent
calls. The standard codon table and all parameters are baked in.
"""

import json
import sys
from collections import OrderedDict

CODON_TABLE = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}
START_CODONS = {"ATG", "GTG", "TTG"}
STOP_CODONS = {"TAA", "TAG", "TGA"}
COMPLEMENT = str.maketrans("ACGTNacgtn", "TGCANTGCAN")


def reverse_complement(seq: str) -> str:
    return seq.translate(COMPLEMENT)[::-1]


def translate(dna: str) -> str:
    return "".join(CODON_TABLE.get(dna[i:i + 3], "X") for i in range(0, len(dna) - 2, 3))


def codon_usage(seq: str):
    counts = {}
    total = 0
    for i in range(0, len(seq) - 2, 3):
        c = seq[i:i + 3]
        if "N" in c:
            continue
        counts[c] = counts.get(c, 0) + 1
        total += 1
    if total == 0:
        return {}
    return {k: v / total for k, v in counts.items()}


def codon_bias_z(orf_dna: str, bulk):
    counts = {}
    orf_total = 0
    for i in range(0, len(orf_dna) - 2, 3):
        c = orf_dna[i:i + 3]
        if "N" in c:
            continue
        counts[c] = counts.get(c, 0) + 1
        orf_total += 1
    if orf_total < 10:
        return 0.0
    chi2 = 0.0
    dof = 0
    for codon in CODON_TABLE:
        exp = bulk.get(codon, 0) * orf_total
        if exp < 0.5:
            continue
        obs = counts.get(codon, 0)
        chi2 += ((obs - exp) ** 2) / exp
        dof += 1
    if dof < 2:
        return 0.0
    return (chi2 - dof) / ((2 * dof) ** 0.5)


def scan_frame(seq: str, frame: int, min_aa: int, max_aa: int):
    hits = []
    i = frame
    seq_len = len(seq)
    while i < seq_len - 2:
        codon = seq[i:i + 3]
        if codon not in START_CODONS:
            i += 3
            continue
        j = i + 3
        while j < seq_len - 2:
            if seq[j:j + 3] in STOP_CODONS:
                break
            j += 3
        length_aa = (j - i) // 3
        if min_aa <= length_aa <= max_aa:
            protein_dna = seq[i:j]
            hits.append({
                "startNtInFrame": i,
                "endNtInFrame": j + 2,
                "startCodon": codon,
                "lengthAa": length_aa,
                "proteinSequence": translate(protein_dna),
                "proteinDna": protein_dna,
            })
        i = j + 3
    return hits


def run(inp):
    seq = inp["sequence"].upper()
    min_aa = int(inp.get("minAa", 20))
    max_aa = int(inp.get("maxAa", 100))
    z_threshold = float(inp.get("zThreshold", 2.0))
    window_start = int(inp["windowStart"])
    bulk = codon_usage(seq)

    all_hits = []
    for strand in ("+", "-"):
        working = seq if strand == "+" else reverse_complement(seq)
        for frame in range(3):
            for h in scan_frame(working, frame, min_aa, max_aa):
                z = codon_bias_z(h["proteinDna"], bulk)
                if z < z_threshold:
                    continue
                if strand == "+":
                    start_nt = window_start + h["startNtInFrame"]
                    end_nt = window_start + h["endNtInFrame"]
                else:
                    start_nt = window_start + len(seq) - h["endNtInFrame"] - 1
                    end_nt = window_start + len(seq) - h["startNtInFrame"] - 1
                all_hits.append({
                    "startNt": start_nt,
                    "endNt": end_nt,
                    "strand": strand,
                    "startCodon": h["startCodon"],
                    "lengthAa": h["lengthAa"],
                    "proteinSequence": h["proteinSequence"],
                    "codonBiasZ": round(z, 3),
                })

    all_hits.sort(key=lambda h: (h["startNt"], 0 if h["strand"] == "+" else 1))
    rounded = OrderedDict((k, round(bulk[k], 4)) for k in sorted(bulk.keys()))

    return {
        "genomeId": inp["genomeId"],
        "windowStart": window_start,
        "windowLengthNt": len(seq),
        "hits": all_hits,
        "bulkCodonUsage": rounded,
        "schemaVersion": 1,
    }


if __name__ == "__main__":
    with open(sys.argv[1]) as fh:
        inp = json.load(fh)
    json.dump(run(inp), sys.stdout, separators=(",", ":"), sort_keys=False)
