// Bobot pemilihan arti kata ambigu (attention). Bilangan bulat, boleh negatif; semua kolom nomor.
import type { SQL } from "bun";
import type { SenseRow } from "../attention";

export async function loadSenseWeights(sql: SQL): Promise<SenseRow[]> {
  const rows = await sql`SELECT word_id, pos, feature_id, w FROM sense_weights`;
  return rows.map((r: any) => ({ wordId: Number(r.word_id), pos: Number(r.pos), feature: Number(r.feature_id), w: Number(r.w) }));
}

export async function saveSenseWeights(sql: SQL, rows: SenseRow[]): Promise<void> {
  for (const r of rows)
    await sql`
      INSERT INTO sense_weights (word_id, pos, feature_id, w) VALUES (${r.wordId}, ${r.pos}, ${r.feature}, ${r.w})
      ON CONFLICT(word_id, pos, feature_id) DO UPDATE SET w = excluded.w, updated_at = CURRENT_TIMESTAMP`;
}

export async function resetSenseWeights(sql: SQL): Promise<void> {
  await sql`DELETE FROM sense_weights`;
}