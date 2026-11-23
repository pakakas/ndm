// Konfirmasi "Lanjutkan? (ya/tidak)": bot mengingat rencana, lalu membaca jawaban ya/tidak.
import { analyzeText } from "./features";
import { analyze } from "./morphology";
import { getTools, runTools } from "./tools";
import type { Tool } from "./tools";
import { Intent } from "./types";

export interface Plan { verb: string; obj?: string }

export const isYes = (t: string): boolean => /^(ya|y|iya|ok|oke|lanjut|benar|betul)$/i.test(t.trim());
export const isNo = (t: string): boolean => /^(tidak|t|n|no|nggak|gak|jangan|batal)$/i.test(t.trim());

/** Rencana yang ditanyakan "Lanjutkan?" untuk pesan ini, atau null kalau bot tidak bertanya begitu. */
export function planOf(raw: string): Plan | null {
  if (runTools(raw)) return null;
  const { f, toks } = analyzeText(raw);
  if (f.intent !== Intent.Request) return null;
  const vi = toks.findIndex((t) => t.pos === "verb");
  if (vi < 0) return null;
  const obj = toks.slice(vi + 1).find((t) => t.pos === "noun");
  return obj ? { verb: toks[vi].lemma, obj: obj.lemma } : null; // tanpa objek bot tidak bertanya "Lanjutkan?"
}

const MSG = {
  no: "Oke, dibatalkan.",
  can: (v: string, names: string[]) => `Bisa ${v}, lewat ${names.join(", ")}.`,
  cannot: (v: string, groups: string[]) =>
    groups.length
      ? `Belum bisa ${v}. Yang bisa:\n${groups.map((g) => `  ${g}`).join("\n")}\nKalau maksudnya sama dengan salah satunya, ajarkan: ${v} artinya <kata kerja di atas>.`
      : `Belum bisa ${v}. Belum ada kemampuan yang terdaftar.`,
};
/** Kata kerja tool, dinormalkan ke lemma supaya variannya (cari, mencari, carikan, cariin) tidak muncul berulang. */
const lemma = (w: string): string => analyze(w)?.lemma ?? w;
const verbsOf = (t: Tool): string[] => [
  ...new Set([...t.verbs, ...(t.words ?? []).filter((w) => w.poss.includes("verb")).map((w) => w.word)].map(lemma)),
];

/** Jawaban setelah pengguna menjawab ya/tidak. "ya" hanya berhasil kalau ada tool terdaftar untuk kata kerjanya. */
export function settle(plan: Plan, yes: boolean): string {
  if (!yes) return MSG.no;
  const tools = getTools();
  const hit = tools.filter((t) => verbsOf(t).includes(plan.verb));
  if (hit.length) return MSG.can(plan.verb, hit.map((t) => t.name));
  const withVerbs = tools.filter((t) => verbsOf(t).length);
  return MSG.cannot(plan.verb, withVerbs.map((t) => `${t.name} (${verbsOf(t).join(", ")})`));
}