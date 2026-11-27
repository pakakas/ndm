// Bobot (bilangan bulat; boleh negatif) dan skor sense. bobot umum (kata 0) tulisan tangan; bobot per kata hasil latihan.
import type { Pos } from "../types";
import { featId, posId, type Feats } from "./names";

/** Satu bobot, semuanya nomor: wordId 0 = berlaku untuk semua kata ("*"); pos dan feature dari names.ts. */
export interface SenseRow { wordId: number; pos: number; feature: number; w: number }

/** kunci (kata, kelas) -> nomor fitur -> bobot. Kunci = wordId * 64 + posId. */
export type SenseWeights = Record<number, Record<number, number>>;
type NamedWeights = Record<string, Record<string, number>>;
export const wkey = (wordId: number, pos: number): number => wordId * 64 + pos;

const DEFAULT_NAMED: NamedWeights = {
  "*|aux":  { "prev.pron": 5, "verb_right.verb": 6, pron_then_verb: 3 },
  "*|verb": { "prev.pron": 5, "prev.aux": 6, "prev.polite": 6, at_start: 3, "next.noun": 4, pron_then_verb: 3, aux_then_verb: 3 },
  "*|noun": { "prev.verb": 6, "prev.prep": 6, "prev.det": 5, "prev.num": 4, "next.verb": 3, "next.noun": 2, det_then_noun: 2 },
  "*|adj":  { "prev.noun": 5, at_end: 2 },
};
const DEFAULT: SenseWeights = Object.fromEntries(
  Object.entries(DEFAULT_NAMED).map(([k, fs]) => [
    wkey(0, posId(k.slice(2))), Object.fromEntries(Object.entries(fs).map(([n, w]) => [featId(n), w])),
  ])
);
const clone = (w: SenseWeights): SenseWeights => JSON.parse(JSON.stringify(w));
let W: SenseWeights = clone(DEFAULT);

export const getWeights = (): SenseWeights => W;
export const resetWeights = (): void => { W = clone(DEFAULT); };
export function loadWeights(rows: SenseRow[]): void {
  for (const r of rows) (W[wkey(r.wordId, r.pos)] ??= {})[r.feature] = Math.trunc(r.w);
}
export function weightRows(): SenseRow[] {
  return Object.entries(W).flatMap(([key, fs]) =>
    Object.entries(fs).map(([feature, w]) => ({ wordId: Math.floor(Number(key) / 64), pos: Number(key) % 64, feature: Number(feature), w }))
  );
}

// skor sense = 2 * W[kata, pos][fitur] + W[semua kata, pos][fitur], dijumlah atas fitur aktif
export function score(wordId: number, pos: Pos, f: Feats): number {
  const p = posId(pos);
  const own = (wordId > 0 ? W[wkey(wordId, p)] : undefined) ?? {}, gen = W[wkey(0, p)] ?? {};
  let s = 0;
  for (const k of Object.keys(f)) s += f[Number(k)] * (2 * (own[Number(k)] ?? 0) + (gen[Number(k)] ?? 0));
  return s;
}

export function pick(wordId: number, alts: Pos[], f: Feats): Pos {
  let best = alts[0];
  for (const p of alts) if (score(wordId, p, f) > score(wordId, best, f)) best = p; // seri -> lebih awal
  return best;
}

export function senseVec(wordId: number, alts: Pos[], f: Feats): Record<string, number> {
  const raw = Object.fromEntries(alts.map(p => [p, score(wordId, p, f)]));
  const max = Math.max(...Object.values(raw), 1);
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.round(v / max * 100) / 100])
  );
}
