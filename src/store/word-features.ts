// Fitur kata: tiap fitur punya tabelnya sendiri (word_pos, transitive_verb, intransitive_verb, word_alias).
import type { SQL } from "bun";
import type { Pos, WordRecord } from "../types";

/** Simpan (atau timpa) semua fitur sebuah kata, masing-masing ke tabelnya. */
export async function saveWord(sql: SQL, w: WordRecord, explanation: string, sourceInput?: string): Promise<void> {
  await sql`INSERT OR IGNORE INTO words (id, form) VALUES (${w.id}, ${w.word})`;
  await clearFeatures(sql, w.id);
  for (const [rank, pos] of w.poss.entries())
    await sql`INSERT INTO word_pos (word_id, pos, rank) VALUES (${w.id}, ${pos}, ${rank})`;
  if (w.transitive) await sql`INSERT INTO transitive_verb (word_id) VALUES (${w.id})`;
  if (w.intransitive) await sql`INSERT INTO intransitive_verb (word_id) VALUES (${w.id})`;
  if (w.aliasOf && w.aliasId !== undefined) {
    await sql`INSERT OR IGNORE INTO words (id, form) VALUES (${w.aliasId}, ${w.aliasOf})`;
    await sql`INSERT INTO word_alias (word_id, target_id) VALUES (${w.id}, ${w.aliasId})`;
  }
  await sql`
    INSERT INTO word_log (word_id, explanation, source_input) VALUES (${w.id}, ${explanation}, ${sourceInput ?? null})
    ON CONFLICT(word_id) DO UPDATE SET
      explanation = excluded.explanation, source_input = excluded.source_input,
      created_at = CURRENT_TIMESTAMP`;
}

async function clearFeatures(sql: SQL, id: number): Promise<void> {
  await sql`DELETE FROM word_pos WHERE word_id = ${id}`;
  await sql`DELETE FROM transitive_verb WHERE word_id = ${id}`;
  await sql`DELETE FROM intransitive_verb WHERE word_id = ${id}`;
  await sql`DELETE FROM word_alias WHERE word_id = ${id}`;
}

/** Semua kata yang punya fitur tersimpan (dipelajari atau diedit), dirakit dari tabel-tabel fitur. */
export async function loadLexicon(sql: SQL): Promise<WordRecord[]> {
  const forms = new Map<number, string>();
  for (const r of await sql`SELECT id, form FROM words`) forms.set(Number(r.id), r.form);
  const poss = new Map<number, Pos[]>();
  for (const r of await sql`SELECT word_id, pos FROM word_pos ORDER BY word_id, rank`) {
    const id = Number(r.word_id);
    poss.set(id, [...(poss.get(id) ?? []), r.pos as Pos]);
  }
  const ids = async (table: "transitive_verb" | "intransitive_verb") =>
    new Set<number>(
      (table === "transitive_verb"
        ? await sql`SELECT word_id FROM transitive_verb`
        : await sql`SELECT word_id FROM intransitive_verb`).map((r: any) => Number(r.word_id))
    );
  const trans = await ids("transitive_verb");
  const intrans = await ids("intransitive_verb");
  const alias = new Map<number, number>();
  for (const r of await sql`SELECT word_id, target_id FROM word_alias`) alias.set(Number(r.word_id), Number(r.target_id));

  const out: WordRecord[] = [];
  for (const [id, p] of poss) {
    const aliasId = alias.get(id);
    out.push({
      id, word: forms.get(id)!, poss: p,
      transitive: trans.has(id), intransitive: intrans.has(id),
      aliasId, aliasOf: aliasId !== undefined ? forms.get(aliasId) : undefined,
    });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** Penjelasan pengguna per kata (untuk :learned). */
export async function explanations(sql: SQL): Promise<Map<string, string>> {
  const rows = await sql`SELECT w.form AS form, l.explanation AS explanation FROM word_log l JOIN words w ON w.id = l.word_id`;
  return new Map(rows.map((r: any) => [r.form as string, r.explanation as string]));
}

/** Hapus semua fitur kata; token id tetap ada. Mengembalikan false kalau tidak ada yang dihapus. */
export async function forgetWord(sql: SQL, form: string): Promise<boolean> {
  const [w] = await sql`SELECT id FROM words WHERE form = ${form}`;
  if (!w) return false;
  const id = Number(w.id);
  const gone = await sql`DELETE FROM word_pos WHERE word_id = ${id} RETURNING word_id`;
  await clearFeatures(sql, id);
  await sql`DELETE FROM word_log WHERE word_id = ${id}`;
  return gone.length > 0;
}
