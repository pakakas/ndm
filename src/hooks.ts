import type { SQL } from "bun";

// Pipeline expose hook point. Tool yang mau auto-learn register di sini.
export type UnknownWordHook = (
  sql: SQL,
  word: string,
  ctx: string
) => Promise<{ pos: string; alts?: string[]; gloss?: string } | null>;

let hook: UnknownWordHook | null = null;

export function setUnknownWordHook(h: UnknownWordHook | null): void {
  hook = h;
}

// Dipanggil pipeline. Kalau tidak ada hook → null (word tetap unknown).
export async function tryLearn(sql: SQL, word: string, ctx: string) {
  return hook ? hook(sql, word, ctx) : null;
}   