import type { Tool } from "./tools";

export const MATH_TOOL: Tool = {
  name: "math",
  description: "Hitungan dasar: operator, jumlah, rata-rata, maksimum, minimum, urutkan.",
  verbs: [],
  words: [
    { word: "tambah",     poss: ["verb"],         trans: "trans", role: "+" },
    { word: "kurang",     poss: ["verb"],         trans: "trans", role: "-" },
    { word: "kali",       poss: ["noun", "verb"], trans: "trans", role: "*" },
    { word: "bagi",       poss: ["verb"],         trans: "trans", role: "/" },
    { word: "jumlah",     poss: ["noun"],         trans: "none",  role: "sum" },
    { word: "rata",       poss: ["noun"],         trans: "none",  role: "avg" },
    { word: "maksimum",   poss: ["noun"],         trans: "none",  role: "max" },
    { word: "minimum",    poss: ["noun"],         trans: "none",  role: "min" },
    { word: "urutkan",    poss: ["verb"],         trans: "trans", role: "sort" },
    { word: "matematika", poss: ["noun"],         trans: "none",  role: "topic" },
    // Arah urutan. Mau membalik artinya? Ubah role-nya (atau ajarkan sinonim: "paling-atas artinya teratas").
    { word: "teratas",    poss: ["adj"],          trans: "none",  role: "desc" },
    { word: "terbesar",   poss: ["adj"],          trans: "none",  role: "desc" },
    { word: "turun",      poss: ["adj"],          trans: "none",  role: "desc" },
    { word: "menurun",    poss: ["adj"],          trans: "none",  role: "desc" },
    { word: "terbawah",   poss: ["adj"],          trans: "none",  role: "asc" },
    { word: "terkecil",   poss: ["adj"],          trans: "none",  role: "asc" },
    { word: "naik",       poss: ["adj"],          trans: "none",  role: "asc" },
    { word: "menaik",     poss: ["adj"],          trans: "none",  role: "asc" },
  ],
};