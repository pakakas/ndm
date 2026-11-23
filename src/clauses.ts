import { Bucket, Tok } from "./types";

export function segments(toks: Tok[]): Tok[][] {
  const segs: Tok[][] = [];
  let cur: Tok[] = [];
  const flush = () => { if (cur.length) segs.push(cur); cur = []; };
  for (const t of toks) {
    if (t.pos === "conj" || t.pos === "punct") flush();
    else cur.push(t);
  }
  flush();
  return segs;
}

export const verbIdx = (s: Tok[]) => s.findIndex((t) => t.pos === "verb");
export const hasVerb = (s: Tok[]) => verbIdx(s) >= 0;

export const hasSubject = (s: Tok[]) =>
  s.slice(0, verbIdx(s)).some((t) => t.pos === "pron" || t.pos === "noun");

export function hasObject(s: Tok[]): boolean {
  const rest = s.slice(verbIdx(s) + 1);
  const first = rest.find((t) => t.pos !== "adv" && t.pos !== "aux");
  return !!first && (first.pos === "noun" || first.pos === "pron" || first.pos === "num");
}

export const bucket = (n: number): Bucket => (n <= 1 ? "one" : n === 2 ? "two" : "three_or_more");
