// Percakapan: stream reply dari inferStream, tampilkan token setelah </think>
import { inferStream } from "../src/infer";
import type { Session } from "./session";

// Token-token boilerplate dari think-path yang tidak perlu ditampilkan ke user
const SKIP_REPLY_TOKENS = new Set(["reply", "with", ":", "say"]);

export async function converse(s: Session, text: string): Promise<void> {
  const showThink = Boolean((s as any).think);
  const runtimeCtx = (s as any).runtimeCtx as Record<string, string> | undefined;
  let inReply = false;
  let streamed = false;

  for (const tok of inferStream(text, false, runtimeCtx)) {
    if (tok === "</think>\n") {
      if (showThink && streamed) process.stdout.write("</think>\n");
      inReply = true;
      continue;
    }
    if (tok === "<think>") {
      if (showThink) { process.stdout.write("bot > <think>"); streamed = true; }
      continue;
    }
    // Skip boilerplate "reply with :" yang ikut ke reply stream
    if (inReply && SKIP_REPLY_TOKENS.has(tok)) continue;

    if ((inReply || showThink) && tok !== "\\n") {
      if (!streamed) { process.stdout.write("bot >"); streamed = true; }
      process.stdout.write(tok);
      await Bun.sleep(50);
    }
  }

  if (streamed) process.stdout.write("\n");
  else console.log("bot > (tidak ada respon)");
}
