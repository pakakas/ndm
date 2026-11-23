// Perintah untuk apa yang sudah dipelajari: :kelas, :learned, :forget, :konteks
import { kelasList, learnedEntries, describe, transFor, forget, isBuiltin, resetContext, contextRows } from "../src";
import type { Session } from "./session";

export function kelas(): void {
  console.log(kelasList().map((k) => `  ${k}`).join("\n"));
}

export async function learned(s: Session): Promise<void> {
  const why = await s.store.explanations();
  const all = learnedEntries();
  if (!all.length) console.log("Belum ada kata yang dipelajari.");
  for (const [w, e] of all)
    console.log(`  ${w} #${e.id}: ${describe({ word: w, pos: e.pos, trans: transFor(e, "verb"), aliasOf: e.aliasOf, extra: e.poss.slice(1) })}  <- "${why.get(w) ?? ""}"`);
}

export async function forgetCmd(s: Session, rest: string[]): Promise<void> {
  const w = rest[0]?.toLowerCase();
  if (!w) { console.log("Pakai: :forget <kata>"); return; }
  const a = await s.store.forgetWord(w);
  forget(w);
  console.log(a ? (isBuiltin(w) ? `"${w}" dikembalikan ke nilai bawaan.` : `"${w}" dilupakan.`) : `"${w}" tidak ada di daftar yang dipelajari atau diedit.`);
}

export async function konteks(s: Session, rest: string[]): Promise<void> {
  if (rest[0] === "reset") {
    resetContext();
    await s.store.resetContext();
    console.log("Hitungan konteks dihapus (prior bawaan tetap).");
    return;
  }
  const rows = contextRows();
  if (!rows.length) console.log("Belum ada konteks yang dipelajari. Bicaralah dengan kalimat yang semua katanya dikenal.");
  for (const r of rows.slice(0, 15)) console.log(`  ${r.prev} _ ${r.next}: ${r.pos} x${r.n}`);
  if (rows.length > 15) console.log(`  ... dan ${rows.length - 15} baris lain`);
}
