// Tabel leksikon: satu tabel per fitur kata, semuanya diacu lewat token id (words.id).
import type { SQL } from "bun";

export async function createLexiconTables(sql: SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS word_pos (
      word_id INTEGER NOT NULL REFERENCES words(id),
      pos INTEGER NOT NULL,
      rank INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (word_id, pos)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS transitive_verb (
      word_id INTEGER PRIMARY KEY REFERENCES words(id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS intransitive_verb (
      word_id INTEGER PRIMARY KEY REFERENCES words(id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS word_alias (
      word_id INTEGER PRIMARY KEY REFERENCES words(id),
      target_id INTEGER NOT NULL REFERENCES words(id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS word_log (
      word_id INTEGER PRIMARY KEY REFERENCES words(id),
      explanation TEXT NOT NULL,
      source_input TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
}
