// main.ts — Named Dimension Machine, role-first.
// Dim 0 = role (dinamis, per-kalimat). POS = turunan dari role (dim 1).
// Deterministik, integer, named dimensions.

// ── Roles ──
type ROLE = "subject" | "predicate" | "object" | "modifier" | "connector" | "negator" | "aux" | "dependent" | "dependency";
enum Role { subject = 0, predicate = 1, object = 2, modifier = 3, connector = 4, negator = 5, aux = 6, dependent = 7, dependency = 8 }
const ROLES: Record<ROLE, number> = Array(9).fill('').map((_,i) => i);
// type Role = (typeof ROLES)[number];

console.debug({ROLES}, ROLES.length)
const POS = ["verb", "noun", "adj", "adv", "pron", "num", "prep", "conj", "interj", "aux", "det", "polite", "qword", "unknown"] as const;
type Pos = (typeof POS)[number];

// Role → default POS mapping
const ROLE_TO_POS: Record<Role, Pos> = {
  subject: "noun",
  predicate: "verb",
  object: "noun",
  modifier: "adj",
  connector: "conj",
  negator: "aux",
  aux: "aux",
  dependent: "noun",
  dependency: "noun",
};

const W_roles = [1, 2, 4, 8, 16, 32, 64, 128, 256]

function assignRole(weight: number, key: number, index: number) {
  switch (true) {
    case key === Role.subject && index === 0: return weight
    default: return 0
  }
}

function tokenize(input: string) {
  const words = input.toLowerCase().split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    return W_roles.map((w, key) => assignRole(w, key, i))
  })
}

// ── Run ──
const tests = [
  "aku bisa makan nasi",
  "bisa ular sangat beracun",
  // "tv ga bisa masuk koper karena terlalu besar",
  // "meja ga bisa masuk koper karena terlalu kecil",
  // "tontonan yang daging banget",
  // "kulit beras",
  // "kulit bumi",
  // "saya kirim file",
];

for (const input of tests) {
  const toks = tokenize(input)
  console.debug({toks})
}


const counts: Record<string, { pos: number; neg: number; next: Record<string, number> }> = {};

function learn(text: string, positive: boolean): void {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    counts[w] ??= { pos: 0, neg: 0, next: {} };
    counts[w][positive ? "pos" : "neg"]++;
    if (i + 1 < words.length) {
      counts[w].next[words[i + 1]] = (counts[w].next[words[i + 1]] ?? 0) + 1;
    }
  });
}

// Train:
learn("i mau makan", true);
learn("i ga mau makan", false);
learn("i ngga mau makan", false);
learn("i tidak mau makan", false);

// Result:
// "i"      → { pos: 1, neg: 3, next: { mau: 1, ga: 1, ngga: 1, tidak: 1 } }
// "mau"    → { pos: 1, neg: 3, next: { makan: 4 } }
// "makan"  → { pos: 1, neg: 3, next: {} }
// "ga"     → { pos: 0, neg: 1, next: { mau: 1 } }   ← pos: 0
// "ngga"   → { pos: 0, neg: 1, next: { mau: 1 } }   ← pos: 0
// "tidak"  → { pos: 0, neg: 1, next: { mau: 1 } }   ← pos: 0   

console.debug(Bun.inspect(counts))