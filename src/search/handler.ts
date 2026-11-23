// Menghubungkan pencarian ke mekanisme tool: aktif hanya kalau tool "search" ada di tabel tools.
import { registerAsyncHandler } from "../tools";
import { parseSearch, search, formatHits } from "./index";

registerAsyncHandler("search", {
  // murni dan cepat: dipanggil berulang oleh respond() dan unknownWord()
  ack: (raw) => {
    const q = parseSearch(raw);
    return q ? `Mencari "${q.query}" di internet...` : null;
  },
  run: async (raw) => {
    const q = parseSearch(raw);
    if (!q) return "";
    try {
      return formatHits(q.query, await search(q.query));
    } catch (e) {
      return `Gagal mencari di internet: ${(e as Error).message}`;
    }
  },
});
