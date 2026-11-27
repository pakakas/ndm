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
const LR = 0.01;               // learning rate (aman dengan gradient clipping)

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
const NUM_HEADS = 2;
const HEAD_DIM  = Math.floor(embedDim / NUM_HEADS); // 17

console.log(`[init] vocab=${vocabSize}, embedDim=${embedDim} (${baseDims.length} baseDims + ${BIT_DIMS.length} bitDims), heads=${NUM_HEADS}×${HEAD_DIM}, MAX_LEN=${MAX_LEN}, LR=${LR}`);
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

// ─── Model params (Multi-Head Causal Self-Attention) ───
const tokenEmbed: TokenEmbed[] = randEmbed(vocabSize);
const posEmbed = randMatrix(MAX_LEN, embedDim);
// Tiap head punya Qh, Kh, Vh: [HEAD_DIM × embedDim]
const queryWeights = Array.from({ length: NUM_HEADS }, () => randMatrix(HEAD_DIM, embedDim));
const keyWeights   = Array.from({ length: NUM_HEADS }, () => randMatrix(HEAD_DIM, embedDim));
const valueWeights = Array.from({ length: NUM_HEADS }, () => randMatrix(HEAD_DIM, embedDim));
// Projection akhir W_O: concat semua head → embedDim
const outputProjWeight = randMatrix(embedDim, embedDim); // W_O
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
  // tokenEmbed + posEmbed + (Qh+Kh+Vh)*NUM_HEADS + W_O + outputWeight + outputBias
  return vSize * embedDim
    + MAX_LEN * embedDim
    + NUM_HEADS * 3 * embedDim * HEAD_DIM
    + embedDim * embedDim
    + vSize * embedDim
    + vSize;
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
    for (let h = 0; h < NUM_HEADS; h++) {
      readMat(queryWeights[h]);
      readMat(keyWeights[h]);
      readMat(valueWeights[h]);
    }
    readMat(outputProjWeight);
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

// ─── Forward pass over full sequence (Multi-Head) ───
function forwardSequence(seq: number[]) {
  const seqLen = seq.length;
  const inputs = seq.map((tokenId, step) =>
    Array.from({ length: embedDim }, (_, dim) => tokenEmbed[tokenId][dim] + posEmbed[step][dim])
  );

  const scale = Math.sqrt(HEAD_DIM);
  const headQueries: number[][][] = [];
  const headKeys: number[][][] = [];
  const headValues: number[][][] = [];
  const headAlphas: number[][][] = [];
  const headCtx: number[][][] = [];

  for (let h = 0; h < NUM_HEADS; h++) {
    const qh = inputs.map(v => matVec(queryWeights[h], v));
    const kh = inputs.map(v => matVec(keyWeights[h], v));
    const vh = inputs.map(v => matVec(valueWeights[h], v));
    const alphasH: number[][] = [];
    const ctxH: number[][] = [];

    for (let step = 0; step < seqLen; step++) {
      const scores: number[] = [];
      for (let prevStep = 0; prevStep <= step; prevStep++) {
        let dot = 0;
        for (let d = 0; d < HEAD_DIM; d++) dot += qh[step][d] * kh[prevStep][d];
        scores.push(dot / scale);
      }
      const alpha = softmax(scores);
      alphasH.push(alpha);

      const c = new Array(HEAD_DIM).fill(0);
      for (let prevStep = 0; prevStep <= step; prevStep++) {
        for (let d = 0; d < HEAD_DIM; d++) c[d] += alpha[prevStep] * vh[prevStep][d];
      }
      ctxH.push(c);
    }

    headQueries.push(qh);
    headKeys.push(kh);
    headValues.push(vh);
    headAlphas.push(alphasH);
    headCtx.push(ctxH);
  }

  const concatCtx: number[][] = [];
  const ctx: number[][] = [];
  const logits: number[][] = [];
  for (let step = 0; step < seqLen; step++) {
    const cat: number[] = [];
    for (let h = 0; h < NUM_HEADS; h++) cat.push(...headCtx[h][step]);
    while (cat.length < embedDim) cat.push(0); // pad jika embedDim ganjil
    concatCtx.push(cat);
    const proj = matVec(outputProjWeight, cat);
    ctx.push(proj);
    logits.push(matVec(outputWeight, proj).map((val, vocabIdx) => val + outputBias[vocabIdx]));
  }

  return { inputs, headQueries, headKeys, headValues, headAlphas, alphas: headAlphas[0], concatCtx, ctx, logits };
}

function clip(val: number, limit = 1.0): number {
  if (!Number.isFinite(val)) return 0;
  return val > limit ? limit : val < -limit ? -limit : val;
}

// ─── Train one sequence (SGD, Multi-Head) ───
function trainSequence(seq: number[]): void {
  const seqLen = seq.length;
  if (seqLen < 2) return;

  const { inputs, headQueries, headKeys, headValues, headAlphas, concatCtx, ctx, logits } = forwardSequence(seq);
  const scale = Math.sqrt(HEAD_DIM);

  const dHeadQ = Array.from({ length: NUM_HEADS }, () => Array.from({ length: seqLen }, () => new Array(HEAD_DIM).fill(0)));
  const dHeadK = Array.from({ length: NUM_HEADS }, () => Array.from({ length: seqLen }, () => new Array(HEAD_DIM).fill(0)));
  const dHeadV = Array.from({ length: NUM_HEADS }, () => Array.from({ length: seqLen }, () => new Array(HEAD_DIM).fill(0)));

  for (let step = 0; step < seqLen - 1; step++) {
    const targetId = seq[step + 1];
    const probs = softmax(logits[step]);
    const dLogits = probs.map((prob, vocabIdx) => prob - (vocabIdx === targetId ? 1 : 0));

    const dCtx = new Array(embedDim).fill(0);
    for (let vocabIdx = 0; vocabIdx < tokens.size; vocabIdx++) {
      outputBias[vocabIdx] -= LR * clip(dLogits[vocabIdx]);
      for (let dim = 0; dim < embedDim; dim++) {
        dCtx[dim] += outputWeight[vocabIdx][dim] * dLogits[vocabIdx];
        outputWeight[vocabIdx][dim] -= LR * clip(dLogits[vocabIdx] * ctx[step][dim]);
      }
    }

    // Backprop through W_O (outputProjWeight)
    const dConcat = new Array(embedDim).fill(0);
    for (let row = 0; row < embedDim; row++) {
      for (let col = 0; col < embedDim; col++) {
        dConcat[col] += outputProjWeight[row][col] * dCtx[row];
        outputProjWeight[row][col] -= LR * clip(dCtx[row] * concatCtx[step][col]);
      }
    }

    // Backprop per head
    for (let h = 0; h < NUM_HEADS; h++) {
      const hOffset = h * HEAD_DIM;
      const dAlpha = new Array(step + 1).fill(0);
      for (let prevStep = 0; prevStep <= step; prevStep++) {
        for (let d = 0; d < HEAD_DIM; d++) {
          dAlpha[prevStep] += dConcat[hOffset + d] * headValues[h][prevStep][d];
          dHeadV[h][prevStep][d] += headAlphas[h][step][prevStep] * dConcat[hOffset + d];
        }
      }

      let dotAlpha = 0;
      for (let prevStep = 0; prevStep <= step; prevStep++) {
        dotAlpha += headAlphas[h][step][prevStep] * dAlpha[prevStep];
      }
      for (let prevStep = 0; prevStep <= step; prevStep++) {
        const dScore = headAlphas[h][step][prevStep] * (dAlpha[prevStep] - dotAlpha) / scale;
        for (let d = 0; d < HEAD_DIM; d++) {
          dHeadQ[h][step][d] += dScore * headKeys[h][prevStep][d];
          dHeadK[h][prevStep][d] += dScore * headQueries[h][step][d];
        }
      }
    }
  }

  for (let step = 0; step < seqLen; step++) {
    const dInput = new Array(embedDim).fill(0);
    for (let h = 0; h < NUM_HEADS; h++) {
      for (let row = 0; row < HEAD_DIM; row++) {
        for (let col = 0; col < embedDim; col++) {
          dInput[col] +=
            queryWeights[h][row][col] * dHeadQ[h][step][row] +
            keyWeights[h][row][col] * dHeadK[h][step][row] +
            valueWeights[h][row][col] * dHeadV[h][step][row];
          queryWeights[h][row][col] -= LR * clip(dHeadQ[h][step][row] * inputs[step][col]);
          keyWeights[h][row][col] -= LR * clip(dHeadK[h][step][row] * inputs[step][col]);
          valueWeights[h][row][col] -= LR * clip(dHeadV[h][step][row] * inputs[step][col]);
        }
      }
    }
    // tokenEmbed dibekukan; hanya posEmbed yang diupdate lewat gradien
    for (let dim = 0; dim < embedDim; dim++) {
      posEmbed[step][dim] -= LR * clip(dInput[dim]);
    }
  }
}

// ─── Predict next token (argmax + repeat penalty) ───
export function predictNext(seq: number[], verbose = false, recent?: Map<number, number>, penalty = 2.0): number {
  const { logits, headAlphas } = forwardSequence(seq);
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
    const headColors = ["\x1b[36m", "\x1b[35m", "\x1b[34m", "\x1b[33m"];
    const reset = "\x1b[0m";
    const headLogs = headAlphas.map((alphasH, h) => {
      const color = headColors[h % headColors.length];
      const weights = alphasH[alphasH.length - 1]
        .map((w, idx) => `${tokens.getWord(seq[idx]) ?? seq[idx]}:${w.toFixed(2)}`)
        .join(" ");
      return `${color}attn${h}=[${weights}]${reset}`;
    }).join(" | ");
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
    console.log(`  [predict] ${headLogs}`);
    console.log(`  \x1b[32m[probs]   top3=[${top3}] -> chosen="${tokens.getWord(bestId) ?? bestId}"${reset}`);
    console.log(`  \x1b[33m[embed]   ${tokens.getWord(lastToken) ?? lastToken}: ${topDims}${reset}`);
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
  for (let h = 0; h < NUM_HEADS; h++) {
    writeMat(queryWeights[h]);
    writeMat(keyWeights[h]);
    writeMat(valueWeights[h]);
  }
  writeMat(outputProjWeight);
  writeMat(outputWeight);
  for (let i = 0; i < outputBias.length; i++) floats[offset++] = outputBias[i];
  writeFileSync(weightsFile, Buffer.from(floats.buffer));
  console.log(`[train] done! saved ${floats.length} floats (${floats.byteLength} bytes) to ${weightsFileRelative}`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let epochs = 1000;
  const idx = args.indexOf("--epoch");
  if (idx !== -1 && args[idx + 1]) {
    const parsed = Number(args[idx + 1]);
    if (parsed > 0) epochs = Math.floor(parsed);
  } else {
    const eqArg = args.find(a => a.startsWith("--epoch="));
    if (eqArg) {
      const parsed = Number(eqArg.split("=")[1]);
      if (parsed > 0) epochs = Math.floor(parsed);
    }
  }
  await train(epochs);
}
