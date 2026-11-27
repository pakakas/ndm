// tools/classify-pos.ts
import type { Pos } from "../src/types";
import { getText } from "./search/http";

const POS_MAP: Record<string, Pos> = {
  n: "noun", v: "verb", a: "adj", adv: "adv",
  pr: "pron", cj: "conj", p: "prep", interj: "interj",
};

export async function classifyKbbi(word: string): Promise<{ pos: Pos; gloss: string } | null> {
  try {
    const html = await getText(`https://kbbi.web.id/${encodeURIComponent(word)}`);
    // const matches0 = html.match(/.+?<\/head>/s);
    let pos, matches = html.match(/<div id="d1">.+?<em>(\w)<\/em>.+?<\/div>/s);

    if (matches?.[1]) {
      pos = POS_MAP[matches[1]] || null;
    } else {
      matches = html.match(/id="jsdata">.+?(\w)\\u003c\/em/)
      // console.debug('kbbi res', { m1: matches?.[1] })
      pos = matches?.[1] || null;
    }
    // const data = JSON.parse(m[1]);
    // console.debug('kbbi parsed', data)
    // if (!data?.length) return null;
    // const entry = data[0];
    // d: "<b>kar&#183;dus</b> <em>n</em> karton"
    // const posMatch = entry.d.match(/<em>(\w+)<\/em>/);
    if (!pos) return null;
    // Strip HTML untuk gloss
    // const gloss = entry.d.replace(/<[^>]*>/g, "").replace(word, "").trim();
    return { pos, gloss: '' };
  } catch {
    return null;
  }
}   