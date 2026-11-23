// Percakapan biasa: menjawab pesan, dan belajar kata asing dari penjelasan pengguna.
import {
  analyzeText, respond, unknownWord, unknownGuess, parseExplanation, looksLikeExplanation, describe,
  learn, unknownHints, failedExplanationHints, featureDiff, toRecord, observe,
} from "../src";
import type { Learned } from "../src/learning";
import type { Session } from "./session";
import { printHints, showDebug } from "./format";
import { asyncJob } from "../src/tools";
import { isNo, isYes, planOf, settle } from "../src/confirm";

// Simpan kata beserta semua fiturnya: token id dari database, fitur ke tabel masing-masing.
export async function teach(s: Session, l: Learned, explanation: string, source?: string): Promise<void> {
  const id = await s.store.wordId(l.word);
  const e = learn(l.word, { pos: l.pos, trans: l.trans, aliasOf: l.aliasOf, extra: l.extra }, id);
  await s.store.saveWord(toRecord(e), explanation, source);
}

export async function converse(s: Session, text: string): Promise<void> {
  const { f, toks } = analyzeText(text);
  const ack = respond(text);
  // Tool yang butuh jaringan (mis. search): respond() hanya memberi balasan awal; hasilnya dikerjakan di sini.
  const job = asyncJob(text);
  let reply = ack;
  let shown = ack;
  if (job) {
    console.log(`bot > ${ack}`);
    shown = await job.run();
    reply = `${ack}\n${shown}`;
  }
  s.lastId = await s.store.logInteraction(text, f, reply);
  s.lastInput = text;
  const uw = unknownWord(text);
  s.pending = uw ? { word: uw, input: text, guess: unknownGuess(text)?.pos } : null;
  s.confirm = uw ? null : planOf(text);

  // Belajar dari konteks: hanya kalimat yang semua katanya dikenal (yang asing diulang setelah dijelaskan).
  if (!uw) await s.store.bumpContext(observe(toks));
  console.log(`bot > ${shown}`);
  if (s.debug) showDebug(text);
  if (s.rlhf && uw) printHints(unknownHints(text, uw));
}

export async function explain(s: Session, text: string): Promise<void> {
  const p = s.pending!;
  if (/^(batal|lewati|skip)$/i.test(text)) {
    s.pending = null;
    console.log("bot > Oke, dilewati.");
    return;
  }
  const accepted = p.guess && /^(ya|y|iya|benar|betul)$/i.test(text);
  const l: Learned | null = accepted
    ? { word: p.word.toLowerCase(), pos: p.guess!, trans: p.guess === "verb" ? "trans" : "none" }
    : parseExplanation(p.word, text);
  if (!l && !looksLikeExplanation(text, p.word) && text.split(/\s+/).length >= 3) {
    // Kalimat panjang yang tidak berbentuk penjelasan: pengguna pindah topik. Lewati kata tadi, proses sebagai pesan baru.
    s.pending = null;
    console.log(`bot > (Penjelasan untuk "${p.word}" dilewati.)`);
    return converse(s, text);
  }
  if (!l) {
    console.log(
      `bot > Saya belum paham penjelasannya. Coba: "${p.word} artinya kirim" atau "${p.word} itu kata sifat". Ketik :kelas untuk daftar kelas kata, atau "batal" untuk melewati.`
    );
    if (s.rlhf) printHints(failedExplanationHints(p.word, text));
    return;
  }
  const before = analyzeText(p.input).f;
  await teach(s, l, accepted ? "diterima dari tebakan konteks" : text, p.input);
  console.log(`bot > Oke, "${l.word}" saya simpan sebagai ${describe(l)}. Mengulang pesan tadi:`);
  if (s.rlhf) printHints([`Efek pada fitur: ${featureDiff(before, analyzeText(p.input).f)}`]);
  s.pending = null;
  await converse(s, p.input);
}
