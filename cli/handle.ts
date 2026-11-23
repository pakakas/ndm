// Satu baris input: perintah ":..." dikirim ke penangannya, selain itu jadi percakapan.
import type { Session } from "./session";
import { HELP } from "./help";
import { converse, explain } from "./converse";
import { kata, edit, idCmd } from "./cmd-words";
import { kelas, learned, forgetCmd, konteks } from "./cmd-learn";
import { weights, reset, stats, exportTests, rate } from "./cmd-feedback";
import { sense, env } from "./cmd-sense";
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
  ":kata": kata, ":edit": edit, ":id": idCmd,
  ":kelas": kelas, ":learned": learned, ":forget": forgetCmd, ":konteks": konteks,
  ":weights": weights, ":reset": reset, ":stats": stats, ":export": exportTests,
  ":good": rate, ":bad": rate, ":fix": rate,
  ":sense": sense, ":env": env,
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
  if (s.pending && (looksLikeExplanation(text, s.pending.word) || !runTools(text))) return explain(s, text);
  return converse(s, text);
}
