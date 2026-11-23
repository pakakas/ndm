// Bobot (bilangan bulat; boleh negatif) dan skor sense. "*|pos" tulisan tangan; "kata|pos" hasil latihan.
import type { Pos } from "../types";
import { featId, featName, type Feats } from "./names";

/** kunci "kata|kelas" atau "*|kelas" -> nomor fitur -> bobot. */
export type SenseWeights = Record<string, Record<number, number>>;
type NamedWeights = Record<string, Record<string, number>>;

const DEFAULT_NAMED: NamedWeights = {
  "*|aux":  { "prev.pron": 5, "verb_right.verb": 6, pron_then_verb: 3 },
  "*|verb": { "prev.pron": 5, "prev.aux": 6, "prev.polite": 6, at_start: 3, "next.noun": 4, pron_then_verb: 3, aux_then_verb: 3 },
  "*|noun": { "prev.verb": 6, "prev.prep": 6, "prev.det": 5, "prev.num": 4, "next.verb": 3, "next.noun": 2, det_then_noun: 2 },
  "*|adj":  { "prev.noun": 5, at_end: 2 },
};
const DEFAULT: SenseWeights = Object.fromEntries(
  Object.entries(DEFAULT_NAMED).map(([k, fs]) => [k, Object.fromEntries(Object.entries(fs).map(([n, w]) => [featId(n), w]))])
);
const clone = (w: SenseWeights): SenseWeights => JSON.parse(JSON.stringify(w));
let W: SenseWeights = clone(DEFAULT);

export const getWeights = (): SenseWeights => W;
export const resetWeights = (): void => { W = clone(DEFAULT); };

type Row = { key: string; feature: string; w: number };

/** Muat bobot dari DB. Baris dengan fitur yang sudah tidak ada dilewati, bukan menghentikan start. */
export function loadWeights(rows: Row[]): void {
  for (const r of rows) {
    try {
      (W[r.key] ??= {})[featId(r.feature)] = Math.trunc(r.w);
    } catch {
      console.warn(`bobot dilewati, fitur tidak dikenal: ${r.key} ${r.feature}`);
    }
  }
}

/** Semua bobot, termasuk default tulisan tangan. Untuk ekspor atau debug, JANGAN untuk disimpan ke DB. */
export function weightRows(): Row[] {
  return Object.entries(W).flatMap(([key, fs]) => Object.entries(fs).map(([id, w]) => ({ key, feature: featName(Number(id)), w })));
}

/**
 * Hanya bobot hasil latihan ("kata|pos"). Default "*|pos" tidak ikut, supaya mengubah DEFAULT_NAMED
 * di kode tetap berpengaruh. Asumsi: trainSense hanya mengubah kunci "kata|pos", tidak pernah "*|pos".
 */
export function learnedRows(): Row[] {
  return weightRows().filter((r) => !r.key.startsWith("*|"));
}

// skor sense = 2 * W["kata|pos"][fitur] + W["*|pos"][fitur], dijumlah atas fitur aktif
export function score(word: string, pos: Pos, f: Feats): number {
  const own = W[`${word}|${pos}`] ?? {}, gen = W[`*|${pos}`] ?? {};
  let s = 0;
  for (const k of Object.keys(f)) s += f[Number(k)] * (2 * (own[Number(k)] ?? 0) + (gen[Number(k)] ?? 0));
  return s;
}

export function pick(word: string, alts: Pos[], f: Feats): Pos {
  let best = alts[0];
  for (const p of alts) if (score(word, p, f) > score(word, best, f)) best = p; // seri -> lebih awal
  return best;
}

export function senseVec(word: string, alts: Pos[], f: Feats): Record<string, number> {
  const raw = Object.fromEntries(alts.map(p => [p, score(word, p, f)]));
  const max = Math.max(...Object.values(raw), 1);
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.round(v / max * 100) / 100])
  );
}