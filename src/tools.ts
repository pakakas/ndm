import type { Pos, Trans } from "./types";

export interface ToolWord { word: string; role: string; poss: Pos[]; trans: Trans }
export interface Tool {
  name: string;
  description: string;
  verbs: string[];       // kata kerja yang diumumkan (untuk capability)
  objects?: string[];
  words?: ToolWord[];    // kosakata milik tool: kata -> peran
}

type Handler = (raw: string) => string | null; // null = bukan urusan tool ini
const HANDLERS = new Map<string, Handler>();
export const registerHandler = (name: string, h: Handler): void => { HANDLERS.set(name, h); };

/**
 * Tool yang butuh jaringan. `ack` harus murni dan cepat (tanpa I/O): dipanggil berulang oleh
 * respond() dan unknownWord(), mengembalikan balasan awal atau null kalau bukan urusannya.
 * `run` mengerjakan pekerjaannya (async) dan dipanggil terpisah lewat asyncJob(); tidak boleh melempar error.
 */
export interface AsyncHandler { ack: (raw: string) => string | null; run: (raw: string) => Promise<string> }
const ASYNC = new Map<string, AsyncHandler>();
export const registerAsyncHandler = (name: string, h: AsyncHandler): void => { ASYNC.set(name, h); };

let TOOLS: Tool[] = [];
const ROLES = new Map<string, Map<string, string>>();

export function setTools(t: Tool[]): void {
  TOOLS = t;
  ROLES.clear();
  for (const tool of t) ROLES.set(tool.name, new Map((tool.words ?? []).map((w) => [w.word, w.role])));
}
export const getTools = (): Tool[] => TOOLS;
export const roleOf = (tool: string, word: string): string | undefined => ROLES.get(tool)?.get(word);

/** Jalankan handler tool aktif sesuai urutan id; yang pertama menjawab menang. */
export function runTools(raw: string): { tool: string; reply: string } | null {
  for (const t of TOOLS) {
    const h = HANDLERS.get(t.name);
    const r = h ? h(raw) : null;
    if (r !== null) return { tool: t.name, reply: r };
    const a = ASYNC.get(t.name)?.ack(raw) ?? null;
    if (a !== null) return { tool: t.name, reply: a };
  }
  return null;
}

/** Pekerjaan lanjutan (jaringan) kalau pemenang runTools(raw) adalah tool async, selain itu null. */
export function asyncJob(raw: string): { tool: string; run: () => Promise<string> } | null {
  const r = runTools(raw);
  const h = r && ASYNC.get(r.tool);
  return r && h ? { tool: r.tool, run: () => h.run(raw) } : null;
}