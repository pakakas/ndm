// Belajar dari konteks: hitung kelas kata apa yang muncul di antara tetangganya.
//   - observe(): tiap kalimat tanpa kata asing menambah hitungan (kelas-kiri, kelas, kelas-kanan).
//   - pickPos(): memilih fitur untuk kata ber-kelas ganda ("pesan" = benda atau kerja).
//   - guess():   menebak kelas kata asing dari tetangganya.
// Semua deterministik: hitungan + beberapa prior tulisan tangan (SEEDS) supaya tebakan
// masuk akal sejak awal. Hitungan hasil belajar disimpan di tabel context_stats.
//   context/stats.ts (prior + hitungan + skor)  context/pick.ts  context/observe.ts
export { loadContext, resetContext, contextRows, type CtxRow } from "./context/stats";
export { pickPos, resolveAmbiguous, guess } from "./context/pick";
export { observe } from "./context/observe";
