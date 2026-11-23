// Tool beserta kosakatanya. Kata kerja dan benda dicatat sebagai token id.
import type { SQL } from "bun";
import type { Pos, Trans } from "../types";
import type { Tool, ToolWord } from "../tools";
import { wordId } from "./words";

/** Simpan atau timpa satu tool. */
export async function saveTool(sql: SQL, t: Tool): Promise<void> {
  await sql`
    INSERT INTO tools (name, description) VALUES (${t.name}, ${t.description})
    ON CONFLICT(name) DO UPDATE SET description = excluded.description, updated_at = CURRENT_TIMESTAMP`;

  const [row] = await sql`SELECT id FROM tools WHERE name = ${t.name}`;
  const id = Number(row.id);
  await sql`DELETE FROM tool_verb WHERE tool_id = ${id}`;
  await sql`DELETE FROM tool_object WHERE tool_id = ${id}`;
  await sql`DELETE FROM tool_word WHERE tool_id = ${id}`;

  for (const w of t.words ?? [])
    await sql`INSERT OR IGNORE INTO tool_word (tool_id, word_id, role, pos, trans)
                   VALUES (${id}, ${await wordId(sql, w.word)}, ${w.role}, ${w.poss.join(",")}, ${w.trans})`;

  for (const v of new Set(t.verbs))
    await sql`INSERT INTO tool_verb (tool_id, word_id) VALUES (${id}, ${await wordId(sql, v)})`;
  for (const o of new Set(t.objects ?? []))
    await sql`INSERT INTO tool_object (tool_id, word_id) VALUES (${id}, ${await wordId(sql, o)})`;
}

export async function loadTools(sql: SQL): Promise<Tool[]> {
  const out: Tool[] = [];
  for (const r of await sql`SELECT id, name, description FROM tools ORDER BY id`) {
    const verbs = await sql`SELECT w.form AS f FROM tool_verb v JOIN words w ON w.id = v.word_id WHERE v.tool_id = ${r.id} ORDER BY w.form`;
    const objs = await sql`SELECT w.form AS f FROM tool_object o JOIN words w ON w.id = o.word_id WHERE o.tool_id = ${r.id} ORDER BY w.form`;
    const ws = await sql`
      SELECT w.form AS f, tw.role AS role, tw.pos AS pos, tw.trans AS trans
      FROM tool_word tw JOIN words w ON w.id = tw.word_id WHERE tw.tool_id = ${r.id} ORDER BY tw.rowid`;
    const words = ws.map((x: any) => ({ word: x.f, role: x.role, trans: x.trans as Trans, poss: String(x.pos).split(",").filter(Boolean) as Pos[] }));
    out.push({
      name: r.name, description: r.description, words,
      verbs: [...new Set([...verbs.map((x: any) => x.f), ...words.filter((w: ToolWord) => w.poss.includes("verb")).map((w: ToolWord) => w.word)])],
      objects: objs.map((x: any) => x.f),
    });
  }
  return out;
}

export async function deleteTool(sql: SQL, name: string): Promise<boolean> {
  const [t] = await sql`SELECT id FROM tools WHERE name = ${name}`;
  if (!t) return false;
  await sql`DELETE FROM tool_verb WHERE tool_id = ${t.id}`;
  await sql`DELETE FROM tool_object WHERE tool_id = ${t.id}`;
  await sql`DELETE FROM tool_word WHERE tool_id = ${t.id}`;
  await sql`DELETE FROM tools WHERE id = ${t.id}`;
  return true;
}
