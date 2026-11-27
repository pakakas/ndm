import type { Pos } from "../src/types";

export function classifyPos(hits: Array<{ title: string; snippet: string }>): { pos: Pos; alts: Pos[]; gloss: string } | null {
  const text = hits.map(h => h.title + " " + h.snippet).join(" ");

  // 1. Eksplisit: "kata benda", "nomina", "noun"
  if (/kata benda|nomina|noun/i.test(text)) return { pos: "noun", alts: ["noun"], gloss: firstDef(hits) };
  if (/kata kerja|verba|verb/i.test(text)) return { pos: "verb", alts: ["verb"], gloss: firstDef(hits) };
  if (/kata sifat|adjektiva|adjective/i.test(text)) return { pos: "adj", alts: ["adj"], gloss: firstDef(hits) };
  if (/kata keterangan|adverbia|adverb/i.test(text)) return { pos: "adv", alts: ["adv"], gloss: firstDef(hits) };

  // 2. Pola definisi: "X adalah Y" → noun (benda/konsep)
  if (/\badalah\b/.test(text)) return { pos: "noun", alts: ["noun"], gloss: firstDef(hits) };

  // 3. "berarti" / "artinya" → noun
  if (/berarti|artinya/i.test(text)) return { pos: "noun", alts: ["noun"], gloss: firstDef(hits) };

  return null; // abstain — tidak bisa classify
}

function firstDef(hits: Array<{ title: string; snippet: string }>): string {
  const m = hits[0]?.snippet.match(/berarti\s+"([^"]+)"|artinya\s+"([^"]+)"/i);
  if (m) return m[1] ?? m[2] ?? "";
  return hits[0]?.snippet.slice(0, 100) ?? "";
}   