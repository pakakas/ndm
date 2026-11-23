// Weight space programming untuk pemilihan sense. Deterministik: bilangan bulat, tanpa acak,
// tanpa softmax, tanpa exp. Semua dimensi punya nama tata bahasa.
//
//   1. Embedding: tiap token = one-hot kelas katanya saat ini ({ verb: 1 })      -> attention/heads.ts
//   2. Head (hard attention) -> fitur "<head>.<dimensi>", at_start/at_end, gerbang ReLU -> attention/features.ts
//   3. Bobot "*|pos" tulisan tangan + "kata|pos" hasil latihan; skor dan pilihan   -> attention/weights.ts
//   4. Seri -> kelas utama (alts[0]); beberapa putaran per kalimat                 -> attention/resolve.ts
//   5. Pelatihan perceptron ±1 (:sense kata kelas)                                 -> attention/train.ts
export * from "./attention/heads";
export * from "./attention/names";
export * from "./attention/features";
export * from "./attention/weights";
export * from "./attention/resolve";
export * from "./attention/train";
