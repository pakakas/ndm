// Hint untuk pemberi penjelasan (mode --rlhf). Semua hint dihitung dari aturan:
// posisi kata dalam kalimat, bentuk afiks, kemiripan ejaan, dan kata yang pernah diajarkan.
import { analyzeText } from "./features";
import { guess } from "./context";
import { knownWords, learnedEntries } from "./lexicon";
import { CLASSES, CUE_G } from "./learning";
import { tag, tokenize } from "./tokenizer";
import { Features, Pos, Tok, INTENT_NAME, Poses } from "./types";

const LABEL = new Map(CLASSES.map((c) => [c.pos, c.label]));

// ── Jarak edit (Levenshtein) ──
function lev(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function nearestWords(word: string, k = 3): string[] {
  if (word.length < 3) return [];
  const max = word.length <= 4 ? 1 : 2;
  return knownWords()
    .map((w) => [w, lev(word, w)] as const)
    .filter(([w, d]) => w !== word && w.length >= 3 && d <= max)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, k)
    .map(([w]) => w);
}

// ── Petunjuk dari posisi dalam kalimat ──
function positionHint(toks: Tok[], i: number): { text: string; suggest?: Pos } | null {
  if (i < 0) return null;
  const prev = i > 0 && toks[i - 1].pos !== "punct" ? toks[i - 1] : undefined;
  const next = i + 1 < toks.length && toks[i + 1].pos !== "punct" ? toks[i + 1] : undefined;

  if (prev?.pos === "verb")
    return { text: `Muncul setelah kata kerja "${prev.lemma}": kemungkinan objek (kata benda atau kata ganti).`, suggest: "noun" };
  if (prev?.pos === "prep")
    return { text: `Muncul setelah kata depan "${prev.text}": kemungkinan kata benda (tempat atau objek).`, suggest: "noun" };
  if (prev?.pos === "aux" || prev?.pos === "polite")
    return { text: `Muncul setelah "${prev.text}": kemungkinan kata kerja.`, suggest: "verb" };
  if (prev?.pos === "det" && prev.text === "yang")
    return { text: `Muncul setelah "yang": kemungkinan kata kerja atau kata sifat.`, suggest: "verb" };
  if (prev?.pos === "pron")
    return { text: `Muncul setelah kata ganti "${prev.text}": kemungkinan kata kerja (predikat).`, suggest: "verb" };
  if (prev?.pos === "noun")
    return { text: `Muncul setelah kata benda "${prev.lemma}": kemungkinan kata sifat atau kata keterangan.`, suggest: "adj" };
  if (prev?.pos === "conj")
    return { text: `Muncul setelah kata hubung "${prev.text}": kemungkinan awal klausa baru, sering kata kerja.`, suggest: "verb" };
  if (!prev && next?.pos === "verb")
    return { text: `Di awal kalimat sebelum kata kerja "${next.lemma}": kemungkinan subjek (kata benda atau kata ganti).`, suggest: "noun" };
  if (!prev && next?.pos === "noun")
    return { text: `Di awal kalimat sebelum kata benda "${next.lemma}": kemungkinan kata kerja perintah.`, suggest: "verb" };
  if (!prev && !next)
    return { text: "Kata ini berdiri sendiri: bisa sapaan, kata benda, atau kata kerja perintah." };
  return null;
}

// ── Petunjuk dari bentuk kata (afiks) ──
function affixHint(w: string): string | null {
  if (w.length < 5) return null;
  if (/^(meng|meny|men|mem|me)/.test(w)) return 'Awalan me- biasanya menandai kata kerja aktif.';
  if (/^di/.test(w)) return 'Awalan di- biasanya menandai kata kerja pasif.';
  if (/^ber/.test(w)) return 'Awalan ber- biasanya menandai kata kerja intransitif.';
  if (/^ter/.test(w)) return 'Awalan ter- biasanya kata kerja pasif atau kata sifat.';
  if (/^(pe|peng|peny|pem|pen).+an$/.test(w) || /^ke.+an$/.test(w)) return "Pola pe-...-an atau ke-...-an biasanya kata benda.";
  if (/(kan|i)$/.test(w)) return "Akhiran -kan atau -i biasanya kata kerja transitif.";
  if (/an$/.test(w)) return "Akhiran -an biasanya kata benda.";
  if (/nya$/.test(w)) return `Akhiran -nya adalah klitik; kata dasarnya mungkin "${w.slice(0, -3)}".`;
  return null;
}

/** Hint saat bot tidak mengenal sebuah kata. */
export function unknownHints(raw: string, word: string, poses: Poses): string[] {
  const out: string[] = [];
  const w = word.toLowerCase();
  const { toks } = analyzeText(raw, poses);

  const pos = positionHint(toks, toks.findIndex((t) => t.text === w));
  if (pos) out.push(pos.text);
  const aff = affixHint(w);
  if (aff) out.push(aff);

  const g = guess(toks, toks.findIndex((t) => t.text === w)).slice(0, 3);
  if (g.length)
    out.push(`Tebakan dari konteks yang sudah saya pelajari: ${g.map((x) => `${LABEL.get(x.pos) ?? x.pos} ${Math.round(x.p * 100)}%`).join(", ")}.`);

  const near = nearestWords(w);
  if (near.length)
    out.push(`Mirip dengan kata yang saya kenal: ${near.map((n) => `"${n}"`).join(", ")}. Salah ketik, atau sinonim?`);

  const similar = learnedEntries()
    .filter(([lw]) => lw !== w && w.length >= 4 && (lw.slice(-3) === w.slice(-3) || lw.slice(0, 3) === w.slice(0, 3)))
    .slice(0, 3)
    .map(([lw, e]) => `"${lw}" (${LABEL.get(e.pos) ?? e.pos})`);
  if (similar.length) out.push(`Kata serupa yang pernah diajarkan: ${similar.join(", ")}.`);

  const exampleClass = pos?.suggest ? LABEL.get(pos.suggest) : "kata benda";
  const exampleWord = near[0] ?? "kirim";
  out.push(`Cara menjelaskan: "${w} artinya ${exampleWord}" (samakan dengan kata yang saya tahu) atau "${w} itu ${exampleClass}" (sebut kelas katanya).`);
  out.push("Ketik :kelas untuk daftar kelas kata, atau \"batal\" untuk melewati.");
  return out;
}

/** Hint saat penjelasan pengguna tidak bisa dipahami. */
export function failedExplanationHints(word: string, text: string, poses: Poses): string[] {
  const w = word.toLowerCase();
  const unknown = [...new Set(tag(tokenize(text.replace(CUE_G, " ")), poses).filter((t) => !t.known && t.text !== w).map((t) => t.text))];
  const out: string[] = [];
  if (unknown.length)
    out.push(
      `Kata dalam penjelasanmu yang belum saya kenal: ${unknown.map((u) => `"${u}"`).join(", ")}. ` +
        "Jelaskan dengan kata yang sudah saya tahu, atau sebut kelas katanya."
    );
  else out.push("Penjelasanmu tidak menyebut kelas kata maupun kata yang saya kenal.");
  out.push(`Contoh: "${w} artinya kirim", "${w} itu kata sifat", atau "${w} kata kerja intransitif".`);
  return out;
}

/** Ringkasan perubahan fitur sebelum dan sesudah sebuah kata dipelajari. */
export function featureDiff(before: Features, after: Features): string {
  const diffs = (Object.keys(before) as Array<keyof Features>)
    .filter((k) => before[k] !== after[k])
    .map((k) => (k === "intent" ? `intent: ${INTENT_NAME[before.intent]} -> ${INTENT_NAME[after.intent]}` : `${k}: ${before[k]} -> ${after[k]}`));
  return diffs.length ? diffs.join(", ") : "tidak ada perubahan fitur";
}