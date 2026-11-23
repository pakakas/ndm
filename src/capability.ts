import { getTools } from "./tools";
import type { Tool } from "./tools";
import type { Tok } from "./types";

export type { Tool };

/** Semua kalimat jawaban di satu tempat; isinya (nama, deskripsi, kata kerja) selalu dari data tool. */
export const MSG = {
  list: (items: string[]) => `Saya bisa:\n${items.map((i) => `  ${i}`).join("\n")}`,
  none: "Belum ada kemampuan yang terdaftar.",
  cannot: (v: string, all: string[]) =>
    all.length ? `Belum bisa ${v}. Yang bisa: ${all.join(", ")}.` : `Belum bisa ${v}. ${MSG.none}`,
  notFor: (v: string, o: string) => `Bisa ${v}, tetapi belum untuk ${o}.`,
  can: (v: string, names: string[]) => `Bisa ${v}, lewat ${names.join(", ")}.`,
};

const verbsOf = (t: Tool): string[] => [
  ...new Set([...t.verbs, ...(t.words ?? []).filter((w) => w.poss.includes("verb")).map((w) => w.word)]),
];
const isAbility = (t: Tok) => t.pos === "aux" && (t.lemma === "bisa" || t.lemma === "dapat");
const describe = (t: Tool) => (t.description ? `${t.name} (${t.description.replace(/\.$/, "")})` : t.name);

export function capability(toks: Tok[]): string | null {
  const ai = toks.findIndex(isAbility);
  if (ai < 0) return null;
  const rest = toks.slice(ai + 1);
  const v = rest.find((t) => t.pos === "verb");
  const tools = getTools();

  // Tanpa kata kerja: "bisa apa (aja)?" -> semua tool terdaftar
  if (!v) {
    if (!toks.some((t) => t.pos === "qword" && t.lemma === "apa")) return null;
    return tools.length ? MSG.list(tools.map(describe)) : MSG.none;
  }

  const obj = rest.slice(rest.indexOf(v) + 1).find((t) => t.pos === "noun");
  const hit = tools.filter((t) => verbsOf(t).includes(v.lemma));
  if (!hit.length) return MSG.cannot(v.lemma, [...new Set(tools.flatMap(verbsOf))]);
  if (obj && !hit.some((t) => !t.objects?.length || t.objects.includes(obj.lemma))) return MSG.notFor(v.lemma, obj.lemma);
  return MSG.can(v.lemma, hit.map((t) => t.name));
}