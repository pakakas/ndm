// Jalankan: bun main.ts                  (REPL + penyimpanan feedback)
//           bun main.ts --rlhf           (REPL + hint untuk pemberi penjelasan)
//           bun main.ts repl             (sama)
//           bun main.ts "kirim laporan"  (sekali jalan, tanpa DB)
// Env: RLHF_DB=sqlite://rlhf.db (default)
// Kode REPL ada di cli/ (satu file per kelompok perintah).
import { respond, unknownWord, unknownHints } from "./src";
import { setEnv, loadHarness } from "./src/env";
import { setTools, asyncJob } from "./src/tools";
import { SEARCH_TOOL } from "./src/search/tool";
import { showDebug, printHints } from "./cli/format";
import { startRepl } from "./cli/repl";

const rlhfFlag = process.argv.includes("--rlhf");
const debugFlag = process.argv.includes("--debug");
const args = process.argv.slice(2).filter((a) => a !== "start" && a !== "repl"
  && a !== "--rlhf"
  && a !== "--debug"
);

if (args.length > 0) {
  setEnv(loadHarness().items);
  setTools([SEARCH_TOOL]); // sekali jalan tidak memuat DB: pasang tool pencarian langsung
  const input = args.join(" ");
  console.log(respond(input));
  const job = asyncJob(input);
  if (job) console.log(await job.run());
  showDebug(input);
  const uw = unknownWord(input);
  if (rlhfFlag && uw) printHints(unknownHints(input, uw));
} else {
  await startRepl(rlhfFlag, debugFlag);
}
