import { MAX_LEN, predictNext, tokens, train } from "./train";

const THINK_TOKENS = new Set(["is", "greeting", "asking", "for", "capability", ","]);

/** Regex pattern → placeholder token di vocabs (nilai asli tidak masuk weights). */
export const PATTERNS: Array<[RegExp, string]> = [
  [/^\d+\.\d+\.\d+\.\d+$/, "<IP>"],
  [/^\d+$/, "<NUM>"],
];

/**
 * Resolusi token secara rekursif lewat runtimeCtx (misal "47" -> "192.168.52.47"),
 * lalu cocokkan ke vocab langsung atau PATTERNS regex.
 */
export function resolveRuntimeToken(
  word: string,
  runtimeCtx?: Record<string, string>,
  visited = new Set<string>(),
): { tokenId: number; placeholder?: string; rawValue: string } | undefined {
  if (visited.has(word)) return undefined;
  visited.add(word);

  if (runtimeCtx && Object.hasOwn(runtimeCtx, word)) {
    const next = resolveRuntimeToken(runtimeCtx[word], runtimeCtx, visited);
    if (next) return next;
  }

  const directId = tokens.get(word);
  if (directId !== undefined) return { tokenId: directId, rawValue: word };

  for (const [regex, placeholder] of PATTERNS) {
    if (regex.test(word)) {
      const phId = tokens.get(placeholder);
      if (phId !== undefined) return { tokenId: phId, placeholder, rawValue: word };
    }
  }

  const unkId = tokens.get("unknown");
  if (unkId !== undefined) return { tokenId: unkId, placeholder: "unknown", rawValue: word };
  return undefined;
}

export function* inferStream(
  startText: string,
  verbose = false,
  runtimeCtx?: Record<string, string>,
): Generator<string> {
  const words = startText
    .replace(/([?!,;:])/g, " $1 ")
    .replace(/(?<!\d)\.(?!\d)/g, " . ")
    .split(/\s+/)
    .filter(Boolean);

  const bindings = new Map<string, string>();
  const tokenIds: number[] = [];
  for (const w of words) {
    const res = resolveRuntimeToken(w, runtimeCtx);
    if (res) {
      tokenIds.push(res.tokenId);
      if (res.placeholder) bindings.set(res.placeholder, res.rawValue);
    }
  }

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
    const outWord = bindings.get(word) ?? word;

    // Emit </think> saat ketemu ":" atau "say" — token delimiter tidak di-yield ke user
    if (!thinkEmitted && (word === "say" || word === ":")) {
      yield "</think>\n";
      thinkEmitted = true;
      tokenIds.push(next);
      _updateRecent(recentCount, tokenIds, next, WINDOW);
      continue;
    }

    yield outWord;
    tokenIds.push(next);
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

export function infer(startText: string, verbose = false, runtimeCtx?: Record<string, string>): string[] {
  return [...inferStream(startText, verbose, runtimeCtx)];
}

if (import.meta.main) {
  await train();
  const prompt = process.argv.slice(2).join(" ") || "hi";
  const result = infer(prompt, true);
  console.log("[infer] output:", result);
}
