// Tabel bobot pemilihan arti kata: semuanya nomor. enum_names mencatat nama tiap nomor (fitur, kelas kata)
// dan menjaga supaya nomor tidak bergeser kalau daftar di kode berubah.
import type { SQL } from "bun";
import { ENUM_KIND, featId, featNames, posId, POS_LIST } from "../attention/names";
import { wordId } from "./words";

async function syncEnum(sql: SQL, kind: number, names: readonly string[]): Promise<void> {
  const have = new Map<number, string>();
  for (const r of await sql`SELECT id, name FROM enum_names WHERE kind = ${kind}`) have.set(Number(r.id), r.name);
  for (let i = 0; i < names.length; i++) {
    const id = i + 1, old = have.get(id);
    if (old === undefined) await sql`INSERT INTO enum_names (kind, id, name) VALUES (${kind}, ${id}, ${names[i]})`;
    else if (old !== names[i])
      throw new Error(`enum_names kind ${kind} #${id}: database "${old}" tapi kode "${names[i]}". Daftar hanya boleh ditambah di akhir.`);
  }
}

/** Bobot lama (key "kata|kelas", feature teks) dipindah ke bentuk nomor. Baris yang tidak dikenal dilewati. */
async function migrateLegacy(sql: SQL): Promise<void> {
  const known = new Set(featNames());
  for (const r of await sql`SELECT key, feature, w FROM sense_weights_legacy`) {
    const cut = String(r.key).lastIndexOf("|");
    const word = String(r.key).slice(0, cut), pos = posId(String(r.key).slice(cut + 1));
    if (!pos || !known.has(r.feature)) continue;
    const wid = word === "*" ? 0 : await wordId(sql, word);
    await sql`
      INSERT OR REPLACE INTO sense_weights (word_id, pos, feature_id, w)
      VALUES (${wid}, ${pos}, ${featId(r.feature)}, ${Number(r.w)})`;
  }
}

export async function createSenseTables(sql: SQL): Promise<void> {
  // enum_names hanya salinan dari kode, jadi versi lama (kind teks) cukup dibuat ulang.
  const [en] = await sql`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'enum_names'`;
  if (en && String(en.sql).includes("kind TEXT")) await sql`DROP TABLE enum_names`;
  await sql`
    CREATE TABLE IF NOT EXISTS enum_names (
      kind INTEGER NOT NULL,          -- 1 = fitur, 2 = kelas kata
      id INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    )`;
  const [old] = await sql`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sense_weights'`;
  const legacy = !!old && String(old.sql).includes("key TEXT");
  if (legacy) await sql`ALTER TABLE sense_weights RENAME TO sense_weights_legacy`;
  await sql`
    CREATE TABLE IF NOT EXISTS sense_weights (
      word_id INTEGER NOT NULL,       -- token id (words.id); 0 = berlaku untuk semua kata
      pos INTEGER NOT NULL,           -- enum_names kind 2
      feature_id INTEGER NOT NULL,    -- enum_names kind 1
      w INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (word_id, pos, feature_id)
    ) WITHOUT ROWID`;
  await syncEnum(sql, ENUM_KIND.feature, featNames());
  await syncEnum(sql, ENUM_KIND.pos, POS_LIST);
  if (legacy) await migrateLegacy(sql);
}
