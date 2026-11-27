// search/bing.ts
import type { SearchHit } from "./types";
import type { Fetch } from "./http";
import { getText } from "./http";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export async function bingSearch(query: string, n: number, f: Fetch): Promise<SearchHit[]> {
  const html = await getText(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, f);
  const hits: SearchHit[] = [];
  const re = /<li class="b_algo".*?<h2><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<p[^>]*>(.*?)<\/p>/gs;
  let m;
  console.debug('bing', {query, n, f, html})
  while ((m = re.exec(html)) !== null) {
    hits.push({
      title: m[2].replace(/<[^>]*>/g, ""),
      url: m[1],
      snippet: m[3].replace(/<[^>]*>/g, ""),
    });
    if (hits.length >= n) break;
  }
  return hits;
}
