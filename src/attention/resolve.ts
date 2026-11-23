// Memilih sense untuk seluruh kalimat, dan penjelasan skor satu kata.
import type { Pos, Tok, Trans } from "../types";
import { features } from "./features";
import { named } from "./names";
import { pick, score, senseVec } from "./weights";

export interface SenseTrace { word: string; feats: Record<string, number>; scores: Record<string, number>; winner: Pos }
export function explain(toks: Tok[], i: number): SenseTrace {
  const t = toks[i], feats = features(toks, i);
  const scores = Object.fromEntries(t.alts.map((p) => [p, score(t.text, p, feats)]));
  return { word: t.text, feats: named(feats), scores, winner: pick(t.text, t.alts, feats) };
}

/**
 * Pengganti resolveAmbiguous di context.ts. Beberapa putaran supaya kata ambigu bertetangga saling memakai.
 * Tiap putaran membaca keadaan lama (salinan), baru menerapkan semuanya bersamaan.
 * Pemenang selalu dari pick() (seri -> kelas utama); senseVec hanya untuk tampilan.
 */
export function resolveSenses(toks: Tok[], transOf: (t: Tok, pos: Pos) => Trans, rounds = 3): void {
  for (let r = 0; r < rounds; r++) {
    const view = toks.map((t) => ({ ...t }));
    const out = toks.map((t, i) => {
      if (t.alts.length < 2) return null;
      const f = features(view, i);
      return { pos: pick(t.text, t.alts, f), vec: senseVec(t.text, t.alts, f) };
    });
    let changed = false;
    toks.forEach((t, i) => {
      const o = out[i];
      if (!o) return;
      if (o.pos !== t.pos) changed = true;
      t.pos = o.pos;
      t.sense = o.vec;
      t.trans = transOf(t, o.pos);
    });
    if (!changed) break;
  }
}