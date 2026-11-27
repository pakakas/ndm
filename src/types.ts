export type Pos =
  | "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "conj" | "interj"
  | "num" | "aux" | "det" | "polite" | "qword" | "punct" | "unknown";
export type Trans = "none" | "intrans" | "trans";
export type Voice = "active" | "passive" | "base";
export type Bucket = "one" | "two" | "three_or_more";
export type Poses = Record<Pos, number>;

/**
 * Satu kata di leksikon. `id` = token id (stabil, sama dengan words.id di database).
 * Fitur kata bisa lebih dari satu: kelas kata (`poss`, yang pertama = utama) dan
 * transitivitas (`transitive` / `intransitive`, masing-masing satu tabel di database).
 */
export interface Entry {
  id: number;
  word: string;
  poss: Pos[];
  transitive: boolean;
  intransitive: boolean;
  aliasOf?: string; // kata yang maknanya sama; di database disimpan sebagai token id
  // turunan dari fitur di atas (kelas utama dan transitivitas kata kerja)
  pos: Pos;
  trans: Trans;
}

/** Bentuk yang disimpan ke database. */
export interface WordRecord {
  id: number;
  word: string;
  poss: Pos[];
  transitive: boolean;
  intransitive: boolean;
  aliasOf?: string;
  aliasId?: number;
}

export interface Morph {
  id: number;       // token id kata (atau akar kata untuk bentuk turunan)
  lemma: string;
  lemmaId: number;  // token id lemma (mengikuti alias)
  pos: Pos;
  trans: Trans;
  alts: Pos[];      // semua kelas kata yang mungkin
  voice?: Voice;
}
export interface Tok {
  text: string; lemma: string; pos: number; sense?: Record<string, number>;
  id: number; lemmaId: number; alts: Pos[];
  trans: Trans; voice?: Voice; known: boolean; repeat: number;
}

export type Language = "indonesian" | "english" | "mixed" | "other";
export const Intent = {
  Error: 0, Code: 1, Smalltalk: 2, Request: 3, Question: 4, Other: 5, Define: 6,
} as const; // angka tersimpan di DB: hanya boleh ditambah di ujung
export type Intent = (typeof Intent)[keyof typeof Intent];
export const INTENT_NAME: Record<Intent, string> = {
  [Intent.Error]: "error", [Intent.Code]: "code", [Intent.Smalltalk]: "smalltalk", [Intent.Request]: "request",
  [Intent.Question]: "question", [Intent.Other]: "other", [Intent.Define]: "define",
};
export const intentFromName = (s: string): Intent | undefined =>
  (Object.values(Intent) as Intent[]).find((i) => INTENT_NAME[i] === s);
export type SentenceType = "imperative" | "question" | "statement" | "fragment";

export interface Features {
  language: Language;
  intent: Intent;
  sentence_count: Bucket;
  sentence_type: SentenceType;
  clause_count: Bucket;
  subject_omitted: boolean | null;
  split_actions: boolean | null;
  object_shared: boolean | null;
}