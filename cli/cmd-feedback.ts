// Bobot intent dan feedback: :weights, :reset, :stats, :export, :good, :bad, :fix
import { INTENTS, INTENT_NAME, getWeights, resetWeights, nudge, train, analyzeText } from "../src";
import type { WeightChange } from "../src";
import type { Intent } from "../src/types";
import type { Session } from "./session";
import { parseFix, printChanges } from "./format";

export function weights(): void {
  const W = getWeights();
  for (const i of INTENTS) {
    const parts = Object.entries(W[i]).filter(([, w]) => w > 0).map(([f, w]) => `${f}=${w.toFixed(2)}`);
    console.log(`  ${INTENT_NAME[i].padEnd(9)} ${parts.join("  ") || "(kosong)"}`);
  }
}

export async function reset(s: Session): Promise<void> {
  resetWeights();
  await s.store.resetWeights();
  console.log("Bobot dikembalikan ke nilai awal.");
}

export async function stats(s: Session): Promise<void> {
  console.log(await s.store.stats());
}

export async function exportTests(s: Session): Promise<void> {
  for (const r of await s.store.exportTests())
    console.log(`  [${JSON.stringify(r.input)}, ${JSON.stringify(r.expected)}],`);
}

/** :good, :bad, dan :fix. Hanya intent yang memakai bobot. */
export async function rate(s: Session, rest: string[], cmd: string): Promise<void> {
  const id = s.lastId;
  if (id === null) { console.log("Belum ada jawaban untuk dinilai."); return; }
  const trace = analyzeText(s.lastInput).trace;
  let changes: WeightChange[] = [];
  if (cmd === ":good") {
    await s.store.addFeedback(id, 1);
    changes = nudge(trace.x, trace.winner, +0.02); // perkuat prediksi yang benar
  } else if (cmd === ":bad") {
    await s.store.addFeedback(id, -1, undefined, rest.join(" ") || undefined);
    changes = nudge(trace.x, trace.winner, -0.02); // lemahkan prediksi yang salah
  } else {
    const { fix, error } = parseFix(rest);
    if (error || Object.keys(fix).length === 0) { console.log(error ?? "Beri minimal satu k=v."); return; }
    await s.store.addFeedback(id, -1, fix);
    if (fix.intent !== undefined && fix.intent !== trace.winner) {
      const r = train(trace.x, fix.intent as Intent);
      changes = r.changes;
      console.log(
        r.flipped
          ? `Prediksi berbalik ke "${INTENT_NAME[r.trace.winner]}" setelah ${r.steps} langkah.`
          : `Prediksi masih "${INTENT_NAME[r.trace.winner]}": fitur aktif belum cukup untuk membalikkannya.`
      );
    }
    const others = Object.keys(fix).filter((k) => k !== "intent");
    if (others.length) console.log(`(${others.join(", ")} dicatat untuk tes; hanya intent yang memakai bobot)`);
  }
  if (changes.length) {
    await s.store.saveWeights(changes.map((c) => ({ intent: c.intent, feature: c.feature, w: c.to })));
    printChanges(changes);
  }
  console.log(`Tersimpan untuk #${id} (${JSON.stringify(s.lastInput)}).`);
}