// Embedding dan head (hard attention): "cari token terdekat yang cocok".
import type { Tok } from "../types";

export type Vec = Record<string, number>;

export const POS_DIMS = ["verb", "noun", "adj", "adv", "pron", "num", "prep", "conj", "interj", "aux", "det", "polite", "qword", "unknown"];
const ALL: Vec = Object.fromEntries(POS_DIMS.map((d) => [d, 1]));

export interface Head {
  name: string;
  q: Vec;          // yang dicari
  k: Vec;          // yang ditawarkan token lain
  dir: -1 | 0 | 1; // -1 kiri, 1 kanan, 0 dua sisi
  maxDist: number;
}

export const HEADS: Head[] = [
  { name: "prev",         q: ALL,                 k: ALL,               dir: -1, maxDist: 1 },
  { name: "next",         q: ALL,                 k: ALL,               dir: 1,  maxDist: 1 },
  { name: "verb_right",   q: { verb: 2 },         k: { verb: 1 },        dir: 1,  maxDist: 99 },
  { name: "verb_left",    q: { verb: 2 },         k: { verb: 1 },        dir: -1, maxDist: 99 },
  { name: "subject_left", q: { pron: 2, noun: 1 }, k: { pron: 1, noun: 1 }, dir: -1, maxDist: 99 },
  { name: "noun_right",   q: { noun: 2 },         k: { noun: 1 },        dir: 1,  maxDist: 99 },
];

export const clauseBounds = (toks: Tok[], i: number): [number, number] => {
  const brk = (t: Tok) => t.pos === "conj" || t.pos === "punct";
  let lo = i, hi = i + 1;
  while (lo > 0 && !brk(toks[lo - 1])) lo--;
  while (hi < toks.length && !brk(toks[hi])) hi++;
  return [lo, hi];
};

/** Hard attention: token cocok (q·k > 0) dengan skor tertinggi = dot*10 - jarak. Seri -> yang paling kiri. */
export function attend(h: Head, E: Vec[], i: number, lo: number, hi: number): { j: number; v: Vec } | null {
  let best = -1, bestScore = -Infinity;
  for (let j = lo; j < hi; j++) {
    const d = j - i;
    if (d === 0 || Math.abs(d) > h.maxDist || (h.dir === -1 && d > 0) || (h.dir === 1 && d < 0)) continue;
    let dot = 0;
    for (const dim in h.q) dot += h.q[dim] * (h.k[dim] ?? 0) * (E[j][dim] ?? 0);
    if (dot <= 0) continue;
    const s = dot * 10 - Math.abs(d);
    if (s > bestScore) { best = j; bestScore = s; }
  }
  return best < 0 ? null : { j: best, v: E[best] };
}

/** Gerbang (lapisan tersembunyi yang bernama): AND dua fitur = relu(a + b - 1). */
export const GATES: Array<{ name: string; and: [string, string] }> = [
  { name: "pron_then_verb", and: ["prev.pron", "next.verb"] },
  { name: "det_then_noun",  and: ["prev.det", "next.noun"] },
  { name: "aux_then_verb",  and: ["prev.aux", "next.verb"] },
];
