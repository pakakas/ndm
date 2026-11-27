import { resolveSenses } from "./attention";
import { LEX, transFor } from "./lexicon";
import { analyze, guessPos } from "./morphology";
import { Poses, Tok } from "./types";

export function tokenize(text: string): string[] {
  const t = text.toLowerCase()
  const raw = t.match(
    /(?<![a-z0-9_])(?:~|\.{1,2})?\/[a-z0-9_.\-]+(?:\/[a-z0-9_.\-]+)*|[a-z0-9_-]+(?:\.[a-z0-9_-]+)+|[a-z0-9]+(?:-[a-z0-9]+)*|[?!.,;]/g
  ) ?? [];
  return raw.map((w) => (w)).filter((w) => w !== "");
}

export const isLiteral = (w: string): boolean => /[./]/.test(w) && !/^\d+(\.\d+)+$/.test(w);

export function tag(words: string[], poses: Poses): Tok[] {
  const out: Tok[] = [];
  for (const w of words) {
    if (/^[?!.,;]$/.test(w)) {
      out.push({ text: w, lemma: w, pos: poses.punct, id: 0, lemmaId: 0, alts: [], trans: "none", known: true, repeat: 1 });
      continue;
    }
    let word = w;
    let repeat = 1;
    const red = /^(.+)-\1$/.exec(w); // buku-buku
    if (red) { word = red[1]; repeat = 2; }

    const prev = out[out.length - 1];
    if (prev && prev.pos !== poses.punct && prev.text === word) { // halo halo -> halo x2
      prev.repeat += repeat;
      continue;
    }

    if (isLiteral(word)) {
      out.push({ text: word, lemma: word, pos: poses.noun, id: 0, lemmaId: 0, alts: [], trans: "none", known: true, repeat });
      continue;
    }

    const m = analyze(word);
    if (m) {
      out.push({
        text: word, lemma: m.lemma, pos: poses[m.pos], id: m.id, lemmaId: m.lemmaId, alts: m.alts,
        trans: m.trans, voice: m.voice, known: true, repeat,
      });
    } else {
      out.push({ text: word, lemma: word, pos: guessPos(word, poses), id: 0, lemmaId: 0, alts: [], trans: "trans", known: false, repeat });
    }
  }
  // Kata dengan beberapa fitur kelas: pilih yang cocok dengan konteks kalimat.
  resolveSenses(out, (t, pos) => transFor(LEX.get(t.text)!, pos));
  return out;
}
