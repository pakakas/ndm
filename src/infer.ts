import { MAX_LEN, predictNext, tokens, train } from "./train";

const THINK_TOKENS = new Set(["is", "greeting", "asking", "for", "capability", ","]);

export function* inferStream(startText: string, verbose = false): Generator<string> {
  const words = startText
    .replace(/([?!.,;:])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);

  const tokenIds = words
    .map(w => tokens.get(w))
    .filter((id): id is number => id !== undefined);

  if (tokenIds.length === 0) {
    if (verbose) console.log(`[infer] skip: no known tokens for "${startText}"`);
    return;
  }

  yield "<think>";
  for (const w of words) yield w;

  // repeat penalty: map tokenId → berapa kali muncul dalam window terakhir
  const recentCount = new Map<number, number>();
  const WINDOW = 6;
  const PENALTY = 3.0;

  let thinkEmitted = false;
  let stepsSinceInput = 0;

  for (let i = 0; i < 40; i++) {
    const next = predictNext(tokenIds, verbose, recentCount, PENALTY);
    const word = tokens.getWord(next) ?? `?${next}`;

    // Emit </think> saat ketemu ":" atau "say" — token delimiter tidak di-yield ke user
    if (!thinkEmitted && (word === "say" || word === ":")) {
      yield "</think>\n";
      thinkEmitted = true;
      tokenIds.push(next);
      stepsSinceInput++;
      _updateRecent(recentCount, tokenIds, next, WINDOW);
      continue;
    }

    // Jika model skip think-path langsung ke reply token (bukan think token):
    // emit </think> sebelum token ini
    if (!thinkEmitted && stepsSinceInput > 0 && !THINK_TOKENS.has(word) && word !== "\\n") {
      yield "</think>\n";
      thinkEmitted = true;
    }

    yield word;
    tokenIds.push(next);
    stepsSinceInput++;
    _updateRecent(recentCount, tokenIds, next, WINDOW);

    if (word === "\\n" || tokenIds.length >= MAX_LEN) break;
  }
}

function _updateRecent(map: Map<number, number>, seq: number[], next: number, window: number) {
  map.set(next, (map.get(next) ?? 0) + 1);
  if (seq.length > window) {
    const old = seq[seq.length - window - 1];
    const c = map.get(old);
    if (c !== undefined) {
      if (c <= 1) map.delete(old);
      else map.set(old, c - 1);
    }
  }
}

export function infer(startText: string, verbose = false): string[] {
  return [...inferStream(startText, verbose)];
}

if (import.meta.main) {
  await train();
  const prompt = process.argv.slice(2).join(" ") || "hi";
  const result = infer(prompt, true);
  console.log("[infer] output:", result);
}
