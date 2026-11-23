import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, join } from "node:path";
import { applyExternal } from "./lexicon";

export type EnvKind = "project" | "workspace" | "user" | "dir";
export interface EnvItem { kind: EnvKind; label: string; value: string }

const LABEL_RE = /^[a-z0-9]+$/; // satu token, sama dengan yang dikenali tokenize()
let ITEMS: EnvItem[] = [];

export const getEnv = (): EnvItem[] => ITEMS;
export const envOf = (label: string): EnvItem | undefined => ITEMS.find((e) => e.label === label);

/** Pindai bawaan, lalu timpa dengan harness.json, lalu BOT_ENV. Label tidak valid dibuang dan dilaporkan. */
export function loadHarness(cwd = process.cwd()): { items: EnvItem[]; skipped: string[] } {
  const by = new Map<string, EnvItem>();
  const put = (e: EnvItem) => by.set(e.label, e);
  put({ kind: "project", label: "proyek", value: basename(cwd) });
  put({ kind: "workspace", label: "workspace", value: cwd });
  put({ kind: "user", label: "pengguna", value: userInfo().username });
  for (const [label, d] of [["unduhan", "Downloads"], ["dokumen", "Documents"]] as const) {
    const p = join(homedir(), d);
    if (existsSync(p)) put({ kind: "dir", label, value: p });
  }
  const extra: EnvItem[] = [];
  if (existsSync("harness.json")) extra.push(...Bun.JSON5.parse(readFileSync("harness.json", "utf8")));
  if (process.env.BOT_ENV) extra.push(...JSON.parse(process.env.BOT_ENV));
  const skipped: string[] = [];
  for (const e of extra) (LABEL_RE.test(e.label) ? put(e) : skipped.push(e.label));
  return { items: [...by.values()], skipped };
}

/** ids: label -> words.id dari DB (opsional; tanpa DB id dibuat sendiri). */
export function setEnv(items: EnvItem[], ids?: Map<string, number>): void {
  ITEMS = items;
  applyExternal(items.map((i) => [i.label, ids?.get(i.label)] as [string, number | undefined]));
}