import { calc } from "./math";
import { learn, forget } from "./lexicon";
import { parseExplanation } from "./learning";
import { parseEdit } from "./wordedit";
import { respond } from "./respond";
import { Store } from "./store";
import { applyMathSeed, isBuiltin } from "./lexicon";
import { MATH_SEED } from "./seed";
import { unknownWord } from "../src/unknown";

let fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log(`PASS  ${name}`);
  else { fail++; console.log(`FAIL  ${name}\n      diharapkan ${JSON.stringify(want)}\n      dapat      ${JSON.stringify(got)}`); }
};

// ── Hanya kata tertanam (satu per konsep), input [0, 10, 5] ──
const CASES: Array<[string, string | null]> = [
  ["0 + 10 + 5", "Hasilnya 15."],
  ["berapa 0 ditambah 10 ditambah 5?", "Hasilnya 15."],
  ["jumlah 0, 10, 5", "Jumlah: 15"],
  ["rata-rata 0 10 5", "Rata-rata: 5"],
  ["maksimum dari 0, 10, 5", "Maksimum: 10"],
  ["minimum 0 10 5", "Minimum: 0"],
  ["urutkan 0, 10, 5", "Terurut naik: 0, 5, 10"],
  ["10 + 5 * 2", "Hasilnya 20."],
  ["(10 + 5) * 2", "Hasilnya 30."],
  ["10 dikurangi 4", "Hasilnya 6."],
  ["3 kali 4", "Hasilnya 12."],
  ["3 dikali 4", "Hasilnya 12."],
  ["10 dibagi 4", "Hasilnya 2.5."],
  ["-5 + 2", "Hasilnya -3."],
  ["2.5 + 0.5", "Hasilnya 3."],
  ["10 / 0", "Tidak bisa membagi dengan nol."],
  ["bisa tolong 0 + 10 + 5 ya?", "Hasilnya 15."],
  // sinonim TIDAK tertanam -> harus diajarkan
  ["0 plus 10 plus 5", null],
  ["10 minus 4", null],
  ["total 0 10 5", null],
  ["jumlahkan 0 10 5", null],
  ["maks 0 10 5", null],
  ["3 x 4", null],
  ["hitung 0 + 10 + 5", null],
  // bukan hitungan -> null (jalur lama)
  ["kirim 3 file", null],
  ["kirim laporan", null],
  ["3 kali", null],
  ["tolong kirim 3 kali 4 file", null],
  ["2026-11-22", null],
  ["5", null],
  ["apa kabar?", null],
  ["kau bisa math ga", null],
];
for (const [input, want] of CASES) ok(JSON.stringify(input), calc(input), want);

// ── Routing lewat ajaran ──
const teachWord = (word: string, aliasOf: string, pos: "noun" | "verb") =>
  learn(word, { pos, trans: pos === "verb" ? "trans" : "none", aliasOf });

const teach = parseExplanation("math", "math artinya matematika");
ok("penjelasan dibaca sebagai alias", teach, { word: "math", pos: "noun", trans: "none", aliasOf: "matematika" });
ok("sebelum diajari: math = kata asing", unknownWord("kau bisa math ga"), "math");
teachWord("math", "matematika", "noun");
const HELP = calc("kau bisa matematika ga");
ok("setelah diajari: math ikut routing", calc("kau bisa math ga"), HELP);
ok("respond memakai jawaban math", respond("kau bisa math ga"), HELP);
ok("math bukan lagi kata asing", unknownWord("kau bisa math ga"), null);
forget("math");
ok("forget mencabut routing", calc("kau bisa math ga"), null);

// kopula: "adalah" hanya berlaku setelah diajarkan sebagai alias "itu"
ok("math itu matematika = alias", parseExplanation("math", "math itu matematika"), teach);
ok("adalah belum diajari: bukan isyarat", parseExplanation("math", "math adalah matematika"), null);
ok(":edit adalah pos=det alias=itu", parseEdit("adalah", ["pos=det", "alias=itu"]).learned, { word: "adalah", pos: "det", trans: "none", aliasOf: "itu" });
learn("adalah", { pos: "det", trans: "none", aliasOf: "itu" });
ok("setelah diajari: adalah = isyarat", parseExplanation("math", "math adalah matematika"), teach);
forget("adalah");
ok("forget adalah mencabutnya", parseExplanation("math", "math adalah matematika"), null);

// sinonim operator
teachWord("plus", "tambah", "verb");
ok("plus diajari", calc("0 plus 10 plus 5"), "Hasilnya 15.");
forget("plus");
ok("plus dicabut", calc("0 plus 10 plus 5"), null);
teachWord("x", "kali", "noun");
ok("x diajari", calc("3 x 4"), "Hasilnya 12.");
forget("x");

// sinonim agregat
teachWord("total", "jumlah", "noun");
ok("total diajari", calc("total 0 10 5"), "Jumlah: 15");
forget("total");
teachWord("jumlahkan", "jumlah", "noun");
ok("jumlahkan diajari", calc("jumlahkan 0 10 5"), "Jumlah: 15");
forget("jumlahkan");
teachWord("mean", "rata", "noun");
ok("mean diajari", calc("mean 0 10 5"), "Rata-rata: 5");
forget("mean");

// topik: "hitung" diajari sebagai matematika -> jadi filler di soal berangka
teachWord("hitung", "matematika", "noun");
ok("hitung diajari", calc("hitung 0 + 10 + 5"), "Hasilnya 15.");
ok("hitung tanpa angka -> bantuan", calc("tolong hitung"), HELP);
forget("hitung");
ok("hitung dicabut", calc("hitung 0 + 10 + 5"), null);

// ── Seed di DB ──
const st = await Store.open("sqlite://:memory:");
const rows = await st.mathSeed();
ok("seed_math terisi dari seed.ts", rows, MATH_SEED);
ok("kata seed = bawaan", isBuiltin("tambah") && isBuiltin("matematika"), true);
const q = (sql: string) => (st as any).sql.unsafe(sql);
await q("UPDATE seed_math SET role = '*' WHERE word = 'tambah'");
applyMathSeed(await st.mathSeed());
ok("ubah baris DB mengubah perilaku", calc("2 tambah 3"), "Hasilnya 6.");
await q("DELETE FROM seed_math WHERE word = 'bagi'");
applyMathSeed(await st.mathSeed());
ok("hapus baris DB mencabut peran", calc("10 dibagi 4"), null);
applyMathSeed(MATH_SEED);
ok("kembali ke seed awal", calc("2 tambah 3"), "Hasilnya 5.");
await st.close();

console.log(fail ? `\n${fail} tes math gagal` : "\nSemua tes math lolos");
process.exit(fail ? 1 : 0);
