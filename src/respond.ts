import { analyzeText } from "./features";
import { guess } from "./context";
import { CLASSES, Learned, describe } from "./learning";
import { calc } from "./math";
import { Intent, type Pos } from "./types";
import { entryOf } from "./lexicon";
import { capability } from "./capability";
import { envOf } from "./env";
import { runTools } from "./tools";

import "./math";
import "./search/handler";
import { isLiteral } from "./tokenizer";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Kata asing pertama yang perlu dijelaskan pengguna, atau null. */
export function unknownWord(raw: string): string | null {
  if (runTools(raw)) return null;
  const { f, toks } = analyzeText(raw);
  if (f.intent === Intent.Error || f.intent === Intent.Code || f.intent === Intent.Smalltalk) return null;
  return toks.find((t) => t.pos === "unknown")?.text ?? null;
}

/** Tebakan kelas kata asing dari konteks (hanya jika cukup yakin), atau null. */
export function unknownGuess(raw: string): { word: string; pos: Pos; p: number } | null {
  const word = unknownWord(raw);
  if (!word) return null;
  const { toks } = analyzeText(raw);
  const g = guess(toks, toks.findIndex((t) => t.pos === "unknown" && t.text === word))[0];
  return g && g.p >= 0.5 ? { word, pos: g.pos, p: g.p } : null;
}

export function respond(raw: string): string {
  const t = runTools(raw);
  if (t) return t.reply;
  const { f, toks } = analyzeText(raw);
  const unknown = unknownWord(raw);
  if (unknown) {
    const g = unknownGuess(raw);
    if (g) {
      const label = CLASSES.find((c) => c.pos === g.pos)?.label ?? g.pos;
      return `Saya belum mengenal kata "${unknown}". Dari konteks, mungkin ${label} (${Math.round(g.p * 100)}%). Benar? Jawab "ya", atau jelaskan.`;
    }
    return `Saya belum mengenal kata "${unknown}". Bisa dijelaskan?`;
  }

  switch (f.intent) {
    case Intent.Smalltalk:
      return "Halo! Ada yang bisa saya bantu?";
    case Intent.Error:
      return "Saya melihat ada pesan error. Apa yang Anda lakukan sebelum error ini muncul?";
    case Intent.Code:
      return "Itu terlihat seperti kode. Apa yang ingin Anda lakukan dengannya?";
    case Intent.Request: {
      const vi = toks.findIndex((t) => t.pos === "verb");
      const v = toks[vi];
      const obj = toks.slice(vi + 1).find((t) => t.pos === "noun");
      const lit = toks.slice(vi + 1).find((t) => isLiteral(t.text));
      const e = obj && envOf(obj.text);
      if (e) return `Baik, saya akan ${v.lemma} ${obj.lemma} (${e.value}). Lanjutkan? (ya/tidak)`;
      if (obj) return `Baik, saya akan ${v.lemma} ${obj.lemma}${lit ? ` (${lit.text})` : ""}. Lanjutkan? (ya/tidak)`;
      if (v.trans === "trans") return `${cap(v.lemma)} apa?`;
      return `Baik, saya akan ${v.lemma}.`;
    }
    case Intent.Question:
      return capability(toks) ?? "Saya belum bisa menjawab pertanyaannya.";
    case Intent.Define: {
      const target = toks.find((t) => t.known && t.pos !== "qword" && t.pos !== "det" && t.pos !== "punct" && t.text !== "arti");
      const e = target && entryOf(target.text);
      if (!e) return "Kata apa yang ingin dijelaskan?";
      const l: Learned = { word: e.word, pos: e.pos, trans: e.trans, aliasOf: e.aliasOf, extra: e.poss.slice(1) };
      return `"${e.word}": ${describe(l)}.`;
    }
    default:
      return "Maaf, saya belum paham. Bisa diulang dengan kalimat lain?";
  }
}