// Interaksi dan feedback (RLHF): dicatat, dihitung, dan diekspor sebagai baris tes.
import type { SQL } from "bun";
import type { Features } from "../types";

export interface Stats {
  interactions: number;
  good: number;
  bad: number;
  corrected: number;
}

export interface FeedbackExport {
  input: string;
  rating: 1 | -1;
  expected: Partial<Features>;
}

export async function logInteraction(sql: SQL, input: string, features: Features, response: string): Promise<number> {
  const rows = await sql`
    INSERT INTO interactions (input, features, response)
    VALUES (${input}, ${JSON.stringify(features)}, ${response})
    RETURNING id`;
  return Number(rows[0].id);
}

export async function addFeedback(
  sql: SQL,
  interactionId: number,
  rating: 1 | -1,
  corrected?: Partial<Features>,
  note?: string
): Promise<void> {
  const c = corrected && Object.keys(corrected).length ? JSON.stringify(corrected) : null;
  await sql`
    INSERT INTO feedback (interaction_id, rating, corrected, note)
    VALUES (${interactionId}, ${rating}, ${c}, ${note ?? null})`;
}

export async function stats(sql: SQL): Promise<Stats> {
  const [r] = await sql`
    SELECT
      (SELECT COUNT(*) FROM interactions) AS interactions,
      COALESCE(SUM(rating = 1), 0)  AS good,
      COALESCE(SUM(rating = -1), 0) AS bad,
      COUNT(corrected)              AS corrected
    FROM feedback`;
  return {
    interactions: Number(r.interactions),
    good: Number(r.good),
    bad: Number(r.bad),
    corrected: Number(r.corrected),
  };
}

/** Feedback jadi baris tes: koreksi manusia, atau fitur yang dikonfirmasi benar. */
export async function exportTests(sql: SQL): Promise<FeedbackExport[]> {
  const rows = await sql`
    SELECT i.input AS input, i.features AS features, fb.rating AS rating, fb.corrected AS corrected
    FROM feedback fb
    JOIN interactions i ON i.id = fb.interaction_id
    ORDER BY fb.id`;
  const out: FeedbackExport[] = [];
  for (const r of rows) {
    const rating = Number(r.rating) as 1 | -1;
    if (r.corrected) out.push({ input: r.input, rating, expected: JSON.parse(r.corrected) });
    else if (rating === 1) out.push({ input: r.input, rating, expected: JSON.parse(r.features) });
  }
  return out;
}
