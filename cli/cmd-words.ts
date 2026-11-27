// Perintah untuk satu kata: :kata, :edit, :id
import { entryOf, isBuiltin, isLearned, describe, transFor, idOf, wordOf, analyze, parseEdit, analyzeText, featureDiff } from "../src";
import { isExternal } from "../src/lexicon";
import type { Session } from "./session";
import { converse } from "./converse";
import { printHints } from "./format";

export function kata(_s: Session, rest: string[]): void {
  const w = rest[0]?.toLowerCase();
  if (!w) { console.log("Pakai: :kata <kata>"); return; }
  const e = entryOf(w);
  if (e) {
    const src = isExternal(w) ? "harness" : isLearned(w) ? (isBuiltin(w) ? "bawaan, sudah diedit" : "dipelajari") : "bawaan";
    console.log(`  ${w} #${e.id}: ${describe({ word: w, pos: e.pos, trans: transFor(e, "verb"), aliasOf: e.aliasOf, extra: e.poss.slice(1) })}  [${src}]`);
    const tables = [
      `word_pos(${e.poss.join(", ")})`,
      ...(e.transitive ? ["transitive_verb"] : []),
      ...(e.intransitive ? ["intransitive_verb"] : []),
      ...(e.aliasOf ? [`word_alias -> #${idOf(e.aliasOf)} ${e.aliasOf}`] : []),
    ];
    console.log(`    tabel: ${tables.join("; ")}`);
  } else {
    const m = analyze(w);
    if (m) console.log(`  ${w}: bentuk turunan -> lemma "${m.lemma}" #${m.lemmaId}, ${describe({ word: m.lemma, pos: m.pos, trans: m.trans })}${m.voice ? `, ${m.voice}` : ""}`);
    else console.log(`  "${w}" belum dikenal. Tambahkan dengan :edit ${w} pos=verb trans=trans`);
  }
}

export async function edit(s: Session, rest: string[]): Promise<void> {
  const [w0, ...kv] = rest;
  if (!w0) { console.log("Pakai: :edit <kata> pos=verb trans=trans alias=kirim"); return; }
  const { learned, error } = parseEdit(w0, kv);
  if (error || !learned) { console.log(error); return; }
  const before = s.lastInput ? analyzeText(s.lastInput).f : null;
  // await teach(s, learned, `edit manual: ${kv.join(" ")}`);
  console.log(`"${learned.word}" sekarang: ${describe(learned)}.`);
  if (s.rlhf && before) printHints([`Efek pada "${s.lastInput}": ${featureDiff(before, analyzeText(s.lastInput).f)}`]);
  if (s.pending?.word === learned.word) {
    const p = s.pending;
    s.pending = null;
    console.log("Mengulang pesan tadi:");
    await converse(s, p.input);
  }
}

export function idCmd(_s: Session, rest: string[]): void {
  const q = rest[0]?.toLowerCase();
  if (!q) { console.log("Pakai: :id <kata|angka>"); return; }
  if (/^\d+$/.test(q)) {
    const w = wordOf(Number(q));
    console.log(w ? `  #${q} = ${w}` : `  token id ${q} tidak ada`);
  } else {
    const id = idOf(q);
    console.log(id ? `  ${q} = #${id}` : `  "${q}" belum punya token id`);
  }
}
