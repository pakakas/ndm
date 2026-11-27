// Wikipedia (REST search): JSON stabil, tanpa API key. Dicoba bahasa Indonesia dulu, lalu Inggris.
import type { SearchHit } from "./types";
import { clean } from "./text";
import { getText, type Fetch } from "./http";

interface WikiPage { key: string; title: string; excerpt?: string; description?: string | null }

export function parseWiki(json: string, lang: string, limit = 5): SearchHit[] {
  const data = JSON.parse(json) as { pages?: WikiPage[] };
  return (data.pages ?? []).slice(0, limit).map((p) => ({
    title: p.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
    snippet: [p.description, clean(p.excerpt ?? "")].filter(Boolean).join(" - ") || undefined,
  }));
}

async function wikiLang(lang: string, query: string, limit: number, f: Fetch): Promise<SearchHit[]> {
  const body = await getText(
    `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`, f
  );
  return parseWiki(body, lang, limit);
}

export async function wikiSearch(query: string, limit: number, f: Fetch): Promise<SearchHit[]> {
  const id = await wikiLang("id", query, limit, f);
  return id.length ? id : wikiLang("en", query, limit, f);
}
