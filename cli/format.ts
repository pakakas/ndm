// Pencetak dan pembaca argumen kecil yang dipakai banyak perintah.
import { analyzeText, INTENTS, INTENT_NAME, intentFromName } from "../src";
import type { WeightChange } from "../src";
import type { Features, Tok } from "../src/types";
import { FEATURE_KEYS } from "./help";

export function showDebug(input: string): void {
  const { f, toks, trace } = analyzeText(input);
  console.log("  fitur :", JSON.stringify({ ...f, intent: INTENT_NAME[f.intent] }));
  console.log(
    "  skor  :",
    INTENTS.map((i) => `${INTENT_NAME[i]}=${trace.scores[i].toFixed(2)}`).join(" "),
    `| yakin ${trace.confidence.toFixed(2)}`
  );
  console.log("  aktif :", trace.active.join(", "));
  console.log(
    "  token :",
    toks
      .map((t) => {
        const id = t.id ? `#${t.id}` : "";
        const lemma = t.lemma !== t.text ? `(${t.lemma}${t.lemmaId ? `#${t.lemmaId}` : ""})` : "";
        const alts = t.alts.length > 1 ? `[${t.alts.join("|")}]` : "";
        const sense = t.sense ? `{${Object.entries(t.sense).map(([p, v]) => `${p}=${v}`).join(",")}}` : "";
        return `${t.text}${id}/${t.pos}${alts}${sense}${lemma}${t.known ? "" : "?"}`;
      })
      .join(" ")
  );
  const unsure = unsureSenses(toks);
  if (unsure.length) console.log("  ragu  :", unsure.join(" | "));
}

/** Kata ambigu yang pemenangnya tipis (selisih skor ≤ batas): layak dilatih lewat :sense. */
export function unsureSenses(toks: Tok[], margin = 0.3): string[] {
  const out: string[] = [];
  for (const t of toks) {
    const v = Object.values(t.sense ?? {}).sort((a, b) => b - a);
    if (v.length > 1 && v[0] - v[1] <= margin)
      out.push(`"${t.text}" ragu antara ${Object.keys(t.sense!).join("/")}; latih dengan :sense ${t.text} <kelas>`);
  }
  return out;
}

export function parseFix(parts: string[]): { fix: Partial<Features>; error?: string } {
  const fix: Record<string, unknown> = {};
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i < 1) return { fix: {}, error: `format salah: "${p}" (pakai kunci=nilai)` };
    const k = p.slice(0, i);
    const v = p.slice(i + 1);
    if (!FEATURE_KEYS.includes(k as keyof Features))
      return { fix: {}, error: `kunci tidak dikenal: "${k}". Pilihan: ${FEATURE_KEYS.join(", ")}` };
    if (k === "intent") {
      const n = intentFromName(v);
      if (n === undefined) return { fix: {}, error: `intent tidak dikenal: "${v}". Pilihan: ${INTENTS.map((i) => INTENT_NAME[i]).join(", ")}` };
      fix.intent = n;
      continue;
    }
    fix[k] = v === "true" ? true : v === "false" ? false : v === "null" ? null : v;
  }
  return { fix: fix as Partial<Features> };
}

export function printChanges(ch: WeightChange[]): void {
  for (const c of ch.slice(0, 8)) console.log(`  bobot ${INTENT_NAME[c.intent]}.${c.feature}: ${c.from.toFixed(2)} -> ${c.to.toFixed(2)}`);
  if (ch.length > 8) console.log(`  ... dan ${ch.length - 8} perubahan lain`);
}

export const printHints = (lines: string[]) => lines.forEach((l) => console.log(`  [hint] ${l}`));