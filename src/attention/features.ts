// Fitur = keluaran head ("<head>.<dimensi>") + at_start / at_end + gerbang ReLU bernama.
// Di dalam, fitur berupa nomor (names.ts); nama hanya untuk tampilan dan database.
import type { Tok } from "../types";
import { GATES, HEADS, attend, clauseBounds, type Vec } from "./heads";
import { AT_END, AT_START, featId, type Feats } from "./names";

const relu = (x: number) => (x > 0 ? x : 0);
const GATE_IDS = GATES.map((g) => ({ id: featId(g.name), a: featId(g.and[0]), b: featId(g.and[1]) }));

export function features(toks: Tok[], i: number): Feats {
  const [lo, hi] = clauseBounds(toks, i);
  const E: Vec[] = toks.map((t) => ({ [t.pos]: 1 }));
  const f: Feats = {};
  if (i === lo) f[AT_START] = 1;
  if (i === hi - 1) f[AT_END] = 1;
  for (const h of HEADS) {
    const r = attend(h, E, i, lo, hi);
    if (r) for (const d in r.v) if (r.v[d]) f[featId(`${h.name}.${d}`)] = r.v[d];
  }
  for (const g of GATE_IDS) {
    const v = relu((f[g.a] ?? 0) + (f[g.b] ?? 0) - 1);
    if (v) f[g.id] = v;
  }
  return f;
}
