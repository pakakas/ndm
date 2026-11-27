import { analyzeText } from "./features";
import { guess } from "./context";
import { CLASSES, Learned, describe } from "./learning";
import { Intent, Tok, type Pos, Poses } from "./types";
import { entryOf } from "./lexicon";
import { capability } from "./capability";
import { envOf } from "./env";
import { runTools } from "./tools";

import "../tools/math";
import "../tools/search/handler";
import { isLiteral } from "./tokenizer";
import { unknownGuess, unknownWord } from "./unknown";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function respond(raw: string, toks: Tok[], poses: Poses): string {
  const t = runTools(raw);
  console.debug('respond', {raw,toks,poses,t})
  if (t) return t.reply;
  const { f } = analyzeText(raw, poses);
  const unknown = toks ? (toks.find(t => t.pos === poses.unknown)?.text ?? null) : unknownWord(raw, poses);
  console.debug('respond', {f,unknown})
  if (unknown) {
    const g = unknownGuess(raw, poses);
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
      const vi = toks.findIndex((t) => t.pos === poses.verb);
      const v = toks[vi];
      const obj = toks.slice(vi + 1).find((t) => t.pos === poses.noun);
      const lit = toks.slice(vi + 1).find((t) => isLiteral(t.text));
      const e = obj && envOf(obj.text);
      if (e) return `Baik, saya akan ${v.lemma} ${obj.lemma} (${e.value}). Lanjutkan? (ya/tidak)`;
      if (obj) return `Baik, saya akan ${v.lemma} ${obj.lemma}${lit ? ` (${lit.text})` : ""}. Lanjutkan? (ya/tidak)`;
      if (v.trans === "trans") return `${cap(v.lemma)} apa?`;
      return `Baik, saya akan ${v.lemma}.`;
    }
    case Intent.Question:
      return capability(toks) ?? "Saya belum bisa menjawab pertanyaannya.";
    case Intent.Define:
    //   const target = toks.find((t) => t.known && t.pos !== "qword" && t.pos !== "det" && t.pos !== "punct" && t.text !== "arti");
    //   const e = target && entryOf(target.text);
    //   if (!e) return "Kata apa yang ingin dijelaskan?";
    //   const l: Learned = { word: e.word, pos: e.pos, trans: e.trans, aliasOf: e.aliasOf, extra: e.poss.slice(1) };
    //   return `"${e.word}": ${describe(l)}.`;
    // }
    case Intent.Other: {
      console.debug({toks})
      // Fragment = satu kata benda dikenal → anggap define
      const nouns = toks.filter(t => t.pos === poses.noun && t.known);
      if (f.sentence_type === "fragment" && nouns.length === 1) {
        const e = entryOf(nouns[0].text);
        if (e) {
          const l: Learned = { word: e.word, pos: e.pos, trans: e.trans, aliasOf: e.aliasOf, extra: e.poss.slice(1) };
          return `"${e.word}": ${describe(l)}.`;
        }
      }
    }
    default: {
      const nouns = toks.filter(t => t.known && t.pos === poses.noun);
      if (f.sentence_type === "fragment" && nouns.length >= 1) {
        const e = entryOf(nouns[0].text);
        if (e) {
          const l: Learned = { word: e.word, pos: e.pos, trans: e.trans, aliasOf: e.aliasOf, extra: e.poss.slice(1) };
          return `"${e.word}": ${describe(l)}.`;
        }
      }
      return "Maaf, saya belum paham. Bisa diulang dengan kalimat lain?";
    }
  }
}
