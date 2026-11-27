import { Entry, Pos, Trans, WordRecord } from "./types";
import type { ToolWord } from "./tools";

export const LEX = new Map<string, Entry>();
let nextId = 1;

const externalWords = new Set<string>();

/** Kata kosakata tool jadi entri bawaan: tidak ikut :learned dan tidak bisa di-forget. */
export function applyToolWords(rows: ToolWord[]): void {
  for (const r of rows) {
    const e = mk(LEX.get(r.word)?.id ?? nextId++, r.word, r.poss, r.trans === "trans", r.trans === "intrans");
    LEX.set(r.word, e);
    BASE.set(r.word, e);
  }
}

export function applyExternal(entries: Array<[string, number | undefined]>): void {
  for (const w of externalWords) if (!BASE.has(w)) LEX.delete(w);
  externalWords.clear();
  for (const [w, id] of entries) {
    if (LEX.has(w)) continue; // jangan menimpa kata bawaan atau hasil ajaran
    const e = mk(id ?? nextId++, w, ["noun"], false, false);
    LEX.set(w, e);
    externalWords.add(w);
    if (e.id >= nextId) nextId = e.id + 1;
  }
}
export const isExternal = (w: string): boolean => externalWords.has(w);

/** Bangun Entry dari fitur. Kata kerja minimal punya satu transitivitas; kelas lain tidak punya. */
export function mk(
  id: number, word: string, poss: Pos[], transitive: boolean, intransitive: boolean, aliasOf?: string
): Entry {
  const verb = poss.includes("verb");
  let t = transitive, i = intransitive;
  if (verb && !t && !i) t = true;
  if (!verb) t = i = false;
  return {
    id, word, poss, transitive: t, intransitive: i, aliasOf,
    pos: poss[0],
    trans: poss[0] === "verb" ? (t ? "trans" : "intrans") : "none",
  };
}

/** Transitivitas kata untuk kelas tertentu (hanya bermakna untuk kata kerja). */
export function transFor(e: Entry, pos: number): Trans {
  if (pos !== "verb") return "none";
  return e.transitive ? "trans" : e.intransitive ? "intrans" : "none";
}

/** Menambah fitur: kata yang sama boleh muncul di beberapa daftar dan fiturnya digabung. */
function add(pos: Pos, words: string, trans?: Trans): void {
  for (const w of words.split(/\s+/).filter(Boolean)) {
    const cur = LEX.get(w);
    const poss = cur ? (cur.poss.includes(pos) ? cur.poss : [...cur.poss, pos]) : [pos];
    LEX.set(w, mk(cur?.id ?? nextId++, w, poss,
      !!cur?.transitive || trans === "trans", !!cur?.intransitive || trans === "intrans"));
  }
}

// add("interj", "halo hai hei hi selamat pagi siang sore malam terimakasih permisi");
// add("pron", "saya aku kamu anda dia kami kita mereka kalian");
// add("qword", "apa siapa mengapa kenapa bagaimana kapan dimana berapa apakah mana");
// add("conj", "dan lalu kemudian atau terus lantas serta");
// add("prep", "di ke dari pada untuk dengan");
// add("aux", "bisa dapat mau akan sedang sudah belum tidak bukan jangan");
// add("det", "yang itu ini");
// add("polite", "tolong mohon coba");
// add("adv", "sekarang nanti kemarin besok lagi saja ya iya");
// add("adj", "baru lama besar kecil baik");
// add("noun", "file laporan dokumen folder buku email pesan error kabar nama hari data gambar");
// add("verb", "kirim tulis hapus buka baca simpan cari tutup ambil lihat ubah salin pindah cetak bantu", "trans");
// add("verb", "pergi jalan tidur datang pulang", "intrans");
// // Kata dengan lebih dari satu fitur (kelas pertama = utama):
// add("verb", "pesan", "trans");   // pesan: kata benda, juga kata kerja ("pesan tiket")
// add("noun", "jalan tutup");      // jalan: kata kerja, juga kata benda; tutup: kata kerja, juga kata benda

export const EN_WORDS = new Set(
  "the a an is are was what how please send open delete read write hello hi can you me my this that and or to of in for".split(" ")
);

// Salinan leksikon bawaan, supaya kata bawaan yang diedit bisa dikembalikan.
const BASE = new Map(LEX);


// ── Token id ──
export const idOf = (word: string): number | undefined => LEX.get(word)?.id;

export function wordOf(id: number): string | undefined {
  for (const e of LEX.values()) if (e.id === id) return e.word;
  return undefined;
}

export const builtinForms = (): string[] => [...BASE.keys()];

/** Pakai id dari database (words.id) sebagai token id, supaya id stabil antar sesi. */
export function assignIds(map: Map<string, number>): void {
  const seen = new Set<Entry>();
  for (const m of [LEX, BASE]) {
    for (const e of m.values()) {
      if (seen.has(e)) continue;
      seen.add(e);
      const id = map.get(e.word);
      if (id !== undefined) e.id = id;
    }
  }
  for (const id of map.values()) if (id >= nextId) nextId = id + 1;
}

// ── Kata yang dipelajari saat runtime (dari penjelasan pengguna) ──
const learnedWords = new Set<string>();

export interface WordSpec { pos: Pos; trans: Trans; aliasOf?: string; extra?: Pos[] }

/** Ganti seluruh fitur kata. `id` diisi dari database; tanpa id, id lama atau id baru dipakai. */
export function learn(word: string, spec: WordSpec, id?: number): Entry {
  const cur = LEX.get(word);
  const poss = [...new Set([spec.pos, ...(spec.extra ?? [])])];
  const e = mk(id ?? cur?.id ?? nextId++, word, poss, spec.trans === "trans", spec.trans === "intrans", spec.aliasOf);
  LEX.set(word, e);
  learnedWords.add(word);
  if (e.id >= nextId) nextId = e.id + 1;
  return e;
}

/** Pulihkan kata dari database. */
export function restore(r: WordRecord): Entry {
  const e = mk(r.id, r.word, r.poss, r.transitive, r.intransitive, r.aliasOf);
  LEX.set(r.word, e);
  learnedWords.add(r.word);
  if (e.id >= nextId) nextId = e.id + 1;
  return e;
}

export function toRecord(e: Entry): WordRecord {
  return {
    id: e.id, word: e.word, poss: e.poss, transitive: e.transitive, intransitive: e.intransitive,
    aliasOf: e.aliasOf, aliasId: e.aliasOf ? idOf(e.aliasOf) : undefined,
  };
}

export function forget(word: string): boolean {
  if (!learnedWords.delete(word)) return false;
  const base = BASE.get(word);
  if (base) LEX.set(word, base); // kata bawaan yang pernah diedit kembali ke nilai awal
  else LEX.delete(word);
  return true;
}

export function knownWords(): string[] {
  return [...LEX.keys()];
}

export function learnedEntries(): Array<[string, Entry]> {
  return [...learnedWords].map((w) => [w, LEX.get(w)!] as [string, Entry]);
}

/** Kata fungsi (sapaan, kata ganti, tanya, bantu, hubung, depan, penunjuk, sopan, keterangan): tidak membawa isi. */
const FUNCTION_POS = new Set<Pos>(["interj", "pron", "qword", "conj", "prep", "aux", "det", "polite", "adv"]);
export const isFunctionWord = (word: string): boolean => {
  const e = LEX.get(word);
  return !!e && e.poss.every((p) => FUNCTION_POS.has(p));
};

export const entryOf = (word: string): Entry | undefined => LEX.get(word);
export const isBuiltin = (word: string): boolean => BASE.has(word);
export const isLearned = (word: string): boolean => learnedWords.has(word);
