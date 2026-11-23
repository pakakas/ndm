import type { Features } from "../src/types";

export const HELP = `Perintah:
  :good                 tandai jawaban terakhir benar (+1)
  :bad [catatan]        tandai jawaban terakhir salah (-1)
  :fix k=v [k=v ...]    beri koreksi fitur, mis. :fix intent=request sentence_type=question
  :kata <kata>          lihat fitur sebuah kata (token id, kelas, transitivitas, alias)
  :id <kata|angka>      cari token id sebuah kata, atau kata dari token id
  :edit <kata> k=v ...  ubah fitur kata: pos=, trans=, alias= (alias=- untuk hapus)
                        pos boleh banyak: pos=noun,verb (kata dengan beberapa fitur)
  :konteks [reset]      hitungan konteks yang dipelajari (atau hapus)
  :kelas                daftar kelas kata yang saya kenal
  :learned              daftar kata yang sudah dipelajari (dengan token id)
  :forget <kata>        lupakan kata yang dipelajari
  :weights              tampilkan bobot intent (0..1)
  :sense [kata kelas]   lihat skor pemilihan arti kata ambigu di kalimat terakhir, atau latih: :sense bisa noun (reset: hapus latihan)
  :reset                kembalikan bobot ke nilai awal
  :env                  lihat konteks harness (proyek, workspace, pengguna, folder)
  :stats                ringkasan feedback
  :export               cetak feedback sebagai baris tes
  :rlhf                 hidup/matikan hint untuk pemberi penjelasan (atau jalankan dengan --rlhf)
  :debug                tampilkan/sembunyikan fitur dan token
  :help                 bantuan
  :quit                 keluar (atau Ctrl+D)`;

export const FEATURE_KEYS: Array<keyof Features> = [
  "language", "intent", "sentence_count", "sentence_type",
  "clause_count", "subject_omitted", "split_actions", "object_shared",
];
