// bun src/search/tests.ts   (semua jaringan ditiru: tidak ada permintaan sungguhan)
import { results } from "./tests-util";
import "./tests-parse";
import "./tests-providers";
import "./tests-tool";

console.log(results.fail ? `\n${results.fail} tes pencarian gagal` : "\nSemua tes pencarian lolos");
