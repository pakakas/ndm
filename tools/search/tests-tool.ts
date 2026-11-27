// Tool "search" di mekanisme tool milik proyek (tools.ts + respond.ts).
import { SEARCH_TOOL } from "./tool";
import { setTools, runTools, asyncJob, registerHandler } from "../../src/tools";
import { respond } from "../../src/respond";
import { ok, calls, fake, ddgOk, wikiId } from "./tests-util";
import { unknownWord } from "../../src/unknown";

ok("tool: bentuk", SEARCH_TOOL.name === "search" && SEARCH_TOOL.verbs.join() === "cari,google" && !!SEARCH_TOOL.description);

const realFetch = globalThis.fetch;
registerHandler("dummy", (raw) => (/^dummy/.test(raw) ? "dummy menjawab" : null));
const dummy = { name: "dummy", description: "", verbs: [] as string[] };

setTools([]);
ok("tanpa tool search aktif: tidak ditangani, kata asing ditanyakan", runTools("cariin geoffrey hinton") === null && unknownWord("cariin geoffrey hinton") !== null);

setTools([dummy, SEARCH_TOOL]);
const t1 = runTools("cariin geoffrey hinton");
ok("runTools: balasan awal murni", t1?.tool === "search" && t1.reply === 'Mencari "geoffrey hinton" di internet...', JSON.stringify(t1));
ok("unknownWord: nama tidak ditanyakan", unknownWord("cariin geoffrey hinton") === null);
ok("respond: balasan awal", respond("cariin geoffrey hinton") === 'Mencari "geoffrey hinton" di internet...');
ok("bukan pencarian: dilewati", runTools("cari file laporan") === null && asyncJob("cari file laporan") === null);
ok("handler sinkron lain tetap jalan", runTools("dummy x")?.tool === "dummy" && asyncJob("dummy x") === null);

calls.length = 0;
(globalThis as any).fetch = fake([ddgOk, wikiId]);
const job = asyncJob("cariin geoffrey hinton");
ok("asyncJob ada, belum menghubungi jaringan", job?.tool === "search" && calls.length === 0);
const out = await job!.run();
ok("asyncJob.run: hasil pencarian", out.startsWith('Hasil untuk "geoffrey hinton" (duckduckgo):') && out.includes("https://en.wikipedia.org/wiki/Geoffrey_Hinton"), out);
ok("ack dan respond tidak pernah memanggil jaringan", (respond("cariin geoffrey hinton"), unknownWord("cariin geoffrey hinton"), calls.length === 1), String(calls.length));

(globalThis as any).fetch = fake([[/./, () => new Response("", { status: 500 })]]);
const bad = await asyncJob("cari di internet apa saja")!.run();
ok("run tidak melempar error saat gagal", bad.startsWith("Gagal mencari di internet:") && bad.includes("HTTP 500"), bad);

setTools([dummy]);
ok("tool search tidak aktif -> nonaktif", runTools("cariin geoffrey hinton") === null);
globalThis.fetch = realFetch;
