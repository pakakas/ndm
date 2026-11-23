// parseSearch, parser hasil DuckDuckGo/Wikipedia, pembersih teks, dan format hasil.
import { parseSearch, formatHits } from "./index";
import { parseDdgHtml, realUrl } from "./ddg";
import { parseWiki } from "./wikipedia";
import { clean } from "./text";
import { ok, DDG, WIKI } from "./tests-util";

// ── parseSearch ──
const Q: Array<[string, string | null]> = [
  ["cariin geoffrey hinton", "geoffrey hinton"],
  ["Cari Geoffrey Hinton", "geoffrey hinton"],
  ["tolong carikan info soal harga laptop di internet", "harga laptop"],
  ["cari di internet tentang kucing lucu", "kucing lucu"],
  ["googling resep nasi goreng", "resep nasi goreng"],
  ["google geoffrey hinton dong", "geoffrey hinton"],
  ["bisa cariin berita ai?", "berita ai"],
  ["cari laporan di internet", "laporan"],   // penanda internet memaksa web
  ["cari file laporan", null],               // kata pertama dikenal: urusan lokal
  ["cari kabar", null],
  ["cari apa", null],
  ["cari", null],
  ["kirim laporan", null],
  ["halo halo", null],
];
for (const [input, want] of Q) {
  const got = parseSearch(input)?.query ?? null;
  ok(`parseSearch ${JSON.stringify(input)} -> ${JSON.stringify(want)}`, got === want, `dapat ${JSON.stringify(got)}`);
}

// ── parsing hasil ──
const d = parseDdgHtml(DDG, 5);
ok("ddg: iklan dan javascript: dibuang", d.length === 2, JSON.stringify(d));
ok("ddg: url asli dari uddg", d[0].url === "https://en.wikipedia.org/wiki/Geoffrey_Hinton");
ok("ddg: judul dan snippet dibersihkan", d[0].title === "Geoffrey Hinton - Wikipedia" && d[0].snippet === "Geoffrey Everest Hinton is a British-Canadian computer scientist & cognitive psychologist.");
ok("ddg: tanpa snippet boleh", d[1].snippet === undefined && d[1].url === "https://example.com/hinton");
ok("ddg: limit", parseDdgHtml(DDG, 1).length === 1);
ok("realUrl menolak skema selain http(s)", realUrl("//duckduckgo.com/l/?uddg=javascript%3Aalert(1)") === null && realUrl("ftp://x.com") === null);
const w = parseWiki(WIKI, "id");
ok("wikipedia: url dan snippet", w[0].url === "https://id.wikipedia.org/wiki/Geoffrey_Hinton" && w[0].snippet === "Ilmuwan komputer - Geoffrey Everest Hinton", JSON.stringify(w[0]));
ok("wikipedia: tanpa description", w[1].snippet === "bahasa");
ok("clean: entitas dan tag", clean("a &lt;b&gt; &#39;x&#x27; <i>y</i>&nbsp;z") === "a <b> 'x' y z", clean("a &lt;b&gt; &#39;x&#x27; <i>y</i>&nbsp;z"));

// ── format ──
const long = "a".repeat(300);
const f = formatHits("q", { source: "duckduckgo", hits: [{ title: "T", url: "https://x.com", snippet: long }, { title: "U", url: "https://y.com" }] });
ok("format: nomor, url, snippet dipotong", f.startsWith('Hasil untuk "q" (duckduckgo):\n  1. T\n     https://x.com\n     ') && f.includes("…") && f.includes("  2. U\n     https://y.com") && f.split("\n")[3].length <= 5 + 160, f);
