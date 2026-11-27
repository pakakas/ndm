# Design Notes: Named Features & Runtime Alias/Auto-Train

## 1. Named Token Embeddings (`tokenEmbed`) [Implemented]
- Setiap token memiliki embedding flat `number[]` sepanjang `embedDim`.
- **baseDims** (index 0..31): fitur linguistik berlabel teks (`"verb"`, `"noun"`, ...).
- **BIT_DIMS** (index 32+): dimensi intent dikodekan sebagai BigInt bitmask dari token-id kata intent.

## 2. BigInt Bitmask Intent Dimensions [Implemented]
- Dari pola `X... is Y Z W..., reply...` di dataset:
  - Ambil kata setelah `is` sampai tanda `,` atau `;` → **intent phrase**.
  - Tiap kata intent → token ID → `mask |= (1n << BigInt(id))`.
  - Mask unik = satu dimensi tambahan di `BIT_DIMS`.
- Semua kata sebelum `is` di-set `embed[bitDimIdx] = 1.0`.
- **Alias otomatis**: `halo`, `hi`, `helo` → `bit:4n = 1`; `kau bisa coding ga` **dan** `bisa coding ga` → `bit:950272n = 1`.
- Inferensi `"bisa coding ga"` kini memberikan reply yang sama dengan `"kau bisa coding ga"`.

```
greeting        → token ids: [2]           → mask: 4n
asking for coding capability → ids: [17,18,15,19] → mask: 950272n

halo  embed[bit:4n]      = 1.0  ✓ alias dengan hi, helo
bisa  embed[bit:950272n] = 1.0  ✓ alias dengan kau (dari "bisa coding ga is ...")
```

## 3. Inisialisasi & Pewarisan Vektor (`X is Y`) [Implemented — via bitmask]
- `train()` membaca setiap baris `X... is INTENT, ...`:
  - Hitung `mask` dari token id kata intent.
  - Cari `dimIdx = baseDims.length + BIT_DIMS.indexOf(mask)`.
  - Set `tokenEmbed[X][dimIdx] = 1.0` untuk setiap kata X sebelum `is`.
- Kata dalam kelas intent yang sama langsung punya representasi awal serupa.

## 4. Persistensi Bobot Biner (`neocortex/learned.weights`) [Implemented]
- Setelah `train(epochs)` selesai, seluruh bobot disimpan sebagai flat `Float32Array` biner.
- Urutan: `tokenEmbed` → `posEmbed` → `queryWeight` → `keyWeight` → `valueWeight` → `outputWeight` → `outputBias`.
- Saat startup, bobot dimuat otomatis jika ada; size mismatch → skip (tidak crash).

## 5. Streaming Inference & REPL (`infer.ts`, `cli/`) [Implemented]
- `inferStream` di `src/infer.ts` → streaming token satu per satu.
- `cli/converse.ts` → `process.stdout.write` + `Bun.sleep(50)` per token.
- REPL commands di `cli/handle.ts`:
  - `:train <n>` — latih `n` epoch (default `1000`).
  - `:think` — toggle tampilan `<think>...</think>`.

## 6. Runtime Auto-Train / Alias dari Input [Planned]
- Ketika user mengetik `X is Y Z W` di REPL:
  1. Hitung bitmask dari `[Y, Z, W]`.
  2. Tambahkan ke `BIT_DIMS` jika baru.
  3. Panggil `ensureWord(X)` dan set `embed[bitDimIdx] = 1.0`.
  4. Inferensi berikutnya langsung pakai alias tanpa retrain.
- **Tanpa retrain** — alias langsung aktif di embedding.

## 7. Arsitektur Model

```
Input: token ids sequence
  ↓
tokenEmbed[id] + posEmbed[step]   ← flat number[embedDim]
  ↓
Causal Self-Attention (Q·K/√d → softmax → ·V)
  ↓
outputWeight · ctx + outputBias
  ↓
softmax → argmax → next token id
```

**Training**: SGD, LR=0.02. `tokenEmbed` dibekukan (tidak diupdate lewat gradien); hanya `posEmbed`, `queryWeight`, `keyWeight`, `valueWeight`, `outputWeight`, `outputBias` yang dilatih.
