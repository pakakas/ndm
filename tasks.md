# Tasks

## ✅ Done

- [x] Named token embeddings (`TokenEmbed = Record<DimName, number>`) dengan `DIM_NAMES`
- [x] `X is Y` → `copyVecFrom(Y)` alias init di `train()`
- [x] Binary Float32Array weights save/load (`neocortex/learned.weights`)
- [x] Streaming inference (`inferStream` generator + `cli/converse.ts`)
- [x] REPL commands: `:train <n>`, `:think`
- [x] **BigInt bitmask intent dimensions** (`BIT_DIMS: bigint[]`)
  - Parse `X... is INTENT..., ...` → bitmask dari token-id intent phrase
  - `TokenEmbed` jadi `number[]` flat (lebih efisien, tanpa string key overhead)
  - Semua kata sebelum `is` di-set `embed[bitDimIdx] = 1.0`
  - Alias multi-token: `"bisa coding ga"` ≡ `"kau bisa coding ga"` via dim `bit:950272n`

## 🔄 In Progress

- [ ] Verifikasi alias: `infer("bisa coding ga")` = `infer("kau bisa coding ga")` = `ya saya bisa membantu coding`

## 📋 Planned

- [ ] **Runtime alias dari input** (Design §6)
  - User ketik `X is Y Z` di REPL
  - Hitung bitmask, tambah ke `BIT_DIMS` jika baru, set embed → langsung aktif
  - Tanpa retrain dataset

- [ ] **Multi-head attention** (saat ini single-head)
  - `numHeads = 4`, `headDim = embedDim / numHeads`
  - Concat heads → linear projection

- [ ] **Dataset expansion**
  - Tambah topik: sapa nama, tanya kabar, kemampuan lain
  - Format: `X is INTENT, reply with: RESPONSE`

- [ ] **Confidence threshold**
  - Jika `max(probs) < threshold` → reply `"maaf, saya tidak mengerti"`
  - Hindari hallucination dari input tidak dikenal

- [ ] **Persistence BIT_DIMS**
  - Simpan `BIT_DIMS` ke file (JSON/biner) agar runtime alias bertahan restart
  - Load saat startup sebelum `loadSavedWeights()`

- [ ] **`:save` / `:load` REPL commands**
  - `:save` → eksplisit simpan weights + vocab + BIT_DIMS
  - `:load` → reload tanpa restart proses

## 🐛 Known Issues

- `infer("bisa coding ga")` belum terverifikasi post-bitmask (perlu retrain)
- `tokenEmbed` dibekukan dari gradien — intentional, tapi belum ada mekanisme unfreeze selektif
- `BIT_DIMS` tidak disimpan ke disk; hilang saat restart (akan fixed di "Persistence BIT_DIMS")
