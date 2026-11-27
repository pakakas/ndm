// Mengenali "cari ..." sebagai pencarian internet dan mengambil kuerinya (deterministik, tanpa model).
//   "cariin geoffrey hinton"              -> geoffrey hinton
//   "tolong carikan info soal harga laptop di internet" -> harga laptop
//   "googling resep nasi goreng"          -> resep nasi goreng
// "cari" tanpa penanda internet hanya dianggap pencarian web kalau kata pertama kuerinya TIDAK dikenal
// (nama atau topik). "cari file laporan" tetap urusan bot lokal; tambahkan "di internet" untuk memaksa web.
import { analyze } from "../../src/morphology";

const CARI = /^(?:men)?cari(?:in|kan|lah)?$/;
const WEB_VERBS = new Set(["google", "googling", "telusuri", "search"]);
const LEADING = new Set(["tolong", "mohon", "coba", "bisa", "dapat", "saya", "aku", "kamu", "anda", "tentang", "mengenai", "soal", "info", "informasi"]);
const TRAILING = new Set(["dong", "deh", "sih", "nih", "ya"]);
const WEB_CUE = /\b(?:(?:di|ke|dari|lewat|via|pakai)\s+)?(?:internet|web|online|google|googling)\b/g;

export interface SearchQuery { query: string; web: boolean }

export function parseSearch(raw: string): SearchQuery | null {
  const words = raw.toLowerCase().match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
  const vi = words.findIndex((w) => CARI.test(w) || WEB_VERBS.has(w));
  if (vi < 0) return null;
  const explicit = WEB_VERBS.has(words[vi]);

  const rest = words.slice(vi + 1).join(" ");
  const web = explicit || WEB_CUE.test(rest);
  WEB_CUE.lastIndex = 0;
  const tokens = rest.replace(WEB_CUE, " ").split(/\s+/).filter(Boolean);
  while (tokens.length && LEADING.has(tokens[0])) tokens.shift();
  while (tokens.length && TRAILING.has(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;
  if (!web && analyze(tokens[0]) !== null) return null; // kata pertama dikenal: bukan nama/topik asing
  return { query: tokens.join(" "), web };
}
