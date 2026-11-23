// Alat bersama untuk tes pencarian: penghitung hasil, contoh respons, dan fetch tiruan.
export const results = { fail: 0 };
export const ok = (name: string, cond: boolean, info = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else { results.fail++; console.log(`FAIL  ${name} ${info}`); }
};

export const DDG = `
<div class="result results_links web-result result--ad"><h2><a class="result__a" href="https://duckduckgo.com/y.js?ad_domain=x.com">Iklan</a></h2></div>
<div class="result results_links web-result"><h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FGeoffrey_Hinton&amp;rut=abc">Geoffrey Hinton - <b>Wikipedia</b></a></h2>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=x">Geoffrey Everest Hinton is a British-Canadian <b>computer</b> scientist &amp; cognitive psychologist.</a></div>
<div class="result"><a class="result__a" href="https://example.com/hinton">Halaman Hinton</a></div>
<div class="result"><a class="result__a" href="javascript:alert(1)">Jahat</a></div>`;
export const WIKI = JSON.stringify({ pages: [
  { key: "Geoffrey_Hinton", title: "Geoffrey Hinton", excerpt: '<span class="searchmatch">Geoffrey</span> Everest Hinton', description: "Ilmuwan komputer" },
  { key: "C%2B%2B", title: "C++", excerpt: "bahasa", description: null },
] });

export const calls: string[] = [];
export type Route = [RegExp, () => Response];
export const fake = (routes: Route[]): typeof fetch =>
  (async (input: any) => {
    const url = String(input);
    calls.push(url);
    for (const [re, h] of routes) if (re.test(url)) return h();
    return new Response("tidak ada", { status: 404 });
  }) as any;
export const html = (b: string) => new Response(b, { status: 200 });
export const ddgOk: Route = [/duckduckgo\.com/, () => html(DDG)];
export const wikiId: Route = [/id\.wikipedia/, () => html(WIKI)];
export const wikiEmpty = (l: string): Route => [new RegExp(`${l}\\.wikipedia`), () => html('{"pages":[]}')];
