// Jalankan: bun main.ts                  (REPL)
//           bun main.ts --rlhf           (REPL + hint untuk pemberi penjelasan)
//           bun main.ts repl             (sama)
//           bun main.ts "kirim laporan"  (sekali jalan, tanpa DB)
// Kode REPL ada di cli/ (satu file per kelompok perintah).
import { unknownHints } from "./src";
import { infer } from "./src/infer";
import { train } from "./src/train";
import { setEnv, loadHarness } from "./src/env";
import { setTools, asyncJob } from "./src/tools";
import { SEARCH_TOOL } from "./tools/search/tool";
import { printHints } from "./cli/format";
import { startRepl } from "./cli/repl";
import { unknownWord } from "./src/unknown";

const rlhfFlag = process.argv.includes("--rlhf");
const debugFlag = process.argv.includes("--debug");
const args = process.argv.slice(2).filter((a) => a !== "start" && a !== "repl"
  && a !== "--rlhf"
  && a !== "--debug"
);

function formatReply(tokensOut: string[]): string {
  if (tokensOut.length === 0) return "";
  const thinkEnd = tokensOut.indexOf("</think>\n");
  return thinkEnd !== -1
    ? tokensOut.slice(thinkEnd + 1).filter(t => t !== "\\n").join(" ")
    : tokensOut.filter(t => t !== "<think>" && t !== "\\n").join(" ");
}

if (args.length > 0) {
  await train();
  setEnv(loadHarness().items);
  setTools([SEARCH_TOOL]); // sekali jalan tidak memuat DB: pasang tool pencarian langsung
  const input = args.join(" ");
  console.log(formatReply(infer(input, debugFlag)));
  const job = asyncJob(input);
  if (job) console.log(await job.run());
  const uw = unknownWord(input);
  if (rlhfFlag && uw) printHints(unknownHints(input, uw));
} else {
  await startRepl(rlhfFlag, debugFlag);
}
