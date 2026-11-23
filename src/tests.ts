import { analyzeText, respond } from "./index";
import { Features, Intent } from "./types";

const TESTS: Array<[string, Partial<Features>]> = [
  ["halo halo halo halo", {
    language: "indonesian", intent: Intent.Smalltalk, sentence_type: "fragment",
    clause_count: "one", split_actions: null,
  }],
  ["Kirim laporannya sekarang.", {
    intent: Intent.Request, sentence_type: "imperative", subject_omitted: true,
    split_actions: false, clause_count: "one",
  }],
  ["Buka file lalu hapus", {
    intent: Intent.Request, sentence_count: "two", clause_count: "two",
    split_actions: true, object_shared: true, subject_omitted: true,
  }],
  ["Bisa tolong kirim laporannya?", { intent: Intent.Request, sentence_type: Intent.Question }],
  ["apa kabar?", { intent: Intent.Smalltalk, sentence_type: Intent.Question }],
  ['Traceback (most recent call last):\n  File "x.py", line 3', { intent: Intent.Error }],
  ["Saya mengirim laporan dan dia membaca email", {
    intent: "other", sentence_type: "statement", clause_count: "two",
    split_actions: true, subject_omitted: false, object_shared: false,
  }],
  ["laporan dikirim kemarin", { sentence_type: "statement" }],
  ["hello please send the file", { language: "english" }],
  ["gak bisa buka dokumen", { intent: Intent.Request }],
];

let fail = 0;
for (const [input, expected] of TESTS) {
  const { f } = analyzeText(input);
  const bad = (Object.keys(expected) as Array<keyof Features>).filter((k) => f[k] !== expected[k]);
  if (bad.length) {
    fail++;
    console.log(`FAIL  ${JSON.stringify(input)}`);
    for (const k of bad) console.log(`      ${k}: diharapkan ${expected[k]}, dapat ${f[k]}`);
  } else {
    console.log(`PASS  ${JSON.stringify(input)}`);
  }
}
console.log(fail ? `\n${fail} tes gagal` : "\nSemua tes lolos");

console.log("\nContoh:");
for (const s of ["halo halo halo halo", "Kirim laporannya", "Buka file lalu hapus", "zxqv"]) {
  console.log(`> ${s}\n${JSON.stringify(analyzeText(s).f)}\n< ${respond(s)}\n`);
}

// ── Belajar dari penjelasan ──
import { parseExplanation, learn, CLASSES, looksLikeExplanation } from "./index";

const LEARN_TESTS: Array<[string, string, object | null]> = [
  ["blorb", "blorb kata bantu", { word: "blorb", pos: "aux", trans: "none" }],      // "bantu" bukan alias
  ["blorb", "blorb verba bantu", { word: "blorb", pos: "aux", trans: "none" }],      // frasa terpanjang menang
  ["blorb", "blorb kata sifat artinya baru", { word: "blorb", pos: "adj", trans: "none", aliasOf: "baru" }],
  ["blorb", "blorb kata sifat artinya kirim", { word: "blorb", pos: "adj", trans: "none" }], // kelas beda: alias diabaikan
  ["blorb", "blorb artinya dan", { word: "blorb", pos: "conj", trans: "none", aliasOf: "dan" }],
  ["blorb", "blorb artinya kirim", { word: "blorb", pos: "verb", trans: "trans", aliasOf: "kirim" }],
  ["blorb", "blorb itu sama dengan file", { word: "blorb", pos: "noun", trans: "none", aliasOf: "file" }],
  ["blorb", "blorb itu kata kerja intransitif", { word: "blorb", pos: "verb", trans: "intrans" }],
  ["blorb", "blorb kata benda", { word: "blorb", pos: "noun", trans: "none" }],
  ["blorb", "entahlah", null],
  ["blorb", "kau bisa matematika", null],   // kalimat biasa bukan penjelasan
  ["blorb", "saya kirim file", null],
  ["y", "y artinya ya", { word: "y", pos: "adv", trans: "none", aliasOf: "ya" }],
  ["blorb", "blorb artinya entahlah", null],  // arti tak dikenal: gagal, tapi tetap dianggap penjelasan
  ["blorb", "blorb = kirim", { word: "blorb", pos: "verb", trans: "trans", aliasOf: "kirim" }],
];
let lfail = 0;
for (const [t, want] of [["y artinya ya", true], ["blorb kata sifat", true], ["kau bisa matematika", false], ["entahlah", false]] as const) {
  if (looksLikeExplanation(t) !== want) { lfail++; console.log(`FAIL  looksLikeExplanation ${JSON.stringify(t)}`); }
}
for (const [word, text, want] of LEARN_TESTS) {
  const got = parseExplanation(word, text);
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { lfail++; console.log(`FAIL  belajar ${JSON.stringify(text)}\n      diharapkan ${b}\n      dapat      ${a}`); }
  else console.log(`PASS  belajar ${JSON.stringify(text)}`);
}
// Semua nama kelas (resmi dan sinonim) harus terbaca, dengan atau tanpa "itu/adalah".
for (const c of CLASSES) for (const n of c.names) for (const form of [`blorb ${n}`, `blorb adalah ${n}`]) {
  const got = parseExplanation("blorb", form);
  if (got?.pos !== c.pos) { lfail++; console.log(`FAIL  kelas ${JSON.stringify(form)} -> ${got?.pos}, harusnya ${c.pos}`); }
}
console.log(`PASS  ${CLASSES.reduce((n, c) => n + c.names.length * 2, 0)} penamaan kelas kata`);

// Kata hasil belajar ikut aturan tata bahasa
learn("sambil", { pos: "conj", trans: "none" });
const sm = analyzeText("buka file sambil hapus");
if (sm.f.clause_count !== "two" || sm.f.object_shared !== true) { lfail++; console.log("FAIL  kata hubung hasil belajar tidak memecah klausa"); }
else console.log("PASS  kata hubung hasil belajar memecah klausa");
learn("manakah", { pos: "qword", trans: "none" });
if (analyzeText("file manakah").f.sentence_type !== Intent.Question) { lfail++; console.log("FAIL  kata tanya hasil belajar"); }
else console.log("PASS  kata tanya hasil belajar");

learn("plonk", { pos: "verb", trans: "trans", aliasOf: "kirim" });
const after = analyzeText("plonk laporan");
if (after.f.intent !== Intent.Request || respond("plonk laporan") !== "Baik, saya akan kirim laporan. Lanjutkan? (ya/tidak)") {
  lfail++; console.log("FAIL  kata hasil belajar tidak dipakai");
} else console.log("PASS  kata hasil belajar dipakai");
console.log(lfail ? `\n${lfail} tes belajar gagal` : "\nSemua tes belajar lolos");

// ── Hint mode --rlhf ──
import { unknownHints, failedExplanationHints, featureDiff, nearestWords } from "./index";
let hfail = 0;
const expectHint = (name: string, lines: string[], needle: string) => {
  if (lines.some((l) => l.includes(needle))) console.log(`PASS  hint ${name}`);
  else { hfail++; console.log(`FAIL  hint ${name}: tidak ada "${needle}" di\n      ${lines.join("\n      ")}`); }
};
expectHint("posisi setelah kata kerja", unknownHints("kirim zxqv", "zxqv"), "objek");
expectHint("posisi di awal sebelum kata kerja", unknownHints("zxqv kirim file", "zxqv"), "subjek");
expectHint("posisi sendirian", unknownHints("zxqv", "zxqv"), "berdiri sendiri");
expectHint("afiks me-", unknownHints("mengetikkan", "mengetikkan"), "kata kerja aktif");
expectHint("mirip ejaan", unknownHints("kirm file", "kirm"), '"kirim"');
expectHint("cara menjelaskan memakai kata mirip", unknownHints("kirm file", "kirm"), 'kirm artinya kirim');
expectHint("penjelasan gagal: kata tak dikenal", failedExplanationHints("blorb", "entahlah"), '"entahlah"');
expectHint("penjelasan gagal: contoh", failedExplanationHints("blorb", "..."), "blorb itu kata sifat");
if (nearestWords("kirm").join() !== "kirim") { hfail++; console.log("FAIL  nearestWords"); } else console.log("PASS  nearestWords");
const fd = featureDiff(analyzeText("buka").f, analyzeText("buka file lalu hapus").f);
if (!fd.includes("sentence_count: one -> two")) { hfail++; console.log("FAIL  featureDiff " + fd); } else console.log("PASS  featureDiff");
console.log(hfail ? `\n${hfail} tes hint gagal` : "\nSemua tes hint lolos");

// ── Bobot intent (0..1) dan pelatihan dari feedback ──
import { classify, train, nudge, getWeights, resetWeights, INTENTS } from "./index";
let wfail = 0;
const wok = (name: string, cond: boolean, info = "") => {
  if (cond) console.log(`PASS  bobot ${name}`);
  else { wfail++; console.log(`FAIL  bobot ${name} ${info}`); }
};
resetWeights();
const t0 = analyzeText("apa kabar?").trace;
wok("deterministik", JSON.stringify(classify(t0.x)) === JSON.stringify(classify(t0.x)));
wok("prediksi awal smalltalk", t0.winner === Intent.Smalltalk && t0.confidence > 0 && t0.confidence <= 1, JSON.stringify(t0.scores));
const tr = train(t0.x, Intent.Question);
wok("koreksi membalik prediksi", tr.flipped && analyzeText("apa kabar?").f.intent === Intent.Question, JSON.stringify(tr.trace.scores));
const inRange = INTENTS.every((i) => Object.values(getWeights()[i]).every((w) => w >= 0 && w <= 1));
wok("semua bobot di [0,1]", inRange);
resetWeights();
wok("reset mengembalikan default", analyzeText("apa kabar?").f.intent === Intent.Smalltalk);
const before = getWeights()[Intent.Request].imperative_form;
const up = nudge(analyzeText("Kirim laporan").trace.x, Intent.Request, 0.02);
wok("nudge menaikkan bobot", getWeights()[Intent.Request].imperative_form > before && up.length > 0);
resetWeights();
console.log(wfail ? `\n${wfail} tes bobot gagal` : "\nSemua tes bobot lolos");

// ── Edit fitur kata ──
import { parseEdit, entryOf, forget } from "./index";
let efail = 0;
const eok = (name: string, cond: boolean, info = "") => {
  if (cond) console.log(`PASS  edit ${name}`);
  else { efail++; console.log(`FAIL  edit ${name} ${info}`); }
};
const e1 = parseEdit("punya", ["pos=verb", "trans=trans"]);
eok("kata baru", e1.learned?.pos === "verb" && e1.learned.trans === "trans", JSON.stringify(e1));
const e2 = parseEdit("kirim", ["trans=intrans"]);
eok("ubah trans kata bawaan", e2.learned?.pos === "verb" && e2.learned.trans === "intrans");
eok("kata baru tanpa pos ditolak", !!parseEdit("zzzz", ["trans=trans"]).error);
eok("pos tak dikenal ditolak", !!parseEdit("kirim", ["pos=banana"]).error);
eok("nama kelas indonesia", parseEdit("kirim", ["pos=kata_sifat"]).learned?.pos === "adj");
eok("alias beda kelas ditolak", !!parseEdit("blorb2", ["pos=verb", "alias=file"]).error);
eok("alias sama kelas", parseEdit("blorb2", ["pos=verb", "alias=kirim"]).learned?.aliasOf === "kirim");
eok("kelas bukan verba -> trans none", parseEdit("kirim", ["pos=noun"]).learned?.trans === "none");
// pakai hasil edit, lalu kembalikan ke bawaan
learn("kirim", { pos: "noun", trans: "none" });
eok("edit dipakai tagger", analyzeText("kirim").f.sentence_type === "fragment");
forget("kirim");
eok("forget mengembalikan bawaan", entryOf("kirim")?.pos === "verb" && analyzeText("kirim file").f.intent === Intent.Request);
console.log(efail ? `\n${efail} tes edit gagal` : "\nSemua tes edit lolos");

// ── Token id, fitur ganda, konteks, dan tabel fitur ──
import { Store } from "./store";
import { idOf, wordOf, observe, guess, loadContext, resetContext, assignIds, builtinForms, restore, toRecord, tag as tagWords, tokenize as tok, transFor } from "./index";
let kfail = 0;
const kok = (name: string, cond: boolean, info = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else { kfail++; console.log(`FAIL  ${name} ${info}`); }
};
resetContext();

// token id
const kid = idOf("kirim")!;
kok("token id kata bawaan", kid > 0 && wordOf(kid) === "kirim");
kok("id token pada hasil tag", tagWords(tok("kirim file"))[0].id === kid);
kok("id unik", new Set(builtinForms().map((w) => idOf(w))).size === builtinForms().length);

// alias lewat token id
learn("plonk", { pos: "verb", trans: "trans", aliasOf: "kirim" });
const pt = tagWords(tok("plonk laporan"))[0];
kok("alias: id kata dan id lemma", pt.id === idOf("plonk") && pt.lemmaId === kid && pt.lemma === "kirim");
kok("rekam alias membawa token id target", toRecord(entryOf("plonk")!).aliasId === kid);
forget("plonk");

// fitur ganda: pesan = kata benda + kata kerja
const pesan = entryOf("pesan")!;
kok("kata dengan beberapa fitur", pesan.poss.join() === "noun,verb" && pesan.transitive && !pesan.intransitive);
kok("jalan: kerja intransitif + benda", entryOf("jalan")!.poss.join() === "verb,noun" && entryOf("jalan")!.intransitive);
kok("pilih benda setelah kata kerja", tagWords(tok("kirim pesan"))[1].pos === "noun");
kok("pilih kerja setelah kata ganti", tagWords(tok("saya pesan buku"))[1].pos === "verb");
kok("trans mengikuti kelas terpilih", tagWords(tok("kirim pesan"))[1].trans === "none" && tagWords(tok("saya pesan buku"))[1].trans === "trans");
kok("kata ganda: hasObject", analyzeText("kirim pesan").f.object_shared === false && respond("kirim pesan") === "Baik, saya akan kirim pesan. Lanjutkan? (ya/tidak)");
// edit banyak kelas
const em = parseEdit("blorb3", ["pos=noun,verb", "trans=trans"]);
kok("edit pos banyak", em.learned?.pos === "noun" && em.learned.extra?.join() === "verb" && em.learned.trans === "trans", JSON.stringify(em));
kok("edit pos banyak: kelas salah ditolak", !!parseEdit("blorb3", ["pos=noun,banana"]).error);

// konteks: belajar dari kalimat lalu memengaruhi pilihan dan tebakan
resetContext();
const obs = observe(tagWords(tok("saya kirim laporan")));
kok("observe mencatat tetangga", obs.some((r) => r.prev === "pron" && r.pos === "verb" && r.next === "noun"), JSON.stringify(obs));
kok("observe melewati kata ambigu", observe(tagWords(tok("kirim pesan"))).every((r) => r.pos !== "noun" || r.prev !== "verb" || r.next !== "$"));
const u = tagWords(tok("kirim zxqv"));
kok("tebakan dari konteks", guess(u, 1)[0]?.pos === "noun", JSON.stringify(guess(u, 1)));
kok("respons memuat tebakan", respond("kirim zxqv").includes("kata benda"), respond("kirim zxqv"));
kok("tanpa konteks tidak menebak", !respond("zxqv").includes("Dari konteks"));
// data konteks mengalahkan prior: setelah kata ganti, "pesan" jadi benda bila sering begitu
for (let i = 0; i < 20; i++) observe(tagWords(tok("saya baca laporan")));
resetContext();
loadContext([{ prev: "pron", pos: "noun", next: "$", n: 50 }]);
kok("data konteks mengalahkan prior", tagWords(tok("saya pesan"))[1].pos === "noun");
resetContext();

// database: satu tabel per fitur
const st = await Store.open("sqlite://:memory:");
const ids = await st.syncWords(builtinForms());
assignIds(ids);
kok("syncWords memberi id ke semua kata bawaan", builtinForms().every((w) => ids.has(w)) && ids.get("kirim") === idOf("kirim"));
const bid = await st.wordId("blorb4");
const be = learn("blorb4", { pos: "noun", trans: "trans", extra: ["verb"], aliasOf: undefined }, bid);
await st.saveWord(toRecord(be), "tes");
const al = await st.wordId("zork");
const ze = learn("zork", { pos: "verb", trans: "trans", aliasOf: "kirim" }, al);
await st.saveWord(toRecord(ze), "zork artinya kirim");
const q = async (t: string) => (await (st as any).sql.unsafe(`SELECT * FROM ${t}`)) as any[];
kok("tabel transitive_verb", (await q("transitive_verb")).some((r) => Number(r.word_id) === bid));
kok("transitive_verb hanya word_id", Object.keys((await q("transitive_verb"))[0]).join() === "word_id");
kok("tabel intransitive_verb kosong", (await q("intransitive_verb")).length === 0);
kok("tabel word_pos beberapa baris", (await q("word_pos")).filter((r) => Number(r.word_id) === bid).length === 2);
kok("tabel word_alias pakai token id", (await q("word_alias")).some((r) => Number(r.word_id) === al && Number(r.target_id) === idOf("kirim")));
// muat ulang: id, fitur ganda, alias bertahan
forget("blorb4"); forget("zork");
for (const r of await st.loadLexicon()) restore(r);
const be2 = entryOf("blorb4")!, ze2 = entryOf("zork")!;
kok("muat ulang: fitur ganda", be2.id === bid && be2.poss.join() === "noun,verb" && be2.transitive);
kok("muat ulang: alias", ze2.id === al && ze2.aliasOf === "kirim");
kok("forgetWord menghapus semua tabel", (await st.forgetWord("blorb4")) && (await q("transitive_verb")).every((r) => Number(r.word_id) !== bid) && (await q("word_pos")).every((r) => Number(r.word_id) !== bid));
// konteks tersimpan
await st.bumpContext([{ prev: "pron", pos: "verb", next: "noun", n: 2 }]);
await st.bumpContext([{ prev: "pron", pos: "verb", next: "noun", n: 3 }]);
kok("context_stats menjumlah", (await st.loadContext())[0]?.n === 5);
forget("zork");
await st.close();
console.log(kfail ? `\n${kfail} tes token/konteks gagal` : "\nSemua tes token/konteks lolos");
