import { LEX, transFor } from "./lexicon";
import { Morph, Pos, Trans, Voice } from "./types";

const isVerb = (w: string) => !!LEX.get(w)?.poss.includes("verb");

export function stripPrefix(s: string): { lemma: string; voice: Voice } | null {
  const firstVerb = (cands: string[]) => cands.find(isVerb);
  let m: RegExpExecArray | null;

  if ((m = /^di(.+)$/.exec(s))) {
    const c = firstVerb([m[1]]);
    if (c) return { lemma: c, voice: "passive" };
  }

  // meN-: aturan peluluhan sebagai kandidat akar, divalidasi lewat leksikon
  const cands: string[] = [];
  if ((m = /^meny(.+)$/.exec(s))) cands.push("s" + m[1]);
  if ((m = /^meng(.+)$/.exec(s))) cands.push(m[1], "k" + m[1]);
  if ((m = /^menge(.+)$/.exec(s))) cands.push(m[1]);
  if ((m = /^men(.+)$/.exec(s))) cands.push(m[1], "t" + m[1]);
  if ((m = /^mem(.+)$/.exec(s))) cands.push(m[1], "p" + m[1]);
  if ((m = /^me(.+)$/.exec(s))) cands.push(m[1]);
  const a = firstVerb(cands);
  if (a) return { lemma: a, voice: "active" };

  if ((m = /^ber(.+)$/.exec(s)) || (m = /^be(.+)$/.exec(s))) {
    const c = firstVerb([m[1]]);
    if (c) return { lemma: c, voice: "active" };
  }
  if (isVerb(s)) return { lemma: s, voice: "base" };
  return null;
}

export function analyze(w: string): Morph | null {
  const d = LEX.get(w);
  if (d) {
    const lemma = d.aliasOf ?? w;
    return { id: d.id, lemma, lemmaId: LEX.get(lemma)?.id ?? d.id, pos: d.pos, trans: transFor(d, d.pos), alts: d.poss };
  }

  // klitik -nya / -ku / -mu
  const cl = /^(.{3,}?)(nya|ku|mu)$/.exec(w);
  if (cl) {
    const b = analyze(cl[1]);
    if (b) return b;
  }
  // partikel -lah / -kah
  const pt = /^(.{3,}?)(lah|kah)$/.exec(w);
  if (pt) {
    const b = analyze(pt[1]);
    if (b) return b;
  }
  // afiks verba, dengan dan tanpa sufiks -kan / -i
  const sf = /^(.{3,}?)(kan|in|i)$/.exec(w);
  const stems: Array<[string, string]> = [[w, ""]];
  if (sf) stems.push([sf[1], sf[2]]);
  for (const [s, suf] of stems) {
    const p = stripPrefix(s);
    if (p) {
      const base = LEX.get(p.lemma)!;
      const trans: Trans = suf ? "trans" : transFor(base, "verb");
      const lemma = base.aliasOf ?? p.lemma;
      return { id: base.id, lemma, lemmaId: LEX.get(lemma)?.id ?? base.id, pos: "verb", trans, alts: ["verb"], voice: p.voice };
    }
  }
  return null;
}

export function guessPos(w: string): Pos {
  if (/^\d+(\.\d+)*$/.test(w)) return "num";
  if (/^(me|di|ber)\w{3,}/.test(w)) return "verb"; // tebakan dari afiks
  return "unknown";
}
