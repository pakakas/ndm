import { MAX_LEN, predictNext, tokens, train } from "./train";

await train();

// ─── Test: "hi" → ... ───
function infer(startText: string) {
  console.log(`\n[infer] input="${startText}"`);
  const words = startText
    .replace(/([?!.,;:])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);

  const tokenIds = words
    .map(w => tokens.get(w))
    .filter((id): id is number => id !== undefined);

  const tokenMap = tokenIds.map(id => `${tokens.getWord(id) ?? "?"}=${id}`).join(", ");
  console.log(`[infer] words=${JSON.stringify(words)} -> tokenIds=${JSON.stringify(tokenIds)} (${tokenMap})`);

  if (tokenIds.length === 0) {
    console.log("[infer] skip: no known tokens");
    return;
  }

  const output = ["<think>", ...words];
  for (let i = 0; i < 20; i++) {
    const next = predictNext(tokenIds, true);
    const word = tokens.getWord(next) ?? `?${next}`;
    output.push(word);
    if (word === "say") output.push("</think>\n");
    tokenIds.push(next);
    const stepDecoded = tokenIds.map(id => tokens.getWord(id) ?? `?${id}`);
    console.log(`[infer] step ${i + 1}: nextId=${next} ("${word}") | tokenIds=${JSON.stringify(tokenIds)} -> ${JSON.stringify(stepDecoded)}`);
    if (word === "\\n" || tokenIds.length >= MAX_LEN) {
      console.log(`[infer] stop: word="${word}", len=${tokenIds.length}`);
      break;
    }
  }
  console.log("[infer] output:", output);
}

const allVocabs = Array.from({ length: tokens.size }, (_, id) => `${id}:${tokens.getWord(id)}`);
console.log(`\n[vocabs] (${tokens.size}): ${allVocabs.join(", ")}`);

infer("hi")
infer("kau bisa coding ga")

