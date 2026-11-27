// Memilih sense untuk seluruh kalimat, dan penjelasan skor satu kata.
import type { Pos, Tok, Trans } from "../types";
import { features } from "./features";
import { named } from "./names";
import { pick, score, senseVec } from "./weights";

export interface SenseTrace { word: string; feats: Record<string, number>; scores: Record<string, number>; winner: Pos }
export function explain(toks: Tok[], i: number): SenseTrace {
  const t = toks[i], feats = features(toks, i);
  const scores = Object.fromEntries(t.alts.map((p) => [p, score(t.id, p, feats)]));
  return { word: t.text, feats: named(feats), scores, winner: pick(t.id, t.alts, feats) };
}

/** Pengganti resolveAmbiguous di context.ts. Beberapa putaran supaya kata ambigu bertetangga saling memakai. */
export function resolveSenses(toks: Tok[], transOf: (t: Tok, pos: Pos) => Trans, rounds = 3): void {
  for (let r = 0; r < rounds; r++) {
    const snap = toks.map((t) => t.pos);               // keadaan lama
    const view = toks.map((t, i) => ({ ...t, pos: snap[i] }));
    const next = toks.map((t, i) => (t.alts.length < 2 ? t.pos : pick(t.id, t.alts, features(view, i))));
    let changed = false;
    toks.forEach((t, i) => {
      if (t.alts.length < 2) return;
      const f = features(view, i);
      const vec = senseVec(t.id, t.alts, f);
      const best = Object.entries(vec).sort((a, b) => b[1] - a[1])[0][0] as Pos;
      if (best !== t.pos) changed = true;
      t.pos = best;
      t.sense = vec;
      if (t.alts.length > 1) t.trans = transOf(t, next[i]);
    });
    if (!changed) break;
  }
}