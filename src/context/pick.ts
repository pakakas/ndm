// Memakai hitungan konteks: memilih kelas kata ambigu dan menebak kata asing.
import type { Pos, Tok } from "../types";
import { edges, scores } from "./stats";

/** Pilih satu dari beberapa kelas kata menurut konteks; seri atau tanpa data -> kelas utama. */
export function pickPos(alts: Pos[], prev: string, next: string): Pos {
  const s = scores(prev, next, alts);
  let best = alts[0];
  for (const p of alts) if ((s.get(p) ?? 0) > (s.get(best) ?? 0)) best = p;
  return best;
}

/** Atur ulang kelas kata ambigu dalam satu kalimat, dari kiri ke kanan. */
export function resolveAmbiguous(toks: Tok[], transOf: (t: Tok, pos: Pos) => Tok["trans"]): void {
  toks.forEach((t, i) => {
    if (t.alts.length < 2) return;
    const { prev, next } = edges(toks, i);
    const p = pickPos(t.alts, prev, next);
    t.pos = p;
    t.trans = transOf(t, p);
  });
}

/** Tebakan kelas untuk token ke-i, urut dari yang paling mungkin. */
export function guess(toks: Tok[], i: number): Array<{ pos: Pos; p: number }> {
  if (i < 0 || i >= toks.length) return [];
  const { prev, next } = edges(toks, i);
  const s = scores(prev, next);
  const total = [...s.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...s.entries()]
    .map(([pos, v]) => ({ pos: pos as Pos, p: Math.round((v / total) * 100) / 100 }))
    .sort((a, b) => b.p - a.p);
}
