// search(): urutan penyedia, kegagalan, batas waktu, pengodean kueri, dan keamanan URL.
import { search, formatHits } from "./index";
import { ok, calls, fake, html, ddgOk, wikiId, wikiEmpty, WIKI } from "./tests-util";

let r = await search("geoffrey hinton", { fetch: fake([ddgOk, wikiId]) });
ok("DuckDuckGo dulu, Wikipedia tidak dipanggil", r.source === "duckduckgo" && calls.every((u) => u.includes("duckduckgo")), calls.join(" "));

calls.length = 0;
r = await search("geoffrey hinton", { fetch: fake([[/duckduckgo/, () => new Response("x", { status: 403 })], wikiId]) });
ok("DuckDuckGo 403 -> jatuh ke Wikipedia", r.source === "wikipedia" && r.hits[0].title === "Geoffrey Hinton");

r = await search("x", { fetch: fake([[/duckduckgo/, () => html("<html>anomaly-modal captcha</html>")], wikiId]) });
ok("captcha -> jatuh ke Wikipedia", r.source === "wikipedia");

calls.length = 0;
r = await search("x", { fetch: fake([[/duckduckgo/, () => html("<html></html>")], wikiEmpty("id"), [/en\.wikipedia/, () => html(WIKI)]]) });
ok("kosong di id -> coba Inggris", r.source === "wikipedia" && r.hits[0].url.startsWith("https://en.wikipedia.org/"), calls.join(" "));

r = await search("zzzz", { fetch: fake([[/duckduckgo/, () => html("<html></html>")], wikiEmpty("id"), wikiEmpty("en")]) });
ok("tidak ada hasil", r.hits.length === 0 && formatHits("zzzz", r) === 'Tidak ada hasil untuk "zzzz".');

let err = "";
try { await search("x", { fetch: fake([[/duckduckgo/, () => new Response("", { status: 500 })], [/wikipedia/, () => new Response("", { status: 503 })]]) }); } catch (e) { err = (e as Error).message; }
ok("gagal semua: alasan tiap penyedia", err.includes("duckduckgo: HTTP 500") && err.includes("wikipedia: HTTP 503"), err);

err = "";
const timeout = (async () => { throw new DOMException("t", "TimeoutError"); }) as any;
try { await search("x", { fetch: timeout, provider: "wikipedia" }); } catch (e) { err = (e as Error).message; }
ok("waktu habis", err.includes("waktu habis"), err);

calls.length = 0;
await search("x", { fetch: fake([wikiId]), provider: "wikipedia" });
ok("provider=wikipedia: DuckDuckGo tidak dipanggil", calls.length === 1 && calls[0].includes("id.wikipedia.org"), calls.join(" "));

calls.length = 0;
await search("c++ & java #1", { fetch: fake([ddgOk]) });
ok("kueri di-encode", calls[0].includes("q=c%2B%2B%20%26%20java%20%231&"), calls[0]);

calls.length = 0;
await search("x", { fetch: fake([[/duckduckgo/, () => new Response("", { status: 500 })], wikiEmpty("id"), wikiEmpty("en")]) });
const hosts = new Set(calls.map((u) => new URL(u).host));
ok("hanya https ke host yang diizinkan", calls.every((u) => u.startsWith("https://")) && [...hosts].every((h) => ["html.duckduckgo.com", "id.wikipedia.org", "en.wikipedia.org"].includes(h)), [...hosts].join());
