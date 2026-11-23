# Named Dimension Machine

A deterministic, grammar-aware language machine for Indonesian, written in TypeScript and run with [Bun](https://bun.sh).
Understanding is built from named, readable features (word classes, clauses, affixes), not opaque embeddings.
It learns new words from explanations you type, and learns from your feedback by adjusting small, inspectable weights stored in SQLite.

- **Deterministic:** the same input and the same database always give the same output.
- **Readable:** every dimension has a grammar name (`has_qword`, `subject_omitted`, `prev.pron`, ...).
- **Trainable by a human:** teach words, correct intents, and fix ambiguous word senses from the REPL.
- **No softmax, no `exp`, no random numbers.**

## Architecture at a glance

| Part | Name | Role | Status |
|---|---|---|---|
| Whole system | **Named Dimension Machine** | Named dimensions, hard-attention heads, integer weights, routed tools | |
| Reader | Bidirectional hard-attention reader | Tokens read both sides within a clause: word sense, roles, clauses, intent | Working (`attention.ts`, `features.ts`, `intent.ts`) |
| Router | Expert Router | Chooses which tool (expert) answers a request | Tools run in `id` order today; a scored router is planned |
| Decoder | Frame realizer | Builds the reply from a frame (`act`, `verb`, `obj`, `tool`, `status`) | Templates in `respond.ts` and the `MSG` objects today; data-driven constructions are planned |
| Weights | Weight-space programming, human in the loop | Weights are written by hand, then corrected with `:fix` and `:sense` | Working |

"Weight-space programming" is used here in the sense of programming weights and features directly in code, without gradient-based training.
The reader has no softmax and no backpropagation: heads are hard attention, weights are small numbers, and every dimension has a grammar name.


## Requirements

- Bun with `Bun.SQL` SQLite support (1.2.21 or newer; developed against 1.4.x).
- No other dependencies.

## Quick start

```bash
bun install
bun main.ts                    # REPL
bun main.ts --rlhf             # REPL, with hints when the bot asks you to explain a word
bun main.ts --debug            # REPL, show features, scores and tokens for every reply
bun main.ts "kirim laporan"    # one-shot, no database
```

Everything you teach is stored in `data/ndm.db`. Use another file with `NDM_DB=sqlite://other.db`.

A short session:

```
kamu> halo
bot > Halo! Ada yang bisa saya bantu?
kamu> urutkan dari yang teratas 3 9 6 4 2 7 8
bot > Terurut turun: 9, 8, 7, 6, 4, 3, 2
kamu> cek server 149
bot > Saya belum mengenal kata "cek". Bisa dijelaskan?
kamu> kata kerja
bot > Oke, "cek" saya simpan sebagai kata kerja transitif. Mengulang pesan tadi:
```

Lines that start with `:` are commands. `:help` lists them all.

## How it works

The reader is a clause-local, Bidirectional hard-attention reader: heads look left and right, never across a conjunction or punctuation mark.

```
text
 -> tokenize           words, numbers, paths/files, punctuation
 -> morphology         root + affixes: meN-, di-, ber-, -kan, -i, -nya, -lah, reduplication
 -> tag                word class (POS) per token, from the lexicon
 -> resolve senses     choose a class for ambiguous words (bisa, pesan, jalan) from context
 -> clauses            split on conjunctions/punctuation; subject, object, transitivity
 -> features           named binary features
 -> intent             weighted sum over active features, argmax
 -> tools / respond    math tool, capability answers, templates
```

### Word classes

Words carry one or more classes, the first being the main one. `:edit bisa pos=aux,noun` gives a word two.

| Class | Names accepted |
|---|---|
| verb | kata kerja, verba |
| noun | kata benda, nomina |
| adj | kata sifat, adjektiva |
| adv | kata keterangan, adverbia |
| pron | kata ganti, pronomina |
| num | kata bilangan, numeralia |
| prep | kata depan, preposisi |
| conj | kata hubung, kata sambung, kata penghubung, konjungsi |
| interj | kata seru, interjeksi, sapaan, salam |
| aux | kata bantu, verba bantu, auksiliari |
| det | kata penunjuk, penentu, determiner, artikel |
| polite | kata sopan, kata santun, kata permohonan |
| qword | kata tanya, interogatif |

Verbs also carry transitivity (`transitive`, `intransitive`, or both).

### Intent classification (weights 0 to 1)

`intent.ts` scores each intent as the sum of weights of the active features, and the highest score wins.
Ties go to the intent that comes first in `INTENTS`. Initial weights are hand-written in `DEFAULT_WEIGHTS`.

Intents: `error`, `code`, `smalltalk`, `request`, `question`, `define`, `other`.

Feedback changes the weights, and only the changed rows are stored (table `weights`):

| Command | Effect |
|---|---|
| `:fix intent=X` | Raise X and lower the wrong winner on the active features until the prediction flips (step 0.05, at most 40 steps) |
| `:good` | Raise the winner on active features by 0.02 |
| `:bad` | Lower the winner on active features by 0.02 |

Weights stay in [0, 1]. `:weights` shows them, `:reset` restores the defaults.
After several corrections, run your regression tests, because one correction also shifts features that other sentences use.

### Sense selection for ambiguous words (integer weights)

`attention.ts` picks the class of a word with several classes. It is a small, fully named, integer-only program:

1. Each token is a one-hot vector of its current class.
2. Hard-attention heads find the nearest matching neighbour (`prev`, `next`, `verb_right`, `subject_left`, ...).
3. Head outputs become named features such as `verb_right.verb`, plus `at_start` / `at_end`.
4. ReLU gates combine two features (`pron_then_verb`, `det_then_noun`, `aux_then_verb`).
5. Score of a sense = `2 * W["word|pos"][feature] + W["*|pos"][feature]`, summed over active features. Ties go to the main class.

`:sense` shows the scores for the last sentence. `:sense bisa noun` trains that word toward a class (steps of +1/-1) and stores the change in `sense_weights`.

### Learning words

When the bot meets an unknown word it asks, often with a guess from context. You can answer:

```
zxqv artinya file                 alias to a known word
zxqv = kirim                      same
zxqv itu kata kerja intransitif   declare the class (and transitivity)
zxqv kata kerja, artinya kirim    both
ya                                accept the bot's guess
batal                             skip the word
```

A long sentence that does not look like an explanation is treated as a new message instead.
Learned words are stored with a stable token id, and the original sentence is replayed once the word is known.
Context counts (left class, class, right class) are learned from sentences whose words are all known, and are used to guess classes of unknown words.

### Tools and capabilities

Tools are stored in the database with their verbs, objects and vocabulary (`tool_word` maps a word to a role).

- **math** (built in): `+ - * /`, parentheses, `tambah/kurang/kali/bagi`, `jumlah`, `rata-rata`, `maksimum`, `minimum`, `urutkan` with direction words (`teratas`, `terbesar`, `naik`, `terkecil`, ...). The role of each word is data in `seed.ts`.
- **capability:** "kau bisa apa aja" lists registered tools, "bisa kirim?" checks whether a tool announces that verb.
- **confirmation:** for requests such as `kirim laporan` the bot asks `Lanjutkan? (ya/tidak)` and reads your answer. A tool must be registered for the verb, otherwise it tells you which tools exist.

### Harness environment

The bot knows a few labels about where it runs: `proyek`, `workspace`, `pengguna`, `unduhan`, `dokumen`.
Add more with a `harness.json` file in the working directory or the `BOT_ENV` environment variable (JSON array):

```json
[{ "kind": "dir", "label": "logs", "value": "/var/log/app" }]
```

`kind` is `project`, `workspace`, `user`, or `dir`. A label must be a single `[a-z0-9]+` token. `:env` lists what is loaded.

## REPL commands

| Command | Purpose |
|---|---|
| `:kata <word>` | Show a word's features, token id, class, transitivity, alias and tables |
| `:id <word or number>` | Word to token id and back |
| `:edit <word> k=v ...` | Edit features: `pos=` (comma separated for several), `trans=`, `alias=` (`alias=-` removes) |
| `:learned` | Words you taught, with token ids and your explanation |
| `:forget <word>` | Forget a learned word, or restore a built-in word you edited |
| `:kelas` | List word classes |
| `:konteks [reset]` | Show or clear learned context counts |
| `:good` / `:bad [note]` / `:fix k=v ...` | Feedback on the last answer |
| `:weights` / `:reset` | Show or reset intent weights |
| `:sense [word class]` | Show or train sense selection (`:sense reset` clears it) |
| `:stats` / `:export` | Feedback summary, and feedback as test rows |
| `:env` | Show harness environment |
| `:rlhf` / `:debug` | Toggle hints / debug output |
| `:help` / `:quit` | Help, exit (Ctrl+D also works) |

`:fix` accepts `language`, `intent`, `sentence_count`, `sentence_type`, `clause_count`, `subject_omitted`, `split_actions`, `object_shared`.
Only `intent` changes weights. Other keys are stored so `:export` can turn them into regression tests.

## Database

SQLite through `Bun.SQL`. Main tables:

| Table | Content |
|---|---|
| `words`, `word_pos`, `transitive_verb`, `intransitive_verb`, `word_alias`, `word_log` | Lexicon, one table per feature, all keyed by `words.id` (the token id) |
| `interactions`, `feedback` | Every sentence and the ratings and corrections you gave |
| `weights` | Intent weights that differ from the defaults (0 to 1) |
| `sense_weights` | Sense selection weights (integers, may be negative) |
| `context_stats` | Left class, class, right class counts |
| `tools`, `tool_verb`, `tool_object`, `tool_word` | Registered tools and their vocabulary |
| `env` | Harness labels |

The `weights` table stays empty until you use `:good`, `:bad`, or `:fix`, and `sense_weights` until you use `:sense`.
The defaults live in code and are not stored.

The numeric intent codes are stored in the database, so new intents may only be appended at the end:

```ts
export const Intent = {
  Error: 0, Code: 1, Smalltalk: 2, Request: 3, Question: 4, Other: 5, Define: 6,
} as const;
```

## Tests

```bash
bun src/tests.ts
```

The tests are tables of `(input, expected features)`. `:export` prints rows you can paste into the table.
Run them after feedback sessions to catch regressions caused by weight updates.

## Known limits

- Indonesian only, and the built-in vocabulary is small. Unknown words are asked about, not guessed silently.
- A message is handled as one input. There is no multi-turn dialog state beyond "explain this word" and "continue? yes/no".
- Tools other than `math` are registered but do not run yet: the bot reports that a tool exists but cannot call it.
- The router has no scores yet. When several tools claim the same verb, the one with the lowest `id` wins.
- Replies are templates. The machine reads Indonesian well within its grammar, but it does not generate free text.
- One class per word per sentence. Class guessing for unknown words is weak at the start of a sentence, where there is no left neighbour.