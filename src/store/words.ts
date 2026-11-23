// Token id (words.id) dan sinkronisasi kata bawaan, termasuk migrasi tabel `learned` lama.
import type { SQL } from "bun";
import type { Pos } from "../types";
import { saveWord } from "./word-features";

/** Token id untuk sebuah kata; dibuat kalau belum ada. */
export async function wordId(sql: SQL, form: string): Promise<number> {
  await sql`INSERT OR IGNORE INTO words (form) VALUES (${form})`;
  const [r] = await sql`SELECT id FROM words WHERE form = ${form}`;
  return Number(r.id);
}

/**
 * Pastikan semua kata bawaan punya token id, pindahkan data tabel `learned` lama
 * (kalau ada), lalu kembalikan peta kata -> token id untuk seluruh kata.
 */
export async function syncWords(sql: SQL, builtin: string[]): Promise<Map<string, number>> {
  const have = new Set((await sql`SELECT form FROM words`).map((r: any) => r.form as string));
  for (const f of builtin) if (!have.has(f)) await sql`INSERT OR IGNORE INTO words (form) VALUES (${f})`;
  await migrateLegacy(sql);
  const map = new Map<string, number>();
  for (const r of await sql`SELECT id, form FROM words`) map.set(r.form, Number(r.id));
  return map;
}

async function migrateLegacy(sql: SQL): Promise<void> {
  const [t] = await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'learned'`;
  if (!t) return;
  const rows = await sql`SELECT word, pos, trans, alias_of, explanation, source_input FROM learned`;
  for (const r of rows as any[]) {
    const id = await wordId(sql, r.word);
    const aliasOf = r.alias_of ? String(r.alias_of) : undefined;
    const aliasId = aliasOf ? await wordId(sql, aliasOf) : undefined;
    await saveWord(
      sql,
      { id, word: r.word, poss: [r.pos as Pos], transitive: r.trans === "trans", intransitive: r.trans === "intrans", aliasOf, aliasId },
      r.explanation, r.source_input ?? undefined
    );
  }
  await sql`ALTER TABLE learned RENAME TO learned_legacy`;
}
