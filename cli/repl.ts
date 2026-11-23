// REPL: buka database, muat semua yang tersimpan, lalu proses baris demi baris.
import * as readline from "node:readline";
import { loadWeights, restore, assignIds, builtinForms, loadContext } from "../src";
import { Store } from "../src/store";
import { loadWeights as loadSenseWeights } from "../src/attention";
import { setEnv, loadHarness } from "../src/env";
import { applyToolWords } from "../src/lexicon";
import { setTools } from "../src/tools";
import { SEARCH_TOOL } from "../src/search/tool";
import type { Session } from "./session";
import { handle } from "./handle";

export async function startRepl(rlhf: boolean, debug: boolean): Promise<void> {
  const store = await Store.open(process.env.RLHF_DB ?? "sqlite://rlhf.db");

  loadWeights(await store.loadWeights());
  loadSenseWeights(await store.loadSenseWeights());
  const tools = await store.loadTools();
  if (!tools.some((t) => t.name === SEARCH_TOOL.name)) { // tool pencarian internet: didaftarkan sekali
    await store.saveTool(SEARCH_TOOL);
    tools.push(structuredClone(SEARCH_TOOL));
  }
  applyToolWords(tools.flatMap((t) => t.words ?? [])); // kata tool jadi entri bawaan sebelum id dibagikan
  assignIds(await store.syncWords(builtinForms())); // token id = words.id di database
  for (const r of await store.loadLexicon()) restore(r);
  loadContext(await store.loadContext());
  setTools(tools);

  const harness = loadHarness();
  setEnv(harness.items, await store.setEnv(harness.items));
  if (harness.skipped.length)
    console.log(`(label harness dilewati, harus satu kata a-z0-9: ${harness.skipped.join(", ")})`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "kamu> " });
  const s: Session = { store, rl, debug, rlhf, lastId: null, lastInput: "", pending: null, confirm: null };

  console.log("Chatbot simbolik. Ketik :help untuk bantuan.");
  if (s.rlhf) console.log("Mode RLHF aktif: bot akan memberi hint saat meminta penjelasan.");
  if (s.debug) console.log("Mode debug aktif");
  console.log("");
  rl.prompt();

  // Antrian: baris diproses berurutan walau stdin di-pipe dan langsung ditutup.
  let chain: Promise<void> = Promise.resolve();
  let closed = false;
  rl.on("line", (line) => {
    chain = chain
      .then(() => handle(s, line))
      .catch((e) => console.error("error:", e))
      .then(() => { if (!closed) rl.prompt(); });
  });
  rl.on("close", () => {
    closed = true;
    chain.then(async () => {
      await store.close();
      console.log("\nSampai jumpa!");
      process.exit(0);
    });
  });
}
