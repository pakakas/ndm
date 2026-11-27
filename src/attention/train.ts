// Pelatihan diskret (perceptron, langkah ±1). Tanpa acak.
import type { Pos } from "../types";
import type { Feats } from "./names";
import { getWeights, pick, wkey } from "./weights";
import { posId } from "./names";

/** Perubahan satu bobot; bentuknya sama dengan SenseRow ditambah nilai lama. */
export interface Change { wordId: number; pos: number; feature: number; from: number; to: number }

/** wordId harus > 0: pelatihan hanya mengubah bobot milik satu kata, tidak pernah bobot umum. */
export function trainSense(wordId: number, alts: Pos[], f: Feats, target: Pos, maxSteps = 40) {
  if (wordId <= 0) throw new Error("trainSense: kata tanpa token id");
  const W = getWeights();
  const ch = new Map<string, Change>();
  const bump = (pos: Pos, feat: number, d: number) => {
    const row = (W[wkey(wordId, posId(pos))] ??= {});
    const from = row[feat] ?? 0;
    row[feat] = from + d;
    const k = `${pos}.${feat}`;
    ch.set(k, { wordId, pos: posId(pos), feature: feat, from: ch.get(k)?.from ?? from, to: row[feat] });
  };
  let steps = 0;
  while (steps < maxSteps && pick(wordId, alts, f) !== target) {
    const win = pick(wordId, alts, f);
    for (const feat of Object.keys(f).map(Number).sort((a, b) => a - b)) {
      bump(target, feat, +1);
      bump(win, feat, -1);
    }
    steps++;
  }
  return { steps, flipped: pick(wordId, alts, f) === target, changes: [...ch.values()].filter((c) => c.from !== c.to) };
}
