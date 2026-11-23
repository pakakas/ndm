// Matematika dasar, deterministik dan tanpa eval.
//   - Aritmetika: + - * / ( ), dan kata tertanam: tambah, kurang, kali, bagi (juga ditambah, dikali, ...).
//   - Daftar angka: jumlah, rata-rata, maksimum, minimum, urutkan.
//   - Pertanyaan tanpa angka tentang matematika -> penjelasan singkat.
// Satu kata per konsep berasal dari seed (tabel seed_math di DB; nilai awal di seed.ts); sinonim harus diajarkan.
//
// Routing lewat ajaran: setiap kata dinormalkan ke lemma lewat leksikon (analyze), jadi kata yang
// kamu ajarkan ikut terbaca, mis. "math artinya matematika", "plus artinya tambah", "total artinya jumlah", "x artinya kali".
//
// Kata fungsi (berapa, tolong, bisa, dan, ...) diabaikan; daftarnya diambil dari kelas kata di leksikon.
// Ketat: kalau soal berangka memuat kata isi yang tidak dikenal, calc() mengembalikan null supaya
// kalimat biasa ("kirim 3 file") tetap lewat jalur lama. Desimal pakai titik; koma = pemisah daftar.
import { isFunctionWord } from "./lexicon";
import { registerHandler, roleOf } from "./tools";
import { analyze } from "./morphology";

type Agg = "sum" | "avg" | "max" | "min" | "sort";
type Dir = "asc" | "desc";
const AGG_RUN: Record<Agg, (n: number[], dir: Dir) => string> = {
  sum: (n) => `Jumlah: ${fmt(n.reduce((a, b) => a + b, 0))}`,
  avg: (n) => `Rata-rata: ${fmt(n.reduce((a, b) => a + b, 0) / n.length)}`,
  max: (n) => `Maksimum: ${fmt(Math.max(...n))}`,
  min: (n) => `Minimum: ${fmt(Math.min(...n))}`,
  sort: (n, dir) => `Terurut ${dir === "desc" ? "turun" : "naik"}: ${[...n].sort((a, b) => (dir === "desc" ? b - a : a - b)).map(fmt).join(", ")}`,
};

const HELP =
  "Bisa, untuk hitungan dasar. Coba: 0 + 10 + 5, 10 dibagi 4, atau jumlah 0, 10, 5 (juga rata-rata, maksimum, minimum, urutkan).";

const TOK = /\d+(?:\.\d+)?|[+\-*/()×÷]|[a-z]+(?:-[a-z]+)*/g;

export const fmt = (v: number): string =>
  Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);

class DivZero extends Error {}

function canon(w: string): string {
  return analyze(w)?.lemma ?? w;
}

function evaluate(tokens: string[]): number {
  let i = 0;
  const peek = () => tokens[i];
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[i++];
      const r = factor();
      if (op === "/") {
        if (r === 0) throw new DivZero();
        v /= r;
      } else v *= r;
    }
    return v;
  };
  const factor = (): number => {
    const t = tokens[i++];
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (t === "(") {
      const v = expr();
      if (tokens[i++] !== ")") throw new SyntaxError("kurung");
      return v;
    }
    if (t !== undefined && /^\d/.test(t)) return Number(t);
    throw new SyntaxError("token");
  };
  const v = expr();
  if (i !== tokens.length) throw new SyntaxError("sisa");
  return v;
}

/** Jawaban matematika dasar, atau null kalau teks ini bukan soal hitungan. */
export function calc(raw: string): string | null {
  const s = raw.toLowerCase();
  if (/\d-\d+-\d/.test(s)) return null; // tanggal seperti 2026-11-22
  if (s.replace(TOK, " ").replace(/[\s?!=.,;]/g, "") !== "") return null; // ada karakter asing

  const toks = s.match(TOK) ?? [];
  const isNum = (t?: string) => t !== undefined && /^\d/.test(t);

  const items: string[] = []; // angka, operator, kurung
  let agg: Agg | undefined;
  let dir: Dir = "asc";
  let topic = false;
  let foreign = false;

  toks.forEach((t) => {
    if (isNum(t) || t === "(" || t === ")" || "+-*/".includes(t)) return void items.push(t);
    if (t === "×") return void items.push("*");
    if (t === "÷") return void items.push("/");
    const c = canon(t);
    if (c === "") return;
    const role = roleOf("math", c);
    if (role === "topic") topic = true;
    else if (role === "asc" || role === "desc") dir = role; // arah urutan: dari seed, bukan kode
    else if (role && role.length === 1) items.push(role); // + - * /
    else if (role) agg = role as Agg;
    else if (!isFunctionWord(c)) foreign = true; // kata fungsi (berapa, tolong, bisa, ...) diabaikan
  });

  const nums = items.filter(isNum);
  if (!nums.length) return topic && !agg ? HELP : null; // tanpa angka: hanya pertanyaan tentang matematika
  if (foreign) return null;

  if (agg) {
    if (items.length !== nums.length) return null; // operator bercampur dengan kata hitung daftar
    return AGG_RUN[agg](nums.map(Number), dir);
  }

  if (items.length < 3) return null;
  try {
    return `Hasilnya ${fmt(evaluate(items))}.`;
  } catch (e) {
    return e instanceof DivZero ? "Tidak bisa membagi dengan nol." : null;
  }
}

registerHandler("math", calc);