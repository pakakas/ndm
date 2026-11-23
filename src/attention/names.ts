// Nomor fitur (enum). Nama seperti "verb_right.verb" atau "pron_then_verb" dipetakan ke bilangan bulat.
// Dihitung di memori saja; database tetap menyimpan nama (terbaca dan tidak rusak kalau urutan berubah).
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
