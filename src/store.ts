// Penyimpanan feedback (RLHF) dengan Bun.SQL + SQLite.
// Sistem ini simbolik, jadi "reward" tidak melatih bobot: feedback dipakai
// sebagai bahan perbaikan aturan dan sebagai tes regresi (lihat exportTests).
//
// Leksikon disimpan per fitur, satu tabel per fitur, semuanya diacu lewat token id (words.id):
//   words(id, form)               token id untuk setiap kata
//   word_pos(word_id, pos, rank)  kelas kata; satu kata boleh punya beberapa baris
//   transitive_verb(word_id)      kata kerja transitif
//   intransitive_verb(word_id)    kata kerja intransitif
//   word_alias(word_id, target_id) kata ini bermakna sama dengan kata target (keduanya token id)
//   word_log(word_id, ...)        penjelasan pengguna yang mengajarkan kata itu
//   context_stats(prev,pos,next,n) hitungan konteks untuk belajar dari kalimat
//   weights(intent,feature,w)      bobot intent 0..1; baris baru HANYA muncul lewat :good / :bad / :fix (default tidak disimpan)
//   sense_weights(word_id,pos,feature_id,w)  bobot pemilihan arti kata (semua nomor); lewat :sense <kata> <kelas>
//   enum_names(kind,id,name)       nama untuk nomor; kind 1 = fitur, 2 = kelas kata
//   tool_word(tool_id,word_id,role,pos,trans) kosakata milik tool; tool awal (math) diisi dari seed.ts sekali saja
//
// Kode per kelompok tugas ada di store/ (fungsi yang menerima `sql`); kelas ini hanya meneruskan.
import { SQL } from "bun";
import type { Features, Pos, Poses, WordRecord } from "./types";
import type { CtxRow } from "./context";
import type { EnvItem } from "./env";
import type { Tool } from "./tools";
import { createSchema } from "./store/schema";
import { seedTools } from "./store/seed-tools";
import * as fb from "./store/feedback";
import * as words from "./store/words";
import * as feat from "./store/word-features";
import * as train from "./store/weights";
import * as sense from "./store/sense";
import type { SenseRow } from "./attention";
import * as tools from "./store/tools";
import * as env from "./store/env";

export type { Stats, FeedbackExport } from "./store/feedback";

export class Store {
  public poses: Poses = undefined as never;
  private constructor(public sql: SQL) {}
  
  /** url contoh: "sqlite://rlhf.db" atau "sqlite://:memory:" */
  static async open(url = "sqlite://data/ndm.db"): Promise<Store> {
    const sql = new SQL(url);
    await createSchema(sql);
    await seedTools(sql);
    const store = new Store(sql);

    let poses = await store.sql`SELECT id,name FROM enum_names WHERE kind = 2`;
    store.poses = poses.reduce((map: any, row: any) => (map[row.name] = row.id, map), {})

    return store;
  }

  // interaksi dan feedback
  logInteraction(input: string, features: Features, response: string) { return fb.logInteraction(this.sql, input, features, response); }
  addFeedback(id: number, rating: 1 | -1, corrected?: Partial<Features>, note?: string) { return fb.addFeedback(this.sql, id, rating, corrected, note); }
  stats() { return fb.stats(this.sql); }
  exportTests() { return fb.exportTests(this.sql); }

  // leksikon: token id dan tabel fitur
  wordId(form: string) { return words.wordId(this.sql, form); }
  syncWords(builtin: string[]) { return words.syncWords(this.sql, builtin); }
  saveWord(w: WordRecord, explanation: string, sourceInput?: string) { return feat.saveWord(this.sql, w, explanation, sourceInput); }
  loadLexicon() { return feat.loadLexicon(this.sql); }
  explanations() { return feat.explanations(this.sql); }
  forgetWord(form: string) { return feat.forgetWord(this.sql, form); }

  // yang dilatih: konteks, bobot intent, bobot arti kata
  loadContext() { return train.loadContext(this.sql); }
  bumpContext(delta: CtxRow[]) { return train.bumpContext(this.sql, delta); }
  resetContext() { return train.resetContext(this.sql); }
  loadWeights() { return train.loadWeights(this.sql); }
  saveWeights(rows: Array<{ intent: string; feature: string; w: number }>) { return train.saveWeights(this.sql, rows); }
  resetWeights() { return train.resetWeights(this.sql); }
  loadSenseWeights() { return sense.loadSenseWeights(this.sql); }
  saveSenseWeights(rows: SenseRow[]) { return sense.saveSenseWeights(this.sql, rows); }
  resetSenseWeights() { return sense.resetSenseWeights(this.sql); }

  // tool dan harness
  saveTool(t: Tool) { return tools.saveTool(this.sql, t); }
  loadTools() { return tools.loadTools(this.sql); }
  deleteTool(name: string) { return tools.deleteTool(this.sql, name); }
  setEnv(items: EnvItem[]) { return env.setEnv(this.sql, items); }
  loadEnv() { return env.loadEnv(this.sql); }

  async close(): Promise<void> {
    await this.sql.close();
  }
}
