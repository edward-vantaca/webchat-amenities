// Swap point. A Claude-backed implementation replaces the body of `interpret`: it would post
// `text` + `ctx` to a small server that holds the API key and resolve to an Interpretation.
//
// Contract:
// - `ctx.draft` is the booking in progress, `ctx.today` the resident's local date, `ctx.history`
//   the conversation so far (without the message being interpreted), and `ctx.activeWidget` the
//   kind of the newest live widget (what the resident is looking at), if any.
// - The result may set `reply`. The chat shows it in place of its own wording, but keeps its own
//   notices in front (fully booked, "isn't available", closest start, guests clamped).
// - The panel tags each request with the turn (the id of the resident's message) and the reducer
//   drops a result whose turn is no longer the awaited one, so a slow reply can't land late.
// - A rejected promise shows "Something went wrong, please try again." with the current picker.
// v1 uses the rules-based reader, which resolves immediately and never sets `reply`.
import { toISODate } from "./dates";
import { parseMessage } from "./rulesReader";
import type { ChatMessage, ChatState, Draft, ISODate, Interpretation, Widget } from "./types";

export type InterpretContext = { draft: Draft; today: ISODate; history: ChatMessage[]; activeWidget?: Widget["kind"] };

export function contextFor(state: ChatState, now: Date): InterpretContext {
  const newest = [...state.messages].reverse().find((m) => m.active && m.widget);
  const ctx: InterpretContext = { draft: state.draft, today: toISODate(now), history: state.messages };
  if (newest?.widget) ctx.activeWidget = newest.widget.kind;
  return ctx;
}

export function interpret(text: string, ctx: InterpretContext): Promise<Interpretation> {
  return Promise.resolve(parseMessage(text, ctx.today, ctx.draft));
}
