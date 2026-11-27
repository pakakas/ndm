import { learn } from "../src";
import { setUnknownWordHook } from "../src/hooks";
import { Store } from "../src/store";
import { classifyKbbiKemendik } from "./kbbi.kemendik";

export async function registerLearnWord(store: Store): void {
  setUnknownWordHook(async (sql, word, ctx) => {
    const existing = await store.sql`SELECT id FROM words WHERE form = ${word}`;
    if (existing.length) return null; // sudah known, tidak perlu hook

    const classes = await classifyKbbiKemendik(word, (entry: any) => {});
    if (!classes?.length) return null;

    const [w] = await sql`INSERT INTO words (form) VALUES (${word}) RETURNING id`;

    for (const cls of classes) {
      await store.sql`INSERT INTO word_pos (word_id, pos, rank) VALUES (${w.id}, ${store.poses[cls.pos]}, 0)`;
      await store.sql`INSERT INTO word_log (word_id, explanation, source_input) VALUES (${w.id}, ${cls.gloss}, ${cls.source ?? ""})`;
    }

    learn(word, { pos: cls.pos, trans: "none" }, w.id)

    return { pos: cls.pos, alts: cls.alts, gloss: cls.gloss };
  });
}   