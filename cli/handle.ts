// Satu baris input: perintah ":..." dikirim ke penangannya, selain itu jadi percakapan.
import type { Session } from "./session";
import { HELP } from "./help";
import { converse } from "./converse";
import { kata, edit, idCmd } from "./cmd-words";
import { kelas, learned, forgetCmd, konteks } from "./cmd-learn";
import { weights, reset, stats, exportTests, rate } from "./cmd-feedback";
import { sense, env } from "./cmd-sense";
import { train } from "../src/train";
import { looksLikeExplanation } from "../src";
import { runTools } from "../src/tools";
import { Plan, isNo, isYes, settle } from "../src/confirm";

type Cmd = (s: Session, rest: string[], cmd: string) => void | Promise<void>;

const quit: Cmd = (s) => s.rl.close();

const COMMANDS: Record<string, Cmd> = {
  ":quit": quit, ":q": quit,
  ":help": () => console.log(HELP),
  ":rlhf": (s) => { s.rlhf = !s.rlhf; console.log(`mode rlhf ${s.rlhf ? "aktif" : "nonaktif"}`); },
  ":debug": (s) => { s.debug = !s.debug; console.log(`debug ${s.debug ? "aktif" : "nonaktif"}`); },
  ":think": (s) => { (s as any).think = !(s as any).think; console.log(`think ${(s as any).think ? "aktif" : "nonaktif"}`); },
  ":kata": kata, ":edit": edit, ":id": idCmd,
  ":kelas": kelas, ":learned": learned, ":forget": forgetCmd, ":konteks": konteks,
  ":weights": weights, ":reset": reset, ":stats": stats, ":export": exportTests,
  ":good": rate, ":bad": rate, ":fix": rate,
  ":sense": sense, ":env": env,
  ":train": async (_s, rest) => {
    const epochs = Number(rest[0]) > 0 ? Math.floor(Number(rest[0])) : 1000;
    await train(epochs);
  },
  ":add-context": (s, rest) => {
    if (rest.length < 2) {
      console.log("Gunakan: :add-context <key> <value> (atau :add-context <key> is <value>)");
      return;
    }
    const key = rest[0];
    const value = rest[1] === "is" ? rest.slice(2).join(" ") : rest.slice(1).join(" ");
    if (!value) {
      console.log("Value tidak boleh kosong.");
      return;
    }
    const ctx: Record<string, string> = ((s as any).runtimeCtx ??= {});
    ctx[key] = value;
    console.log(`[context] ${key} -> ${value}`);
  },
  ":clear-context": (s) => {
    (s as any).runtimeCtx = {};
    console.log("[context] cleared.");
  },
  ":context": (s) => {
    const ctx = (s as any).runtimeCtx as Record<string, string> | undefined;
    const entries = ctx ? Object.entries(ctx) : [];
    if (entries.length === 0) {
      console.log("[context] (kosong)");
      return;
    }
    for (const [k, v] of entries) console.log(`  ${k} -> ${v}`);
  },
};

export async function handle(s: Session, line: string): Promise<void> {
  const text = line.trim();
  if (!text) return;

  if (text.startsWith(":")) {
    const [cmd, ...rest] = text.split(/\s+/);
    const run = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : undefined;
    if (run) await run(s, rest, cmd);
    else console.log(`Perintah tidak dikenal: ${cmd}. Ketik :help.`);
    return;
  }

  if (s.confirm && (isYes(text) || isNo(text))) {
    const c = s.confirm; s.confirm = null;
    console.log(`bot > ${settle(c, isYes(text))}`);
    return;
  }
  s.confirm = null; // jawaban lain berarti pindah topik

  // Pesan yang ditangani tool (mis. "cari kucing lucu") menggantikan kata asing yang menunggu penjelasan,
  // kecuali pesan itu memang berbentuk penjelasan ("blorb artinya cari barang").
  // if (s.pending && (looksLikeExplanation(text, s.pending.word) || !runTools(text))) return explain(s, text);
  return converse(s, text);
}
