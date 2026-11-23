// Tool bawaan (math): diisi dari seed.ts sekali saja, lalu kata seed yang belum ada ditambahkan ke DB lama.
import type { SQL } from "bun";
import { MATH_TOOL } from "../seed";
import type { Pos, Trans } from "../types";
import { saveTool } from "./tools";
import { wordId } from "./words";

export async function seedTools(sql: SQL): Promise<void> {
  const [n] = await sql`SELECT COUNT(*) AS n FROM tools`;
  if (Number(n.n) === 0) {
    const math = structuredClone(MATH_TOOL);
    const [legacy] = await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'seed_math'`;
    if (legacy) { // migrasi: pakai isi seed_math lama, termasuk perubahan yang pernah kamu buat
      const rows = await sql`SELECT word, pos, trans, role FROM seed_math ORDER BY rowid`;
      if (rows.length)
        math.words = rows.map((r: any) => ({
          word: r.word, role: r.role, trans: r.trans as Trans, poss: String(r.pos).split(",").filter(Boolean) as Pos[],
        }));
    }
    await saveTool(sql, math);
  }
  // Baris yang sudah ada tidak ditimpa.
  const [mt] = await sql`SELECT id FROM tools WHERE name = ${MATH_TOOL.name}`;
  if (mt)
    for (const w of MATH_TOOL.words ?? [])
      await sql`INSERT OR IGNORE INTO tool_word (tool_id, word_id, role, pos, trans)
                VALUES (${mt.id}, ${await wordId(sql, w.word)}, ${w.role}, ${w.poss.join(",")}, ${w.trans})`;
}
