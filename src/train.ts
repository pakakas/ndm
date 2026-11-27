import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { generateVocabs, loadVocabs } from "./vocab";
import path from "path";

const datasetFile = import.meta.dirname + "/../data/chatbot.dataset";
const tokensFile = import.meta.dirname + "/../neocortex/vocabs";
const weightsFile = import.meta.dirname + "/../neocortex/learned.weights";
const weightsFileRelative = path.resolve(weightsFile).replace(process.cwd(), '.')

await generateVocabs(datasetFile, tokensFile);
const tokens = await loadVocabs(tokensFile);
const vocabSize = tokens.size; // vocab size
const MAX_LEN = 32;            // max sequence length
const LR = 0.02;               // learning rate

/** Dimensi dasar — fitur linguistik berlabel teks. */
const baseDims = [
  "verb", "noun", "adj", "adv", "pron", "num", "prep", "conj",
  "interj", "aux", "det", "polite", "qword", "unknown",
  "at_start", "at_end",
  "prev_verb", "prev_noun", "prev_adj", "prev_pron", "prev_aux",
  "next_verb", "next_noun", "next_adj", "next_pron", "next_aux",
  "pron_then_verb", "det_then_noun", "aux_then_verb",
  "has_affix", "is_reduplicated", "is_number",
];

/**
 * BIT_DIMS — dimensi intent dari dataset, dikodekan sebagai BigInt bitmask.
 * Contoh: "greeting" = id 2 → 1n << 2n = 4n
 *         "asking for coding capability" = ids [17,18,15,19] → mask 950272n
 * Setiap bitmask unik = satu dimensi tambahan di tokenEmbed.
 */
export const BIT_DIMS: bigint[] = [];

// ─── Kumpulkan bitmask dari pola "X... is Y Z W..., ..." di dataset ───
for (const line of readFileSync(datasetFile, "utf8").split(/\r?\n/)) {
  const words = line.replace(/([?!.,;:])/g, " $1 ").split(/\s+/).filter(Boolean);
  const sepIdx = words.findIndex(w => w === "," || w === ";");
  const beforeSep = sepIdx !== -1 ? words.slice(0, sepIdx) : words;
  const isIdx = beforeSep.indexOf("is");
  if (isIdx !== -1 && isIdx < beforeSep.length - 1) {
    const intentWords = beforeSep.slice(isIdx + 1);
    let mask = 0n;
    for (const w of intentWords) {
      const id = tokens.get(w);
      if (id !== undefined) mask |= (1n << BigInt(id));
    }
    if (mask > 0n && !BIT_DIMS.includes(mask)) BIT_DIMS.push(mask);
  }
}

/** DIM_NAMES — hanya baseDims untuk label teks (index 0..31). */
export const DIM_NAMES: string[] = [...baseDims];
const embedDim = baseDims.length + BIT_DIMS.length; // e.g. 32 + 2 = 34

console.log(`[init] vocab=${vocabSize}, embedDim=${embedDim} (${baseDims.length} baseDims + ${BIT_DIMS.length} bitDims), MAX_LEN=${MAX_LEN}, LR=${LR}`);
console.log(`[init] BIT_DIMS: [${BIT_DIMS.map((m, i) => `dim${baseDims.length + i}=${m}n`).join(", ")}]`);

/** TokenEmbed — flat number[], panjang = embedDim.
 *  Index 0..baseDims.length-1 → baseDims (linguistik)
 *  Index baseDims.length+k    → BIT_DIMS[k] (intent bitmask)
 */
export type TokenEmbed = number[];

function newEmbed(): TokenEmbed {
  const scale = Math.sqrt(2 / (embedDim + embedDim));
  return Array.from({ length: embedDim }, () => (Math.random() * 2 - 1) * scale);
}

function randEmbed(size: number): TokenEmbed[] {
  return Array.from({ length: size }, () => newEmbed());
}

// ─── Random init (Xavier) ───
function randMatrix(rows: number, cols: number): number[][] {
  const scale = Math.sqrt(2 / (rows + cols));
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
  );
}
function randVector(size: number): number[] {
  return Array.from({ length: size }, () => 0);
}

// ─── Model params (Causal Self-Attention, no hidden state) ───
const tokenEmbed: TokenEmbed[] = randEmbed(vocabSize);
const posEmbed = randMatrix(MAX_LEN, embedDim);
const queryWeight = randMatrix(embedDim, embedDim);
const keyWeight = randMatrix(embedDim, embedDim);
const valueWeight = randMatrix(embedDim, embedDim);
const outputWeight = randMatrix(vocabSize, embedDim);
const outputBias = randVector(vocabSize);

/** Hitung bitDimIdx untuk suatu bitmask intent. */
function bitDimIdx(mask: bigint): number | undefined {
  const i = BIT_DIMS.indexOf(mask);
  return i === -1 ? undefined : baseDims.length + i;
}

/** Bitmask dari kumpulan token id. */
function tokensToBitMask(ids: number[]): bigint {
  let mask = 0n;
  for (const id of ids) mask |= (1n << BigInt(id));
  return mask;
}

export function ensureWord(word: string, copyFromWord?: string): number {
  if (tokens.has(word)) {
    const id = tokens.get(word)!;
    if (copyFromWord && tokens.has(copyFromWord)) {
      const srcId = tokens.get(copyFromWord)!;
      tokenEmbed[id] = [...tokenEmbed[srcId]];
    }
    return id;
  }

  const id = tokens.addWord(word);
  try {
    writeFileSync(tokensFile, `${word}\n`, { flag: "a", encoding: "utf8" });
  } catch {}

  const vec = newEmbed();
  if (copyFromWord && tokens.has(copyFromWord)) {
    const srcId = tokens.get(copyFromWord)!;
    for (let d = 0; d < embedDim; d++) vec[d] = tokenEmbed[srcId][d];
  }
  tokenEmbed[id] = vec;

  const scale = Math.sqrt(2 / (embedDim + embedDim));
  outputWeight[id] = Array.from({ length: embedDim }, () => (Math.random() * 2 - 1) * scale);
  outputBias[id] = 0;

  console.log(`[vocab] added word "${word}" -> id=${id}${copyFromWord ? ` (copied from "${copyFromWord}")` : ""}`);
  return id;
}

function calcTotalWeights(vSize: number): number {
  return vSize * embedDim + MAX_LEN * embedDim + embedDim * embedDim * 3 + vSize * embedDim + vSize;
}

function loadSavedWeights(): void {
  if (!existsSync(weightsFile)) return;
  try {
    const buf = readFileSync(weightsFile);
    const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const expected = calcTotalWeights(tokens.size);
    if (floats.length !== expected) {
      console.warn(`[init] weights file size mismatch (${floats.length} floats vs expected ${expected}) — skipping`);
      return;
    }
    let offset = 0;
    for (let i = 0; i < tokens.size; i++) {
      for (let d = 0; d < embedDim; d++) tokenEmbed[i][d] = floats[offset++];
    }
    const readMat = (dst: number[][]) => {
      for (let i = 0; i < dst.length; i++)
        for (let j = 0; j < dst[i].length; j++) dst[i][j] = floats[offset++];
    };
    readMat(posEmbed);
    readMat(queryWeight);
    readMat(keyWeight);
    readMat(valueWeight);
    readMat(outputWeight);
    for (let i = 0; i < outputBias.length; i++) outputBias[i] = floats[offset++];
    console.log(`[init] loaded ${floats.length} floats (${buf.byteLength} bytes) from ${weightsFileRelative}`);
  } catch (err) {
    console.warn(`[init] failed to load weights:`, err);
  }
}

loadSavedWeights();

function matVec(matrix: number[][], vec: number[]): number[] {
  return matrix.map(row => row.reduce((sum, weight, colIdx) => sum + weight * vec[colIdx], 0));
}

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map(logit => Math.exp(logit - maxLogit));
  const expSum = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(expVal => expVal / expSum);
}

// ─── Forward pass over full sequence ───
function forwardSequence(seq: number[]) {
  const seqLen = seq.length;
  const inputs = seq.map((tokenId, step) =>
    Array.from({ length: embedDim }, (_, dim) => tokenEmbed[tokenId][dim] + posEmbed[step][dim])
  );
  const queries = inputs.map(inputVec => matVec(queryWeight, inputVec));
  const keys = inputs.map(inputVec => matVec(keyWeight, inputVec));
  const values = inputs.map(inputVec => matVec(valueWeight, inputVec));

  const scale = Math.sqrt(embedDim);
  const alphas: number[][] = [];
  const ctx: number[][] = [];
  const logits: number[][] = [];

  for (let step = 0; step < seqLen; step++) {
    const scores: number[] = [];
    for (let prevStep = 0; prevStep <= step; prevStep++) {
      let dot = 0;
      for (let dim = 0; dim < embedDim; dim++) {
        dot += queries[step][dim] * keys[prevStep][dim];
      }
      scores.push(dot / scale);
    }
    const alpha = softmax(scores);
    alphas.push(alpha);

    const contextVec = new Array(embedDim).fill(0);
    for (let prevStep = 0; prevStep <= step; prevStep++) {
      for (let dim = 0; dim < embedDim; dim++) {
        contextVec[dim] += alpha[prevStep] * values[prevStep][dim];
      }
    }
    ctx.push(contextVec);

    const stepLogits = matVec(outputWeight, contextVec).map((val, vocabIdx) => val + outputBias[vocabIdx]);
    logits.push(stepLogits);
  }

  return { inputs, queries, keys, values, alphas, ctx, logits };
}

// ─── Train one sequence (SGD) ───
function trainSequence(seq: number[]): void {
  const seqLen = seq.length;
  if (seqLen < 2) return;

  const { inputs, queries, keys, values, alphas, ctx, logits } = forwardSequence(seq);
  const scale = Math.sqrt(embedDim);

  const dQueries = Array.from({ length: seqLen }, () => new Array(embedDim).fill(0));
  const dKeys = Array.from({ length: seqLen }, () => new Array(embedDim).fill(0));
  const dValues = Array.from({ length: seqLen }, () => new Array(embedDim).fill(0));

  for (let step = 0; step < seqLen - 1; step++) {
    const targetId = seq[step + 1];
    const probs = softmax(logits[step]);
    const dLogits = probs.map((prob, vocabIdx) => prob - (vocabIdx === targetId ? 1 : 0));

    const dCtx = new Array(embedDim).fill(0);
    for (let vocabIdx = 0; vocabIdx < tokens.size; vocabIdx++) {
      outputBias[vocabIdx] -= LR * dLogits[vocabIdx];
      for (let dim = 0; dim < embedDim; dim++) {
        dCtx[dim] += outputWeight[vocabIdx][dim] * dLogits[vocabIdx];
        outputWeight[vocabIdx][dim] -= LR * dLogits[vocabIdx] * ctx[step][dim];
      }
    }

    const dAlpha = new Array(step + 1).fill(0);
    for (let prevStep = 0; prevStep <= step; prevStep++) {
      for (let dim = 0; dim < embedDim; dim++) {
        dAlpha[prevStep] += dCtx[dim] * values[prevStep][dim];
        dValues[prevStep][dim] += alphas[step][prevStep] * dCtx[dim];
      }
    }

    let dotAlpha = 0;
    for (let prevStep = 0; prevStep <= step; prevStep++) {
      dotAlpha += alphas[step][prevStep] * dAlpha[prevStep];
    }
    for (let prevStep = 0; prevStep <= step; prevStep++) {
      const dScore = alphas[step][prevStep] * (dAlpha[prevStep] - dotAlpha) / scale;
      for (let dim = 0; dim < embedDim; dim++) {
        dQueries[step][dim] += dScore * keys[prevStep][dim];
        dKeys[prevStep][dim] += dScore * queries[step][dim];
      }
    }
  }

  for (let step = 0; step < seqLen; step++) {
    for (let row = 0; row < embedDim; row++) {
      for (let col = 0; col < embedDim; col++) {
        queryWeight[row][col] -= LR * dQueries[step][row] * inputs[step][col];
        keyWeight[row][col] -= LR * dKeys[step][row] * inputs[step][col];
        valueWeight[row][col] -= LR * dValues[step][row] * inputs[step][col];
      }
    }
    // tokenEmbed dibekukan; hanya posEmbed yang diupdate lewat gradien
    for (let dim = 0; dim < embedDim; dim++) {
      let dInput = 0;
      for (let row = 0; row < embedDim; row++) {
        dInput +=
          queryWeight[row][dim] * dQueries[step][row] +
          keyWeight[row][dim] * dKeys[step][row] +
          valueWeight[row][dim] * dValues[step][row];
      }
      posEmbed[step][dim] -= LR * dInput;
    }
  }
}

// ─── Predict next token (argmax + repeat penalty) ───
export function predictNext(seq: number[], verbose = false, recent?: Map<number, number>, penalty = 2.0): number {
  const { logits, alphas } = forwardSequence(seq);
  const lastLogits = logits[logits.length - 1].slice(); // copy agar tidak mutasi asli
  // Repeat penalty: kurangi logit token yang baru saja muncul
  if (recent) {
    for (const [tokenId, count] of recent) {
      lastLogits[tokenId] -= penalty * count;
    }
  }
  const probs = softmax(lastLogits);
  let bestId = 0;
  for (let vocabIdx = 1; vocabIdx < tokens.size; vocabIdx++) {
    if (lastLogits[vocabIdx] > lastLogits[bestId]) bestId = vocabIdx;
  }
  if (verbose) {
    const lastAlpha = alphas[alphas.length - 1]
      .map((attnWeight, idx) => `${tokens.getWord(seq[idx]) ?? seq[idx]}:${attnWeight.toFixed(2)}`)
      .join(" ");
    const top3 = probs
      .map((prob, vocabIdx) => ({ vocabIdx, prob }))
      .sort((first, second) => second.prob - first.prob)
      .slice(0, 3)
      .map(item => `${tokens.getWord(item.vocabIdx) ?? item.vocabIdx}(${(item.prob * 100).toFixed(1)}%)`)
      .join(", ");
    const lastToken = seq[seq.length - 1];
    // Top dims: baseDims by name, BIT_DIMS by bitmask value
    const dimEntries = [
      ...DIM_NAMES.map((name, i) => ({ label: name, val: tokenEmbed[lastToken][i] })),
      ...BIT_DIMS.map((mask, k) => ({ label: `bit:${mask}n`, val: tokenEmbed[lastToken][baseDims.length + k] })),
    ];
    const topDims = dimEntries
      .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
      .slice(0, 5)
      .map(d => `${d.label}:${d.val.toFixed(3)}`)
      .join(" ");
    console.log(`  [predict] attn=[${lastAlpha}] -> top3=[${top3}]`);
    console.log(`  [embed]   ${tokens.getWord(lastToken) ?? lastToken}: ${topDims}`);
  }
  return bestId;
}

export { tokens, MAX_LEN };

// ─── Read dataset & train ───
export async function train(epochs = 1000): Promise<void> {
  const rl = createInterface({ input: createReadStream(datasetFile, { encoding: "utf8" }) });
  const sequences: number[][] = [];

  for await (const line of rl) {
    const words = line
      .replace(/([?!.,;:])/g, " $1 ")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length > 0) words.push("\\n");

    const seq = words
      .map(word => tokens.get(word))
      .filter((id): id is number => id !== undefined);

    if (seq.length > 1) sequences.push(seq);
  }

  console.log(`[train] loaded ${sequences.length} sequences from ${path.resolve(datasetFile).replace(process.cwd(), '.')}`);
  sequences.forEach((seqItem, idx) => {
    const words = seqItem.map(id => tokens.getWord(id) ?? `?${id}`);
    console.log(`  [seq ${idx}] ${JSON.stringify(seqItem)} -> ${JSON.stringify(words)}`);
  });

  // ─── Inisialisasi tokenEmbed dari pola "X... is INTENT..., ..." di dataset ───
  // Semua kata sebelum "is" (kecuali terakhir) di-alias ke bitmask intent.
  // Semua kata dalam satu kelas dapat bitmask yang sama → vektor identik.
  const isId = tokens.get("is");
  if (isId !== undefined) {
    for (const line of readFileSync(datasetFile, "utf8").split(/\r?\n/)) {
      const words = line.replace(/([?!.,;:])/g, " $1 ").split(/\s+/).filter(Boolean);
      const sepIdx = words.findIndex(w => w === "," || w === ";");
      const beforeSep = sepIdx !== -1 ? words.slice(0, sepIdx) : words;
      const isIdx = beforeSep.indexOf("is");
      if (isIdx === -1 || isIdx >= beforeSep.length - 1) continue;

      // Subject = last word before "is" (e.g. "ga" in "bisa coding ga is ...")
      // Canonical = first subject of same intent class (for copyVec)
      const intentWords = beforeSep.slice(isIdx + 1);
      const intentIds = intentWords
        .map(w => tokens.get(w))
        .filter((x): x is number => x !== undefined);
      const mask = tokensToBitMask(intentIds);
      const dimIdx = bitDimIdx(mask);
      if (dimIdx === undefined) continue;

      // All subject words (everything before "is") get the same bitmask dim = 1
      // For phrase "bisa coding ga": subjects = all words, but canonical = first occurrence
      // → setiap kata subjek di-set ke dim intentnya = 1.0
      const subjectWords = beforeSep.slice(0, isIdx);
      for (const sw of subjectWords) {
        const swId = tokens.get(sw);
        if (swId === undefined) continue;
        tokenEmbed[swId][dimIdx] = 1.0;
        console.log(`  [init] "${sw}" ∈ intent bit:${mask}n (dim${dimIdx}) → embed[${dimIdx}]=1`);
      }

      // Kata intent juga dapat bitmask-nya sendiri jika mereka ada di BIT_DIMS
      // (opsional; biarkan saja untuk saat ini)
    }
  }

  // Filter: hanya latih sequence yang punya reply/say (bukan pure alias)
  const replyWithToken = tokens.get("reply");
  const trainSeqs = sequences.filter(seq => {
    if (replyWithToken !== undefined && seq.includes(replyWithToken)) return true;
    if (seq.includes(tokens.get("say")!)) return true;
    return false;
  });

  console.log(`[train] training ${trainSeqs.length} seqs × ${epochs} epochs…`);
  const logEvery = Math.max(1, Math.floor(epochs / 4));
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const seq of trainSeqs) trainSequence(seq);
    if ((epoch + 1) % logEvery === 0 || epoch === 0 || epoch + 1 === epochs) {
      const next = predictNext([tokens.get("halo")!]);
      console.log(`[train] epoch ${epoch + 1}/${epochs}: halo → ${tokens.getWord(next)}`);
    }
  }

  // ─── Save weights ───
  const currentVocabSize = tokens.size;
  const total = calcTotalWeights(currentVocabSize);
  const floats = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < currentVocabSize; i++) {
    for (let d = 0; d < embedDim; d++) floats[offset++] = tokenEmbed[i][d];
  }
  const writeMat = (src: number[][]) => {
    for (let i = 0; i < src.length; i++)
      for (let j = 0; j < src[i].length; j++) floats[offset++] = src[i][j];
  };
  writeMat(posEmbed);
  writeMat(queryWeight);
  writeMat(keyWeight);
  writeMat(valueWeight);
  writeMat(outputWeight);
  for (let i = 0; i < outputBias.length; i++) floats[offset++] = outputBias[i];
  writeFileSync(weightsFile, Buffer.from(floats.buffer));
  console.log(`[train] done! saved ${floats.length} floats (${floats.byteLength} bytes) to ${weightsFileRelative}`);
}

if (import.meta.main) {
  await train();
}
