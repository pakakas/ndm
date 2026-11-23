import type { Interface } from "node:readline";
import type { Store } from "../src/store";
import type { Pos } from "../src/types";
import { Plan } from "../src/confirm";

/** Keadaan satu sesi REPL. Dibagikan ke semua perintah, jadi tidak ada variabel closure. */
export interface Session {
  store: Store;
  rl: Interface;
  debug: boolean;
  rlhf: boolean;
  lastId: number | null;
  lastInput: string;
  pending: { word: string; input: string; guess?: Pos } | null; // kata asing yang menunggu penjelasan
  confirm: Plan | null;
}
