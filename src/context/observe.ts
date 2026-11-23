// Belajar dari kalimat: kata yang dikenal dan tidak ambigu menambah hitungan.
import type { Tok } from "../types";
import { edges, key, learned, type CtxRow } from "./stats";

/** Mengembalikan selisih hitungan (untuk disimpan ke database). */
export function observe(toks: Tok[]): CtxRow[] {
  const delta = new Map<string, CtxRow>();
  toks.forEach((t, i) => {
    if (t.pos === "punct" || !t.known || t.alts.length > 1) return;
    const { prev, next } = edges(toks, i);
    if (prev === "?" || next === "?") return;
    const r = { prev, pos: t.pos, next };
    const k = key(r);
    const d = delta.get(k) ?? { ...r, n: 0 };
    d.n++;
    delta.set(k, d);
    const l = learned.get(k) ?? { ...r, n: 0 };
    l.n++;
    learned.set(k, l);
  });
  return [...delta.values()];
}
