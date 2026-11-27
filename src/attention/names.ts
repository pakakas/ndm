// Nomor fitur (enum). Nama seperti "verb_right.verb" atau "pron_then_verb" dipetakan ke bilangan bulat.
// Nomor disimpan di database (tabel enum_names mencatat nama tiap nomor dan menjaga supaya tidak bergeser).
// ATURAN: daftar HEADS, POS_DIMS, GATES, dan POS_LIST hanya boleh ditambah di AKHIR, jangan diurutkan ulang.
// Urutan: 1 at_start, 2 at_end, lalu tiap head x tiap kelas, lalu tiap gerbang; nama lain (dari DB) menyusul.
import { GATES, HEADS, POS_DIMS } from "./heads";

/** Fitur satu kata: nomor fitur -> nilai. */
export type Feats = Record<number, number>;

const names: string[] = [""]; // nomor 0 tidak dipakai
const ids = new Map<string, number>();

export function featId(name: string): number {
  let id = ids.get(name);
  if (id === undefined) { id = names.length; names.push(name); ids.set(name, id); }
  return id;
}
export const featName = (id: number): string => names[id] ?? `#${id}`;
export const featNames = (): string[] => names.slice(1);

/** Fitur dengan nama (untuk ditampilkan). */
export const named = (f: Feats): Record<string, number> =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [featName(Number(k)), v]));

export const AT_START = featId("at_start");
export const AT_END = featId("at_end");
for (const h of HEADS) for (const d of POS_DIMS) featId(`${h.name}.${d}`);
for (const g of GATES) featId(g.name);

// ── Kelas kata sebagai nomor (1-based; 0 = "semua kelas") ──
export const POS_LIST = [
  "noun", "verb", "adj", "adv", "pron", "prep", "conj", "interj", "num", "aux", "det", "polite", "qword", "op", "punct", "unknown",
] as const;
export const posId = (p: string): number => POS_LIST.indexOf(p as (typeof POS_LIST)[number]) + 1; // 0 = tidak dikenal
export const posName = (id: number): string => POS_LIST[id - 1] ?? `#${id}`;

/** Jenis daftar nama di tabel enum_names (kolom kind). */
export const ENUM_KIND = { feature: 1, pos: 2 } as const;
