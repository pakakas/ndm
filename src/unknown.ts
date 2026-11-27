import { guess } from "./context";
import { analyzeText } from "./features";
import { runTools } from "./tools";
import { Intent, Pos, Poses, Tok } from "./types";

export function unknownWordFromToks(toks: Tok[]): string | null {
  return toks.find(t => !t.known && t.pos !== "punct")?.text || null;
}

/** Kata asing pertama yang perlu dijelaskan pengguna, atau null. */
export function unknownWord(raw: string, poses: Poses): string | null {
  if (runTools(raw)) return null;
  const { f, toks } = analyzeText(raw, poses);
  if (f.intent === Intent.Error || f.intent === Intent.Code || f.intent === Intent.Smalltalk) return null;
  return toks.find((t) => t.pos === "unknown")?.text ?? null;
}

/** Tebakan kelas kata asing dari konteks (hanya jika cukup yakin), atau null. */
export function unknownGuess(raw: string, poses: Poses): { word: string; pos: Pos; p: number } | null {
  const word = unknownWord(raw, poses);
  if (!word) return null;
  const { toks } = analyzeText(raw, poses);
  const g = guess(toks, toks.findIndex((t) => t.pos === "unknown" && t.text === word))[0];
  return g && g.p >= 0.5 ? { word, pos: g.pos, p: g.p } : null;
}
