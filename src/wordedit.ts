// Edit fitur kata secara manual: :edit <kata> pos=... trans=... alias=...
// pos boleh lebih dari satu, dipisah koma: pos=noun,verb
// Berlaku untuk kata bawaan, kata hasil belajar, maupun kata baru.
import { entryOf } from "./lexicon";
import { analyze } from "./morphology";
import { CLASSES, Learned, resolvePos } from "./learning";
import { Pos, Trans } from "./types";

const TRANS: Record<string, Trans> = {
  none: "none", intrans: "intrans", intransitif: "intrans", trans: "trans", transitif: "trans",
};

export function parseEdit(word: string, args: string[]): { learned?: Learned; error?: string } {
  const w = word.toLowerCase();
  const cur = entryOf(w);
  if (args.length === 0) return { error: "Beri minimal satu k=v: pos=, trans=, atau alias=." };

  let poss: Pos[] | undefined = cur?.poss;
  let trans: Trans | undefined = cur ? (cur.transitive ? "trans" : cur.intransitive ? "intrans" : undefined) : undefined;
  let aliasOf: string | undefined = cur?.aliasOf;
  let posGiven = false;
  let aliasGiven: string | undefined;

  for (const a of args) {
    const i = a.indexOf("=");
    if (i < 1) return { error: `format salah: "${a}" (pakai kunci=nilai)` };
    const k = a.slice(0, i).toLowerCase();
    const v = a.slice(i + 1);
    if (k === "pos") {
      // beberapa kelas dipisah koma: pos=noun,verb (yang pertama = utama)
      const list: Pos[] = [];
      for (const part of v.split(",")) {
        const p = resolvePos(part);
        if (!p) return { error: `kelas kata tidak dikenal: "${part}". Pilihan: ${CLASSES.map((c) => c.pos).join(", ")}` };
        if (!list.includes(p)) list.push(p);
      }
      poss = list; posGiven = true;
    } else if (k === "trans") {
      const t = TRANS[v.toLowerCase()];
      if (!t) return { error: `trans tidak dikenal: "${v}". Pilihan: none, intrans, trans` };
      trans = t;
    } else if (k === "alias") {
      aliasGiven = v;
    } else {
      return { error: `kunci tidak dikenal: "${k}". Pilihan: pos, trans, alias` };
    }
  }

  if (!poss || !poss.length) return { error: `"${w}" belum ada di leksikon. Tambahkan pos=, mis. :edit ${w} pos=verb trans=trans` };
  const pos = poss[0];

  // ada kelas kata kerja: trans default transitif; selain itu trans selalu none
  if (poss.includes("verb")) trans = trans && trans !== "none" ? trans : "trans";
  else trans = "none";

  if (aliasGiven !== undefined) {
    if (aliasGiven === "-" || aliasGiven.toLowerCase() === "none") aliasOf = undefined;
    else {
      const m = analyze(aliasGiven.toLowerCase());
      if (!m) return { error: `kata tujuan alias belum dikenal: "${aliasGiven}"` };
      if (!m.alts.includes(pos)) return { error: `alias "${m.lemma}" berkelas ${m.pos}, bukan ${pos}` };
      aliasOf = m.lemma;
    }
  } else if (posGiven && aliasOf) {
    // kelas diganti dan alias lama beda kelas: lepas alias
    const m = analyze(aliasOf);
    if (!m || !m.alts.includes(pos)) aliasOf = undefined;
  }

  const learned: Learned = { word: w, pos, trans, aliasOf };
  if (poss.length > 1) learned.extra = poss.slice(1);
  return { learned };
}
