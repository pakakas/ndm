// tools/classify-pos.ts
import type { Pos } from "../src/types";
import { getText } from "./search/http";

const POS_MAP: Record<string, Pos> = {
  n: "noun", v: "verb", a: "adj", adv: "adv",
  pr: "pron", cj: "conj", p: "prep", interj: "interj",
};

type ClassifyResult = { pos: Pos; gloss: string }

export async function classifyKbbiKemendik(word: string): Promise<ClassifyResult[] | null> {
  try {
    const html = await getText(`https://kbbi.kemendikdasmen.go.id/entri/${encodeURIComponent(word)}`);
    // const matches0 = html.match(/.+?<\/head>/s);

    const sliceStart = html.indexOf(`Tesaurus</a></p>`)
    const artikel = html.slice(sliceStart, html.indexOf('<hr />', sliceStart))
    const classes = artikel.split('</li><li>').map(entry => {
      const [_, pos, gloss] = entry.match(/(\w)<\/span>.+?<\/font>(.+)/s) || [null, '']
      return {pos: POS_MAP[pos] || null, gloss: gloss?.replace(/<[^>]*>/g, '')}
    }) as ClassifyResult[]
    // console.debug('classifyKbbiKemendik', {matches, classes})

    // const matches = html.match(/class="adjusted-par">.+?(\w)<\/span>.+?<\/font>(.+?)<\/li>/s);
    // console.debug('classifyKbbiKemendik', {pos: matches?.[1]})
    // if (!classes.length) {
      // return null;
    // }
    // pos = POS_MAP[matches[1]] || null;
    // const data = JSON.parse(m[1]);
    // console.debug('kbbi parsed', data)
    // if (!data?.length) return null;
    // const entry = data[0];
    // d: "<b>kar&#183;dus</b> <em>n</em> karton"
    // const posMatch = entry.d.match(/<em>(\w+)<\/em>/);
    // if (!pos) return null;
    // Strip HTML untuk gloss
    // const gloss = entry.d.replace(/<[^>]*>/g, "").replace(word, "").trim();
    // return { pos: POS_MAP[matches[1]], gloss: matches[2] || "" };
    return classes
  } catch {
    return null;
  }
}   