import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

export interface TokenMap {
  size: number;
  get(word: string): number | undefined;
  getWord(id: number): string | undefined;
  addWord(word: string): number;
  has(word: string): boolean;
}

export async function generateVocabs(datasetPath: string, vocabsPath: string): Promise<void> {
  const rl = createInterface({ input: createReadStream(datasetPath, { encoding: "utf8" }) });
  const seen = new Set<string>();
  for await (const line of rl) {
    const words = line
      .replace(/([?!.,;:])/g, " $1 ")
      .split(/\s+/)
      .filter(Boolean);
    for (const w of words) seen.add(w);
  }
  seen.add("\\n");
  writeFileSync(vocabsPath, Array.from(seen).join("\n"), "utf8");
}

export async function loadVocabs(file: string): Promise<TokenMap> {
  const stream = createReadStream(file, { encoding: "utf8" });
  const rl = createInterface({ input: stream });
  const { promise: result, resolve } = Promise.withResolvers<TokenMap>();
  const idToWord = new Map<number, string>();
  const wordToId = new Map<string, number>();
  let nextId = 0;

  rl.on("line", (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    idToWord.set(nextId, trimmed);
    wordToId.set(trimmed, nextId++);
  });

  rl.on("close", () => {
    const tokenObj: TokenMap = {
      get size() {
        return wordToId.size;
      },
      get(word: string) {
        return wordToId.get(word);
      },
      getWord(id: number) {
        return idToWord.get(id);
      },
      has(word: string) {
        return wordToId.has(word);
      },
      addWord(word: string) {
        const existing = wordToId.get(word);
        if (existing !== undefined) return existing;
        const id = nextId++;
        idToWord.set(id, word);
        wordToId.set(word, id);
        return id;
      },
    };
    resolve(tokenObj);
  });

  return result;
}
