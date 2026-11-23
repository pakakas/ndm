// Id angka untuk nama fitur attention. Kode dan DB memakai id; nama hanya untuk tulis tangan dan tampilan.
// ID TIDAK BOLEH BERGESER: tambah di ujung saja (head baru = nomor berikutnya, dimensi baru = nomor berikutnya).
export type Feat = number;
export type NamedWeights = Record<string, Record<string, number>>;
export type IdWeights = Record<string, Record<Feat, number>>;

const HEAD_ID: Record<string, number> = { prev: 0, next: 1, verb_right: 2, verb_left: 3, subject_left: 4, noun_right: 5 };
const DIM_ID: Record<string, number> = {
  verb: 0, noun: 1, adj: 2, adv: 3, pron: 4, num: 5, prep: 6, conj: 7, interj: 8, aux: 9, det: 10, polite: 11, qword: 12, unknown: 13,
}; // harus < 32
const SPECIAL_ID: Record<string, number> = {
  at_start: 1000, at_end: 1001, pron_then_verb: 1100, det_then_noun: 1101, aux_then_verb: 1102,
};

const invert = (m: Record<string, number>) => new Map(Object.entries(m).map(([k, v]) => [v, k]));
const HEAD_NAME = invert(HEAD_ID), DIM_NAME = invert(DIM_ID), SPECIAL_NAME = invert(SPECIAL_ID);

/** "verb_right.verb" -> id. Nama tidak dikenal = error saat start, jadi salah ketik ketahuan. */
export function featId(name: string): Feat {
  if (name in SPECIAL_ID) return SPECIAL_ID[name];
  const [h, d] = name.split(".");
  if (h in HEAD_ID && d in DIM_ID) return HEAD_ID[h] * 32 + DIM_ID[d];
  throw new Error(`fitur tidak dikenal: "${name}"`);
}

export function featName(id: Feat): string {
  const s = SPECIAL_NAME.get(id);
  if (s) return s;
  const h = HEAD_NAME.get(id >> 5), d = DIM_NAME.get(id & 31);
  return h && d ? `${h}.${d}` : `#${id}`;
}

/** Bobot tulisan tangan (nama) -> bobot berkunci id. */
export function compile(named: NamedWeights): IdWeights {
  const out: IdWeights = {};
  for (const [key, fs] of Object.entries(named)) {
    out[key] = {};
    for (const [name, w] of Object.entries(fs)) out[key][featId(name)] = w;
  }
  return out;
}