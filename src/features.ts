import { EN_WORDS } from "./lexicon";
import { tokenize, tag } from "./tokenizer";
import { segments, verbIdx, hasVerb, hasSubject, hasObject, bucket } from "./clauses";
import { classify, FeatureVec, IntentTrace } from "./intent";
import { Features, Language, Poses, SentenceType, Tok } from "./types";

const ERROR_RE = /traceback|exception|error:|\bat line \d+|stack ?trace/i;
const CODE_RE = /[{};]\s*$|=>|\bfunction\b|\bconst\b|\bdef\b|\bimport\b.+\bfrom\b/m;

function detectLanguage(toks: Tok[]): Language {
  let id = 0, en = 0;
  for (const t of toks) {
    if (t.pos === "punct") continue;
    if (t.known) id++;
    else if (EN_WORDS.has(t.text)) en++;
  }
  if (id === 0 && en === 0) return "other";
  if (id > 0 && en > 0 && Math.min(id, en) / Math.max(id, en) >= 0.6) return "mixed";
  return id >= en ? "indonesian" : "english";
}

const b = (v: boolean): 0 | 1 => (v ? 1 : 0);

export function featuresFromToks(toks: Tok[], raw: string): Features {
  const segs = segments(toks);
  const vsegs = segs.filter(hasVerb);
  const words = toks.filter((t) => t.pos !== "punct");

  const hasQ = raw.includes("?") || toks.some((t) => t.pos === "qword");
  let sentence_type: SentenceType;
  if (hasQ) sentence_type = "question";
  else if (!vsegs.length) sentence_type = "fragment";
  else {
    const v = vsegs[0][verbIdx(vsegs[0])];
    sentence_type = !hasSubject(vsegs[0]) && v.voice !== "passive" ? "imperative" : "statement";
  }

  const subject_omitted = vsegs.length ? !hasSubject(vsegs[0]) : null;
  const split_actions = vsegs.length ? vsegs.length >= 2 : null;
  let object_shared: boolean | null = vsegs.length ? false : null;
  if (vsegs.length >= 2) {
    object_shared = vsegs.slice(1).some((s, i) => {
      const v = s[verbIdx(s)];
      return v.trans === "trans" && !hasObject(s) && hasObject(vsegs[i]);
    });
  }

  return {
    language: detectLanguage(toks),
    sentence_type,
    sentence_count: bucket(vsegs.length),
    clause_count: bucket(vsegs.length),
    subject_omitted,
    split_actions,
    object_shared,
  };
}

export function analyzeText(raw: string, poses: Poses): { f: Features; toks: Tok[]; trace: IntentTrace } {
  const toks = tag(tokenize(raw), poses);
  const f = featuresFromToks(toks, raw);
  const words = toks.filter((t) => t.pos !== "punct");
  const normalized = words.map((t) => t.text).join(" ");
  const verb = toks.some((t) => t.pos === "verb");
  const ability = verb && toks.some((t) => t.pos === "aux" && (t.lemma === "bisa" || t.lemma === "dapat"));

  const x: FeatureVec = {
    bias: 1,
    has_error_pattern: b(ERROR_RE.test(raw)),
    looks_like_code: b(CODE_RE.test(raw)),
    all_interj: b(words.length > 0 && words.every((t) => t.pos === "interj")),
    smalltalk_phrase: b(/^(apa|bagaimana) kabar\b/.test(normalized)),
    polite_and_verb: b(verb && toks.some((t) => t.pos === "polite")),
    ability_no_subject: b(ability && f.subject_omitted === true),
    ability_with_subject: b(ability && f.subject_omitted === false),
    has_qword: b(toks.some((t) => t.pos === "qword")),
    has_question_mark: b(raw.includes("?")),
    has_verb: b(verb),
    imperative_form: b(f.sentence_type === "imperative"),
    subject_omitted: b(f.subject_omitted === true),
    has_subject: b(verb && f.subject_omitted === false),
    passive_voice: b(toks.some((t) => t.pos === "verb" && t.voice === "passive")),
    multi_action: b(f.split_actions === true),
    is_fragment: b(f.sentence_type === "fragment"),
    has_unknown: b(toks.some((t) => t.pos === "unknown")),
    asks_definition: b(/^(apa (itu|arti|artinya|maksud)|arti|maksud)\b|\b(itu apa|artinya apa|berarti apa)$/.test(normalized)),
  };

  const trace = classify(x);
  f.intent = trace.winner;  // ← set intent ke Features
  return { f, toks, trace };
}
