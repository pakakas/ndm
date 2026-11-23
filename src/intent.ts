// Klasifikasi intent = fitur bernama (deterministik) x bobot 0..1 (bisa dilatih lewat RLHF).
//   - Nama fitur dan cara menghitungnya ditulis dalam kode (features.ts).
//   - Skor tiap intent = jumlah bobot fitur yang aktif. Tanpa fitur aktif, skornya 0.
//   - Bobot awal ditulis tangan (DEFAULT_WEIGHTS); :fix / :good / :bad mengubahnya.
import { Intent } from "./types";

/** Urutan juga menjadi pemecah seri: yang lebih awal menang kalau skor sama. */
export const INTENTS: Intent[] = [Intent.Error, Intent.Code, Intent.Smalltalk, Intent.Request, Intent.Question, Intent.Define, Intent.Other];

export const FEATURES = [
  "bias",
  "has_error_pattern",
  "looks_like_code",
  "all_interj",
  "smalltalk_phrase",
  "polite_and_verb",
  "ability_no_subject",
  "ability_with_subject",
  "has_qword",
  "has_question_mark",
  "has_verb",
  "imperative_form",
  "subject_omitted",
  "has_subject",
  "passive_voice",
  "multi_action",
  "is_fragment",
  "has_unknown",
  "asks_definition",
] as const;
export type FeatureName = (typeof FEATURES)[number];
export type FeatureVec = Record<FeatureName, 0 | 1>;
export type Weights = Record<Intent, Record<string, number>>;

export const DEFAULT_WEIGHTS: Weights = {
  [Intent.Error]:     { has_error_pattern: 1 },
  [Intent.Code]:      { looks_like_code: 1 },
  [Intent.Smalltalk]: { all_interj: 0.9, smalltalk_phrase: 1 },
  [Intent.Request]:   { polite_and_verb: 0.5, ability_no_subject: 0.3, imperative_form: 0.6, has_verb: 0.1, subject_omitted: 0.1 },
  [Intent.Question]:  { has_qword: 0.5, has_question_mark: 0.4, ability_with_subject: 0.3 },
  [Intent.Other]:     { bias: 0.25 },
  [Intent.Define]:    { asks_definition: 1.2 },
};

const clone = (w: Weights): Weights => JSON.parse(JSON.stringify(w));
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, round4(v)));

let W: Weights = clone(DEFAULT_WEIGHTS);

export const getWeights = (): Weights => W;
export const resetWeights = (): void => { W = clone(DEFAULT_WEIGHTS); };

/** Timpa bobot default dengan bobot yang tersimpan di database. */
export function loadWeights(rows: Array<{ intent: number; feature: string; w: number }>): void {
  for (const r of rows) {
    if (INTENTS.includes(r.intent as Intent)) W[r.intent as Intent][r.feature] = clamp01(r.w);
  }
}

export interface IntentTrace {
  x: FeatureVec;
  active: FeatureName[];
  scores: Record<Intent, number>;
  winner: Intent;
  confidence: number; // bagian skor pemenang dari total skor (0..1)
}

export function classify(x: FeatureVec): IntentTrace {
  const active = FEATURES.filter((f) => x[f] === 1);
  const scores = {} as Record<Intent, number>;
  for (const i of INTENTS) scores[i] = round4(active.reduce((s, f) => s + (W[i][f] ?? 0), 0));
  let winner = INTENTS[0];
  for (const i of INTENTS) if (scores[i] > scores[winner]) winner = i;
  if (scores[winner] <= 0) winner = Intent.Other; // tanpa skor sama sekali: bukan "error" (INTENTS[0])
  const total = INTENTS.reduce((s, i) => s + scores[i], 0);
  return { x, active, scores, winner, confidence: total > 0 ? round4(scores[winner] / total) : 0 };
}

// ── Pembaruan bobot dari feedback ──
export interface WeightChange { intent: Intent; feature: string; from: number; to: number }

function bump(changes: Map<string, WeightChange>, intent: Intent, feature: string, delta: number): void {
  const cur = W[intent][feature] ?? 0;
  const next = clamp01(cur + delta);
  if (next === cur) return;
  W[intent][feature] = next;
  const k = `${intent}.${feature}`;
  const prev = changes.get(k);
  changes.set(k, { intent, feature, from: prev ? prev.from : cur, to: next });
}

const finalize = (m: Map<string, WeightChange>) => [...m.values()].filter((c) => c.from !== c.to);

/** Koreksi: naikkan bobot fitur aktif untuk intent benar, turunkan untuk intent yang salah, sampai prediksi berbalik. */
export function train(x: FeatureVec, target: Intent, eta = 0.05, maxSteps = 40) {
  if (!INTENTS.includes(target)) throw new Error(`intent harus angka Intent, dapat: ${JSON.stringify(target)}`);
  const changes = new Map<string, WeightChange>();
  let steps = 0;
  while (steps < maxSteps) {
    const t = classify(x);
    if (t.winner === target) break;
    for (const f of t.active) {
      bump(changes, target, f, +eta);
      bump(changes, t.winner, f, -eta);
    }
    steps++;
  }
  const trace = classify(x);
  return { steps, flipped: trace.winner === target, changes: finalize(changes), trace };
}

/** Penguatan kecil (+) atau pelemahan kecil (-) untuk satu intent pada fitur yang aktif. */
export function nudge(x: FeatureVec, intent: Intent, delta: number): WeightChange[] {
  if (!INTENTS.includes(intent)) throw new Error(`intent harus angka Intent, dapat: ${JSON.stringify(intent)}`);
  const changes = new Map<string, WeightChange>();
  for (const f of FEATURES) if (x[f] === 1) bump(changes, intent, f, delta);
  return finalize(changes);
}