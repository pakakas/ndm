// Tabel tool: kosakata milik tool, dicatat sebagai token id.
import type { SQL } from "bun";

export async function createToolTables(sql: SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tool_verb (
      tool_id INTEGER NOT NULL REFERENCES tools(id),
      word_id INTEGER NOT NULL REFERENCES words(id),
      PRIMARY KEY (tool_id, word_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tool_object (
      tool_id INTEGER NOT NULL REFERENCES tools(id),
      word_id INTEGER NOT NULL REFERENCES words(id),
      PRIMARY KEY (tool_id, word_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tool_word (
      tool_id INTEGER NOT NULL REFERENCES tools(id),
      word_id INTEGER NOT NULL REFERENCES words(id),
      role TEXT NOT NULL,
      pos TEXT NOT NULL,
      trans TEXT NOT NULL,
      PRIMARY KEY (tool_id, word_id)
    )`;
}
