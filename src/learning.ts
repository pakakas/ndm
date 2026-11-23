// Belajar dari penjelasan pengguna. Parser penjelasan juga deterministik (aturan).
// Kelas kata di sini sama dengan tipe `Pos` yang dipakai tagger dan parser klausa,
// jadi kata yang dipelajari langsung ikut aturan tata bahasa (kata hubung memecah
// klausa, kata tanya membuat kalimat tanya, dst.).
import { tokenize, tag } from "./tokenizer";
import { analyze } from "./morphology";
import { Pos, Trans } from "./types";

export interface Learned {
  word: string;
  pos: Pos;
  trans: Trans;
  aliasOf?: string; // kata yang sudah dikenal dan maknanya sama
  extra?: Pos[];    // kelas kata tambahan (kata dengan beberapa fitur)
}

/** Sumber tunggal: kelas kata tertanam, nama resmi, dan sinonimnya. */
export const CLASSES: Array<{ pos: Pos; label: string; names: string[] }> = [
  { pos: "verb",   label: "kata kerja",      names: ["kata kerja", "verba"] },
  { pos: "noun",   label: "kata benda",      names: ["kata benda", "nomina"] },
  { pos: "adj",    label: "kata sifat",      names: ["kata sifat", "adjektiva"] },
  { pos: "adv",    label: "kata keterangan", names: ["kata keterangan", "adverbia"] },
  { pos: "pron",   label: "kata ganti",      names: ["kata ganti", "pronomina"] },
  { pos: "num",    label: "kata bilangan",   names: ["kata bilangan", "numeralia"] },
  { pos: "prep",   label: "kata depan",      names: ["kata depan", "preposisi"] },
  { pos: "conj",   label: "kata hubung",     names: ["kata hubung", "kata sambung", "kata penghubung", "konjungsi"] },
  { pos: "interj", label: "kata seru",       names: ["kata seru", "interjeksi", "sapaan", "salam"] },
  { pos: "aux",    label: "kata bantu",      names: ["kata bantu", "verba bantu", "auksiliari"] },
  { pos: "det",    label: "kata penunjuk",   names: ["kata penunjuk", "penentu", "determiner", "artikel"] },
  { pos: "polite", label: "kata sopan",      names: ["kata sopan", "kata santun", "kata permohonan"] },
  { pos: "qword",  label: "kata tanya",      names: ["kata tanya", "interogatif"] },
];

const CONTENT_POS = new Set<Pos>(["verb", "noun", "adj", "adv", "pron", "num", "interj"]);
// Kata penghubung dalam kalimat penjelasan, bukan target alias.
const FILLER = new Set(["itu", "ini", "yang", "dengan"]);

const LABEL = new Map(CLASSES.map((c) => [c.pos, c.label]));
const CUE_RE = /\b(artinya|berarti|maksudnya|sama dengan|sinonim)\b|=/;
/**
 * "<kata> X ..." di mana X bermakna "itu" (lemma "itu"): isyarat penjelasan tanpa nama kelas.
 * Hanya "itu" yang tertanam; "adalah" dan sejenisnya berlaku setelah diajarkan sebagai alias "itu",
 * mis. ":edit adalah pos=det alias=itu".
 */
function copulaAfter(word: string, lower: string): boolean {
  const ws = lower.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  const i = ws.indexOf(word);
  return i >= 0 && i + 1 < ws.length && analyze(ws[i + 1])?.lemma === "itu";
}

/** Isyarat penjelasan, untuk dibuang sebelum menilai kata lain dalam penjelasan. */
export const CUE_G = /\b(artinya|berarti|maksudnya|sama dengan|sinonim)\b|=/g;

export function kelasList(): string[] {
  return CLASSES.map((c) => (c.names.length > 1 ? `${c.label} (${c.names.slice(1).join(", ")})` : c.label));
}

/** Cari penyebutan kelas kata. Yang pertama muncul menang; seri -> frasa terpanjang. */
function findClass(lower: string): { pos?: Pos; cleaned: string } {
  const hits: Array<{ pos: Pos; index: number; len: number }> = [];
  for (const c of CLASSES) {
    for (const n of c.names) {
      const re = new RegExp(`(?<![a-z])${n.replace(/\s+/g, "\\s+")}(?![a-z])`, "g");
      for (const m of lower.matchAll(re)) hits.push({ pos: c.pos, index: m.index!, len: m[0].length });
    }
  }
  if (!hits.length) return { cleaned: lower };
  hits.sort((a, b) => a.index - b.index || b.len - a.len);
  // Hapus nama kelas dari teks supaya "kata bantu" tidak dibaca sebagai alias ke verba "bantu".
  const chars = lower.split("");
  for (const h of hits) for (let i = h.index; i < h.index + h.len; i++) chars[i] = " ";
  return { pos: hits[0].pos, cleaned: chars.join("") };
}

/**
 * Pola yang dipahami:
 *   "x artinya kirim" / "x sama dengan file" / "x = kirim"   -> alias ke kata yang dikenal
 *   "x itu kata kerja [intransitif]" / "x adalah nomina"      -> deklarasi kelas kata
 *   gabungan: "x kata kerja, artinya kirim"
 * Teks tanpa nama kelas dan tanpa isyarat (artinya, sama dengan, =) bukan penjelasan -> null.
 * Alias hanya dipakai jika kelasnya sama dengan kelas yang dideklarasikan.
 */
export function parseExplanation(word: string, text: string): Learned | null {
  const w = word.toLowerCase();
  const lower = text.toLowerCase();

  const { pos: declared, cleaned } = findClass(lower);
  const intrans = /\bintransitif\b/.test(lower);

  // Harus ada isyarat bahwa ini penjelasan: nama kelas kata, atau "artinya / sama dengan / =".
  // Tanpa itu, kalimat biasa yang kebetulan memuat kata dikenal akan salah dibaca sebagai alias.
  if (!declared && !CUE_RE.test(lower) && !copulaAfter(w, lower)) return null;

  const known = tag(tokenize(cleaned)).filter(
    (t) => t.text !== w && t.known && t.pos !== "punct" && !FILLER.has(t.text) && !FILLER.has(t.lemma)
  );
  let target = known.find((t) => CONTENT_POS.has(t.pos)) ?? (known.length === 1 ? known[0] : undefined);
  if (target && declared && target.pos !== declared) target = undefined;

  if (!target && !declared) return null;

  const pos: Pos = declared ?? target!.pos;
  let trans: Trans = "none";
  if (pos === "verb") trans = intrans ? "intrans" : !declared && target?.pos === "verb" ? target.trans : "trans";

  return { word: w, pos, trans, aliasOf: target?.lemma };
}

/** Apakah teks tampak seperti usaha menjelaskan kata (menyebut kelas kata atau memakai artinya/sama dengan/=)? */
export function looksLikeExplanation(text: string, word?: string): boolean {
  const lower = text.toLowerCase();
  return findClass(lower).pos !== undefined || CUE_RE.test(lower) || (!!word && copulaAfter(word.toLowerCase(), lower));
}

export function describe(l: Learned): string {
  const part = (p: Pos) =>
    `${LABEL.get(p) ?? p}${p === "verb" ? ` ${l.trans === "intrans" ? "intransitif" : "transitif"}` : ""}`;
  const a = l.aliasOf ? `, sama dengan "${l.aliasOf}"` : "";
  return `${[l.pos, ...(l.extra ?? [])].map(part).join(" / ")}${a}`;
}

/** "verb", "kata_kerja", "verba", "kata kerja" -> "verb". */
export function resolvePos(input: string): Pos | null {
  const v = input.toLowerCase().replace(/_/g, " ").trim();
  for (const c of CLASSES) if (c.pos === v || c.names.includes(v)) return c.pos;
  return null;
}
