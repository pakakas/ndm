// Pelatihan diskret (perceptron, langkah ±1). Tanpa acak.
import type { Pos } from "../types";
import { featName, type Feats } from "./names";
import { getWeights, pick } from "./weights";

export interface Change { key: string; feature: string; from: number; to: number }

export function trainSense(word: string, alts: Pos[], f: Feats, target: Pos, maxSteps = 40) {
  const W = getWeights();
  const ch = new Map<string, Change>();
  const bump = (key: string, feat: number, d: number) => {
    const row = (W[key] ??= {});
    const from = row[feat] ?? 0;
    row[feat] = from + d;
    const k = `${key}.${feat}`;
    ch.set(k, { key, feature: featName(feat), from: ch.get(k)?.from ?? from, to: row[feat] });
  };
  let steps = 0;
  while (steps < maxSteps && pick(word, alts, f) !== target) {
    const win = pick(word, alts, f);
    for (const feat of Object.keys(f).map(Number).sort((a, b) => a - b)) {
      bump(`${word}|${target}`, feat, +1);
      bump(`${word}|${win}`, feat, -1);
    }
    steps++;
  }
  return { steps, flipped: pick(word, alts, f) === target, changes: [...ch.values()].filter((c) => c.from !== c.to) };
}
