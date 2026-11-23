// Yang dilatih: hitungan konteks, bobot intent (0..1), dan bobot pemilihan arti kata ambigu.
import type { SQL } from "bun";
import type { CtxRow } from "../context";

// ── Hitungan konteks ──

export async function loadContext(sql: SQL): Promise<CtxRow[]> {
  const rows = await sql`SELECT prev, pos, next, n FROM context_stats`;
  return rows.map((r: any) => ({ prev: r.prev, pos: r.pos, next: r.next, n: Number(r.n) }));
}

export async function bumpContext(sql: SQL, delta: CtxRow[]): Promise<void> {
  for (const r of delta)
    await sql`
      INSERT INTO context_stats (prev, pos, next, n) VALUES (${r.prev}, ${r.pos}, ${r.next}, ${r.n})
      ON CONFLICT(prev, pos, next) DO UPDATE SET n = n + excluded.n`;
}

export async function resetContext(sql: SQL): Promise<void> {
  await sql`DELETE FROM context_stats`;
}

// ── Bobot intent ──

export async function loadWeights(sql: SQL): Promise<Array<{ intent: number; feature: string; w: number }>> {
  const rows = await sql`SELECT intent, feature, w FROM weights`;
  return rows.map((r: any) => ({ intent: Number(r.intent), feature: r.feature, w: Number(r.w) }));
}

export async function saveWeights(sql: SQL, rows: Array<{ intent: number; feature: string; w: number }>): Promise<void> {
  for (const r of rows) {
    await sql`
      INSERT INTO weights (intent, feature, w) VALUES (${r.intent}, ${r.feature}, ${r.w})
      ON CONFLICT(intent, feature) DO UPDATE SET w = excluded.w, updated_at = CURRENT_TIMESTAMP`;
  }
}

export async function resetWeights(sql: SQL): Promise<void> {
  await sql`DELETE FROM weights`;
}

// ── Bobot pemilihan arti kata ambigu (attention.ts) ──
// Bilangan bulat, boleh negatif, jadi tabelnya terpisah dari `weights` (intent, 0..1).

export async function loadSenseWeights(sql: SQL): Promise<Array<{ key: string; feature: string; w: number }>> {
  const rows = await sql`SELECT key, feature, w FROM sense_weights`;
  return rows.map((r: any) => ({ key: r.key, feature: r.feature, w: Number(r.w) }));
}

export async function saveSenseWeights(sql: SQL, rows: Array<{ key: string; feature: string; w: number }>): Promise<void> {
  for (const r of rows)
    await sql`
      INSERT INTO sense_weights (key, feature, w) VALUES (${r.key}, ${r.feature}, ${r.w})
      ON CONFLICT(key, feature) DO UPDATE SET w = excluded.w, updated_at = CURRENT_TIMESTAMP`;
}

export async function resetSenseWeights(sql: SQL): Promise<void> {
  await sql`DELETE FROM sense_weights`;
}