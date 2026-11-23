// Konteks harness (proyek, workspace, pengguna, folder), diacu lewat token id label.
import type { SQL } from "bun";
import type { EnvItem } from "../env";
import { wordId } from "./words";

/** Ganti seluruh env; kembalikan label -> words.id supaya token id label harness stabil. */
export async function setEnv(sql: SQL, items: EnvItem[]): Promise<Map<string, number>> {
  await sql`DELETE FROM env`; // harness adalah sumber kebenaran: ganti seluruhnya tiap sesi
  const ids = new Map<string, number>();
  for (const e of items) {
    const id = await wordId(sql, e.label);
    ids.set(e.label, id);
    await sql`INSERT INTO env (kind, word_id, value) VALUES (${e.kind}, ${id}, ${e.value})`;
  }
  return ids;
}

export async function loadEnv(sql: SQL): Promise<EnvItem[]> {
  const rows = await sql`SELECT e.kind AS kind, w.form AS label, e.value AS value FROM env e JOIN words w ON w.id = e.word_id ORDER BY w.form`;
  return rows.map((r: any) => ({ kind: r.kind, label: r.label, value: r.value }));
}
