// Pemilihan arti kata ambigu dan konteks harness: :sense, :env
import { analyzeText } from "../src";
import { features as senseFeatures, trainSense, explain as explainSense, resetWeights as resetSenseWeights } from "../src/attention";
import { resolvePos } from "../src/learning";
import { getEnv } from "../src/env";
import type { Session } from "./session";

export async function sense(s: Session, rest: string[]): Promise<void> {
  if (rest[0] === "reset") {
    resetSenseWeights();
    await s.store.resetSenseWeights();
    console.log("Bobot pemilihan arti dikembalikan ke nilai awal.");
    return;
  }
  if (!s.lastInput) { console.log("Belum ada kalimat. Ketik kalimat dulu."); return; }
  const { toks } = analyzeText(s.lastInput);
  const amb = toks.map((t, i) => [t, i] as const).filter(([t]) => t.alts.length > 1);
  if (!rest.length) {
    if (!amb.length) console.log("Tidak ada kata ambigu di kalimat terakhir.");
    for (const [, i] of amb) {
      const e = explainSense(toks, i);
      console.log(`  ${e.word}: ${Object.entries(e.scores).map(([p, sc]) => `${p}=${sc}`).join(" ")} -> ${e.winner}`);
      console.log(`    fitur: ${Object.keys(e.feats).sort().join(", ")}`);
    }
    return;
  }
  const w = rest[0].toLowerCase();
  const p = resolvePos(rest[1] ?? "");
  if (!p) { console.log("Pakai: :sense <kata> <kelas>   mis. :sense bisa noun"); return; }
  const hit = amb.find(([t]) => t.text === w);
  if (!hit) { console.log(`"${w}" tidak ambigu di kalimat terakhir.`); return; }
  const [t, i] = hit;
  if (!t.alts.includes(p)) { console.log(`"${w}" hanya punya kelas: ${t.alts.join(", ")}.`); return; }
  if (!t.id) { console.log(`"${w}" belum punya token id, tidak bisa dilatih.`); return; }
  const r = trainSense(t.id, t.alts, senseFeatures(toks, i), p);
  if (r.changes.length) await s.store.saveSenseWeights(r.changes.map((c) => ({ wordId: c.wordId, pos: c.pos, feature: c.feature, w: c.to })));
  console.log(
    r.flipped
      ? `"${w}" sekarang dibaca ${p} (${r.steps} langkah, ${r.changes.length} bobot berubah).`
      : `Belum berbalik: fitur yang aktif tidak cukup untuk membalikkannya.`
  );
}

export function env(): void {
  const items = getEnv();
  if (!items.length) console.log("Tidak ada konteks harness.");
  for (const e of items) console.log(`  ${e.label.padEnd(10)} ${e.kind.padEnd(9)} ${e.value}`);
}
