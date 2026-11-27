// Definisi tool "search" untuk tabel tools (bentuknya sama dengan tool lain: nama, deskripsi, kata kerja, benda).
import type { Tool } from "../tools";

export const SEARCH_TOOL: Tool = {
  name: "search",
  description: "Cari informasi di internet (DuckDuckGo, cadangan Wikipedia). Contoh: cari geoffrey hinton",
  // Hanya yang diumumkan ke pengguna (capability); variasi "cariin", "carikan", "googling" dikenali parseSearch.
  verbs: ["cari", "google"],
  objects: ["internet"],
};
