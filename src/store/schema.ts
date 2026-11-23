// Skema database. Tabel leksikon dan tool ada di file sendiri (schema-lexicon, schema-tools).
import type { SQL } from "bun";
import { createLexiconTables } from "./schema-lexicon";
import { createToolTables } from "./schema-tools";

export async function createSchema(sql: SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      input TEXT NOT NULL,
      features TEXT NOT NULL,
      response TEXT NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_id INTEGER NOT NULL REFERENCES interactions(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
      corrected TEXT,
      note TEXT
    )`;
  await createLexiconTables(sql);
  await sql`
    CREATE TABLE IF NOT EXISTS context_stats (
      prev TEXT NOT NULL,
      pos TEXT NOT NULL,
      next TEXT NOT NULL,
      n INTEGER NOT NULL,
      PRIMARY KEY (prev, pos, next)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS weights (
      intent INTEGER NOT NULL,
      feature TEXT NOT NULL,
      w REAL NOT NULL CHECK (w >= 0 AND w <= 1),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (intent, feature)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS sense_weights (
      key TEXT NOT NULL,
      feature TEXT NOT NULL,
      w INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (key, feature)
    )`;
  await createToolTables(sql);

  await sql`CREATE INDEX IF NOT EXISTS idx_feedback_interaction ON feedback(interaction_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS env (
      kind TEXT NOT NULL,
      word_id INTEGER NOT NULL REFERENCES words(id),
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (kind, word_id)
    )`;
}
