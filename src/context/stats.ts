// Hitungan konteks: prior tulisan tangan (SEEDS) + hitungan hasil belajar, dan skor kelas per tetangga.
import type { Pos, Tok } from "../types";

export interface CtxRow { prev: string; pos: string; next: string; n: number }

/**
 * Prior: (kelas kiri, kelas, bobot). Kanan "*" = apa saja. Cukup kuat supaya satu-dua kalimat
 * tidak langsung membaliknya, tapi tetap kalah oleh data yang berulang. Bobot dibagi menurut
 * seberapa sering kelas itu muncul di posisi tersebut (objek kata kerja paling sering kata benda).
 */
const SEED_TRIPLES: Array<[string, string, number]> = [
  ["pron", "verb", 5], ["aux", "verb", 5], ["polite", "verb", 5], ["conj", "verb", 5], ["det", "verb", 5],
  ["verb", "noun", 9], ["verb", "pron", 3], ["verb", "num", 2],
  ["prep", "noun", 7], ["prep", "pron", 3],
  ["noun", "adj", 5], ["num", "noun", 5], ["conj", "noun", 3], ["conj", "pron", 2],
];
const SEEDS: CtxRow[] = SEED_TRIPLES.map(([prev, pos, n]) => ({ prev, pos, next: "*", n }));

export const learned = new Map<string, CtxRow>();
export const key = (r: { prev: string; pos: string; next: string }) => `${r.prev}|${r.pos}|${r.next}`;

export function loadContext(rows: CtxRow[]): void {
  learned.clear();
  for (const r of rows) learned.set(key(r), { ...r });
}
export const resetContext = (): void => learned.clear();
export const contextRows = (): CtxRow[] => [...learned.values()].sort((a, b) => b.n - a.n);

/** Kelas tetangga: "^" / "$" di batas kalimat, "?" untuk kata asing. */
export function edges(toks: Tok[], i: number): { prev: string; next: string } {
  const side = (j: number, edge: string) => {
    const t = toks[j];
    if (!t || t.pos === "punct") return edge;
    return t.known ? t.pos : "?";
  };
  return { prev: side(i - 1, "^"), next: side(i + 1, "$") };
}

/** Skor tiap kelas: cocok kiri (2) + cocok kanan (1) + cocok keduanya (3), dikali hitungan. */
export function scores(prev: string, next: string, only?: readonly Pos[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of [...SEEDS, ...learned.values()]) {
    if (only && !only.includes(r.pos as Pos)) continue;
    const l = r.prev === prev, rt = r.next === next;
    const s = r.n * ((l ? 2 : 0) + (rt ? 1 : 0) + (l && rt ? 3 : 0));
    if (s > 0) out.set(r.pos, (out.get(r.pos) ?? 0) + s);
  }
  return out;
}
