// Pencarian internet: DuckDuckGo dulu, Wikipedia sebagai cadangan. Env SEARCH_PROVIDER=duckduckgo|wikipedia memaksa satu penyedia.
import type { SearchHit, SearchResult } from "./types";
import type { Fetch } from "./http";
import { ddgSearch } from "./ddg";
import { wikiSearch } from "./wikipedia";
import { truncate } from "./text";
import { bingSearch } from "./bing";

export type { SearchHit, SearchResult } from "./types";
export { parseSearch } from "./query";

type Name = "duckduckgo" | "wikipedia";
const PROVIDERS: Record<Name, (q: string, n: number, f: Fetch) => Promise<SearchHit[]>> = {
  bing: bingSearch
  // duckduckgo: ddgSearch,
  // wikipedia: wikiSearch,
};

export interface SearchOptions { fetch?: Fetch; provider?: string; limit?: number }

/** Hasil dari penyedia pertama yang memberi hasil. Gagal semua -> error berisi alasan tiap penyedia. */
export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const f = opts.fetch ?? fetch;
  const limit = opts.limit ?? 5;
  const want = opts.provider ?? process.env.SEARCH_PROVIDER ?? "auto";
  const order: Name[] = want === "duckduckgo" || want === "wikipedia" ? [want] : ["duckduckgo", "wikipedia", "bing"];
  const errors: string[] = [];
  let answeredEmpty = false;
  for (const name of order) {
    try {
      const hits = await PROVIDERS[name](query, limit, f);
      if (hits.length) return { hits, source: name };
      answeredEmpty = true;
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  if (answeredEmpty) return { hits: [], source: order[0] };
  throw new Error(errors.join("; "));
}

export function formatHits(query: string, r: SearchResult): string {
  if (!r.hits.length) return `Tidak ada hasil untuk "${query}".`;
  const lines = r.hits.map(
    (h, i) => `  ${i + 1}. ${h.title}\n     ${h.url}` + (h.snippet ? `\n     ${truncate(h.snippet, 160)}` : "")
  );
  return `Hasil untuk "${query}" (${r.source}):\n${lines.join("\n")}`;
}
