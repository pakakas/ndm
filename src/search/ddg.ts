// DuckDuckGo versi HTML: tanpa API key. Formatnya bisa berubah; kalau gagal, pencarian jatuh ke Wikipedia.
import type { SearchHit } from "./types";
import { clean } from "./text";
import { getText, type Fetch } from "./http";

/** Link hasil biasanya redirect "//duckduckgo.com/l/?uddg=<url asli>". Iklan dan skema selain http(s) dibuang. */
export function realUrl(href: string): string | null {
  try {
    const u = new URL(href.replace(/&amp;/g, "&"), "https://duckduckgo.com");
    if (u.pathname.startsWith("/y.js")) return null; // iklan
    const out = new URL(u.searchParams.get("uddg") ?? u.href);
    return out.protocol === "http:" || out.protocol === "https:" ? out.href : null;
  } catch {
    return null;
  }
}

export function parseDdgHtml(html: string, limit = 5): SearchHit[] {
  const links = [...html.matchAll(/<a\b[^>]*\bresult__a\b[^>]*>([\s\S]*?)<\/a>/g)];
  const hits: SearchHit[] = [];
  for (const [i, m] of links.entries()) {
    const href = /href="([^"]*)"/.exec(m[0])?.[1];
    const url = href ? realUrl(href) : null;
    if (!url) continue;
    const from = m.index! + m[0].length;
    const block = html.slice(from, links[i + 1]?.index ?? html.length);
    const sn = /<(?:a|div|td)\b[^>]*\bresult__snippet\b[^>]*>([\s\S]*?)<\/(?:a|div|td)>/.exec(block);
    hits.push({ title: clean(m[1]), url, snippet: sn ? clean(sn[1]) || undefined : undefined });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function ddgSearch(query: string, limit: number, f: Fetch): Promise<SearchHit[]> {
  const html = await getText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=id-id`, f);
  const hits = parseDdgHtml(html, limit);
  if (!hits.length && /anomaly|captcha|challenge/i.test(html)) throw new Error("permintaan diblokir (captcha)");
  return hits;
}
