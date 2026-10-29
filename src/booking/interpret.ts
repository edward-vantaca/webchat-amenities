// Swap point: a Claude-backed implementation replaces this function body. It
// would post `text` + `ctx` to a server that holds the API key, and may set
// `reply` on the returned Interpretation. v1 uses the rules-based reader.
import { parseMessage } from "./rulesReader";
import type { ChatMessage, Draft, ISODate, Interpretation } from "./types";

export type InterpretContext = { draft: Draft; today: ISODate; history: ChatMessage[] };

export function interpret(text: string, ctx: InterpretContext): Promise<Interpretation> {
  return Promise.resolve(parseMessage(text, ctx.today));
}
