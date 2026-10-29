# Amenity Booking in Ask HOAi Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a resident reserve an amenity inside the Ask HOAi chat by tapping tiles (amenity → day → time → summary → confirm) or by typing at any point, with the chat asking only for what is still missing.

**Architecture:**
- **Pure domain modules** in `src/booking/`:
  - amenity data
  - local-date helpers
  - deterministic mock availability
  - a rules-based reader behind one async `interpret()` swap point
  - a chat reducer that owns the message list, the booking draft and the confirmed bookings
- **React widgets** in `src/chat/widgets/` render each widget message.
- **`AskHoaiPanel`** switches from the welcome screen to a conversation thread with the input pinned at the bottom.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Tailwind CSS v4, lucide-react, Vitest 4 + Testing Library + jsdom (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-10-29-amenity-booking-chat-design.md`. Read it before starting any task.

## Global Constraints

- No animations or transitions anywhere: no `transition-*`, no `animate-*`, no smooth scrolling, no typing-dots delay.
- The panel is 400px wide (shown at `lg` and up). Every widget must fit inside it with 20px side padding. Only the day strip scrolls sideways.
- Styling follows the existing files: inline Tailwind classes with hex colours (`#247ae4` primary, `#262630` text, `#e2e8f0` borders, `#f4f6f9` light fill), `font-['DM_Sans:SemiBold',sans-serif]`-style faces for headings, and `lucide-react` icons.
- Dates are **local calendar dates**, written as an ISO string `YYYY-MM-DD` (`ISODate`). Never use `toISOString()` for a date, because it converts to UTC and shifts the day.
- Booking window: today through **today + 60 days**, inclusive.
- Start times are whole hours, from `open` to `close - hours`, inclusive.
- "Next week" means Monday–Sunday of the following calendar week.
- Only the newest widget message is active. Every older widget renders faded (`opacity-50 pointer-events-none`) and the reducer ignores events from it.
- Copy that must match the spec exactly:
  - Common question text: `Reserve an amenity for me`
  - Not-understood reply: `Sorry, I didn't catch that. You can pick from the options below.`
  - Out-of-window reply: `I can only book up to 60 days ahead.`
  - Error reply: `Something went wrong, please try again.`
  - Off-topic canned reply: `I can help you reserve an amenity. Tap "Reserve an amenity for me" to get started.`
- Tests use a fixed clock: `new Date(2026, 9, 29, 9, 0)`, which is **Thursday Oct 29, 2026, 9:00 AM** local. With that clock:
  - "Saturday" is `2026-10-31`.
  - Next week is `2026-11-02`–`2026-11-08`.
  - The last bookable day is `2026-12-28`.

## Review Focus

The five failures most likely to bite a resident that no other test pins. Each one has a test in the task that owns the code.

1. **Late in the day:** at 8:30 PM, tennis has no start left today. Today must render greyed in the strip, and typing "today" must say it's fully booked and show the strip. → Task 2 (`hasOpenSlot` at 20:30), Task 4 (`typed today when no starts left`).
2. **Bare hour without am/pm:** "Saturday at 3" must mean 3 PM, not 3 AM. "at 9" means 9 AM. → Task 3 (`bare hours`).
3. **Switching amenity can break the draft:** the guest count must clamp to the new amenity's max (clubhouse 30 → tennis 4). A kept date that has no open slots for the new amenity must be dropped with a "fully booked" reply. → Task 4 (`change amenity clamps guests and drops a full date`).
4. **Taps on stale widgets:** tapping Confirm on an old, inactive summary must not create a second booking. → Task 4 (`events from inactive widgets are ignored`).
5. **Timezone drift:** `toISODate` must return the local date at 11:30 PM, not the next UTC day. → Task 2 (`toISODate uses local date`).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/booking/types.ts` | Shared types: `AmenityId`, `Amenity`, `ISODate`, `Draft`, `Booking`, `Interpretation`, `Widget`, `ChatMessage`, `ChatState`, `ChatEvent` |
| `src/booking/amenities.ts` | `AMENITIES` data + `getAmenity` |
| `src/booking/dates.ts` | Local-date helpers |
| `src/booking/availability.ts` | Start times, deterministic mock taken slots, booking overlap, open-slot queries |
| `src/booking/rulesReader.ts` | `parseMessage(text, today)`: sync rules-based understanding |
| `src/booking/interpret.ts` | `interpret(text, ctx)`: async swap point; v1 wraps `parseMessage` |
| `src/booking/chatReducer.ts` | `initChat(now)`, `chatReducer(state, event)`: drafting, prompts, widget activation |
| `src/chat/widgets/*.tsx` | One presentational component per widget kind + `WidgetView` switch |
| `src/chat/AskHoaiPanel.tsx` | Modify: conversation mode, wiring reducer + interpret |
| `public/assets/amenity-*.jpg` | Six amenity photos copied from `../home-vision/public/assets/` |
| `src/booking/__tests__/*.test.ts`, `src/chat/__tests__/*.test.tsx` | Tests |

## Shared Types (created in Task 1, `src/booking/types.ts`)

All tasks use these names exactly.

```ts
export type AmenityId = "tennis" | "pickleball" | "clubhouse" | "basketball" | "lounge" | "conference";
export type Amenity = {
  id: AmenityId; name: string; image: string;
  hours: number;      // booking length
  maxGuests: number;
  open: number;       // opening hour, 0–23
  close: number;      // closing hour, 0–24
  aliases: string[];  // lowercase words the reader matches
};
export type ISODate = string; // local "YYYY-MM-DD"
export type DateRange = { from: ISODate; to: ISODate }; // inclusive
export type TimeOfDay = "morning" | "afternoon" | "evening"; // [open,12) [12,17) [17,close)
export type Draft = {
  amenity?: AmenityId; date?: ISODate; time?: number; guests: number;
  range?: DateRange; timeOfDay?: TimeOfDay; find?: boolean;
};
export type Booking = { confirmation: string; amenity: AmenityId; date: ISODate; time: number; guests: number };

export type Intent =
  | "book" | "find" | "changeAmenity" | "changeDay" | "changeTime"
  | "confirm" | "listReservations" | "offTopic" | "unknown";
export type Interpretation = {
  intent: Intent;
  slots: { amenity?: AmenityId; date?: ISODate; time?: number; timeOfDay?: TimeOfDay; guests?: number };
  range?: DateRange;
  snappedFrom?: string;    // e.g. "10:30" when the time was snapped to an hour
  ambiguous?: "court";
  outOfWindow?: boolean;
  reply?: string;          // future Claude reader only; v1 never sets it
};

export type Chip = { label: string; event: ChatEvent };
export type Widget =
  | { kind: "amenities" }
  | { kind: "days"; from: ISODate; count: number }
  | { kind: "calendar"; month: ISODate }  // first day of the shown month
  | { kind: "slots"; amenity: AmenityId; date: ISODate; timeOfDay?: TimeOfDay }
  | { kind: "slotList"; amenity: AmenityId; range: DateRange }
  | { kind: "summary"; amenity: AmenityId; date: ISODate; time: number; guests: number }
  | { kind: "confirmation"; booking: Booking }
  | { kind: "reservations"; bookings: Booking[] }
  | { kind: "chips"; chips: Chip[] };
export type ChatMessage = { id: number; role: "user" | "agent"; text?: string; widget?: Widget; active: boolean };
export type ChatState = { now: Date; messages: ChatMessage[]; draft: Draft; bookings: Booking[]; pending: boolean; nextId: number };

export type ChatEvent =
  | { type: "commonQuestion"; text: string }
  | { type: "userText"; text: string }                      // echoes text, sets pending
  | { type: "interpreted"; result: Interpretation }         // clears pending
  | { type: "interpretFailed" }                              // clears pending
  | { type: "pickAmenity"; amenity: AmenityId; from: number } // `from` = id of the widget message tapped
  | { type: "pickDate"; date: ISODate; from: number }
  | { type: "openCalendar"; from: number }
  | { type: "calendarMonth"; month: ISODate; from: number }
  | { type: "pickSlot"; date: ISODate; time: number; from: number }
  | { type: "setGuests"; guests: number; from: number }
  | { type: "confirm"; from: number }
  | { type: "change"; from: number }
  | { type: "back"; to: "amenity" | "day" | "time"; from: number }
  | { type: "bookAnother"; from: number }
  | { type: "listReservations"; from: number };
```

The reducer drops any event with a `from` that isn't the id of an active message. That one rule is how "only the newest widget is live" works.

---

### Task 1: Test tooling, amenity data, local-date helpers

**Files:**
- Modify: `package.json` (add `"test": "vitest run"`, `"test:watch": "vitest"`; devDeps `vitest@^4.1.11`, `jsdom@^29.1.1`, `@testing-library/react@^16.3.3`, `@testing-library/jest-dom@^6.9.1`, `@testing-library/user-event@^14.6.7`)
- Modify: `vite.config.ts` (add `/// <reference types="vitest" />` and `test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"] }`)
- Modify: `tsconfig.json` (add `"vitest/globals"` to `types`)
- Create: `src/test-setup.ts` (`import "@testing-library/jest-dom/vitest";`)
- Create: `src/booking/types.ts` (verbatim from Shared Types above)
- Create: `src/booking/amenities.ts`, `src/booking/dates.ts`
- Copy: `../home-vision/public/assets/amenity-{tennis,pickleball,clubhouse,basketball,lounge,conference}.jpg` → `public/assets/`
- Test: `src/booking/__tests__/dates.test.ts`, `src/booking/__tests__/amenities.test.ts`

**Interfaces:**
- Produces:
  - `AMENITIES: Amenity[]`, in the spec order: tennis, pickleball, clubhouse, basketball, lounge, conference
  - `getAmenity(id: AmenityId): Amenity`
  - From `dates.ts`:
    - `toISODate(d: Date): ISODate`
    - `fromISODate(s: ISODate): Date` (local midnight)
    - `addDays(s: ISODate, n: number): ISODate`
    - `weekday(s: ISODate): number` (0 = Sun)
    - `nextWeek(today: ISODate): DateRange`
    - `lastBookable(today: ISODate): ISODate` (today + 60)
    - `inWindow(s: ISODate, today: ISODate): boolean`
    - `formatDayLong(s): string` → `"Saturday, Oct 31"`
    - `formatDayShort(s): { weekday: "Sat"; day: "31"; month: "Oct" }`
    - `formatHour(h: number): string` → `"10:00 AM"`, `"12:00 PM"`
    - `formatRange(h: number, hours: number): string` → `"10:00 – 11:00 AM"` when both ends share AM/PM, else `"11:00 AM – 3:00 PM"`

Amenity values (from the spec):

| id | name | hours | maxGuests | open | close | aliases |
| --- | --- | --- | --- | --- | --- | --- |
| tennis | Tennis Court | 1 | 4 | 7 | 21 | tennis |
| pickleball | Pickleball Court | 1 | 4 | 7 | 21 | pickleball, pickle ball |
| clubhouse | Main Clubhouse | 4 | 60 | 9 | 23 | clubhouse, club house |
| basketball | Basketball Court | 1 | 10 | 7 | 21 | basketball, hoops |
| lounge | Lounge Meeting Room | 2 | 20 | 8 | 22 | lounge |
| conference | Conference Room | 2 | 10 | 8 | 22 | conference, meeting room |

`image` is `/assets/amenity-<id>.jpg`.

- [ ] **Step 1: Install dev dependencies and configure Vitest** as listed above. Run `pnpm install`. Expected: completes without errors.
- [ ] **Step 2: Write failing tests**

```ts
// dates.test.ts
const today = "2026-10-29";
test("toISODate uses local date", () => {
  expect(toISODate(new Date(2026, 9, 29, 23, 30))).toBe("2026-10-29");
});
test("addDays crosses months", () => expect(addDays("2026-10-31", 1)).toBe("2026-11-01"));
test("nextWeek is Mon–Sun of the following week", () =>
  expect(nextWeek(today)).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
test("nextWeek from a Sunday is the following Mon–Sun", () =>
  expect(nextWeek("2026-11-01")).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
test("window is today..today+60", () => {
  expect(lastBookable(today)).toBe("2026-12-28");
  expect(inWindow("2026-12-28", today)).toBe(true);
  expect(inWindow("2026-12-29", today)).toBe(false);
  expect(inWindow("2026-10-28", today)).toBe(false);
});
test("formatting", () => {
  expect(formatDayLong("2026-10-31")).toBe("Saturday, Oct 31");
  expect(formatDayShort("2026-10-31")).toEqual({ weekday: "Sat", day: "31", month: "Oct" });
  expect(formatHour(12)).toBe("12:00 PM");
  expect(formatHour(7)).toBe("7:00 AM");
  expect(formatRange(10, 1)).toBe("10:00 – 11:00 AM");
  expect(formatRange(11, 4)).toBe("11:00 AM – 3:00 PM");
});
// amenities.test.ts
test("six amenities in spec order", () =>
  expect(AMENITIES.map((a) => a.id)).toEqual(["tennis", "pickleball", "clubhouse", "basketball", "lounge", "conference"]));
test("clubhouse values", () =>
  expect(getAmenity("clubhouse")).toMatchObject({ name: "Main Clubhouse", hours: 4, maxGuests: 60, open: 9, close: 23 }));
```

- [ ] **Step 3: Run** `pnpm test`. Expected: FAIL (modules not found).
- [ ] **Step 4: Implement** `types.ts`, `amenities.ts` and `dates.ts`, and copy the six photos.
- [ ] **Step 5: Run** `pnpm test`, then `pnpm build`. Expected: all tests pass and the build succeeds.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Add booking types, amenity data, date helpers and Vitest"`

---

### Task 2: Mock availability

**Files:**
- Create: `src/booking/availability.ts`
- Test: `src/booking/__tests__/availability.test.ts`

**Interfaces:**
- Consumes: `Amenity`, `getAmenity`, `AMENITIES`, `Booking`, `ISODate`, `TimeOfDay`, and the date helpers from Task 1.
- Produces:
  - `startTimes(amenity: AmenityId): number[]`: hours from `open` to `close - hours`, inclusive.
  - `isMockTaken(amenity: AmenityId, date: ISODate, hour: number): boolean`: deterministic.
  - `isFullyBookedByMock(amenity: AmenityId, date: ISODate): boolean`: deterministic. Roughly 1 day in 8 per amenity.
  - `slotsFor(amenity, date, bookings: Booking[], now: Date, timeOfDay?: TimeOfDay): { hour: number; open: boolean }[]`
    - Omits starts already past when `date` is today (start hour ≤ the current hour counts as past).
    - Marks a start not open when it's mock-taken, the day is mock-fully-booked, or it overlaps any booking for the same amenity and date.
    - Filters by `timeOfDay` when given.
  - `hasOpenSlot(amenity, date, bookings, now): boolean`
  - `openSlotsInRange(amenity, range: DateRange, bookings, now): { date: ISODate; hours: number[] }[]`: only days with at least one open start, and only dates in the booking window.

Overlap rule: start `s` overlaps booking `b` when `s < b.time + hours && b.time < s + hours`.

The hash is the builder's choice (e.g. FNV-1a over `"${amenity}|${date}|${hour}"`), as long as it's stable across runs and the property tests below hold.

- [ ] **Step 1: Write failing tests**

```ts
const now = new Date(2026, 9, 29, 9, 0);
test("start times", () => {
  expect(startTimes("tennis")).toEqual([7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  expect(startTimes("clubhouse")).toEqual([9,10,11,12,13,14,15,16,17,18,19]);
});
test("deterministic", () =>
  expect(slotsFor("tennis", "2026-10-31", [], now)).toEqual(slotsFor("tennis", "2026-10-31", [], now)));
test("every amenity has a fully booked day and a partly booked day in the window", () => {
  for (const a of AMENITIES) {
    const days = Array.from({ length: 61 }, (_, i) => addDays("2026-10-29", i));
    expect(days.some((d) => isFullyBookedByMock(a.id, d))).toBe(true);
    expect(days.some((d) => { const s = slotsFor(a.id, d, [], now); return s.some((x) => x.open) && s.some((x) => !x.open); })).toBe(true);
  }
});
test("past starts on today are omitted", () =>
  expect(slotsFor("tennis", "2026-10-29", [], now).map((s) => s.hour)[0]).toBe(10));
test("hasOpenSlot is false late in the day", () =>
  expect(hasOpenSlot("tennis", "2026-10-29", [], new Date(2026, 9, 29, 20, 30))).toBe(false));
test("a 4-hour booking blocks overlapping starts only", () => {
  const b: Booking = { confirmation: "RS1", amenity: "clubhouse", date: "2026-11-03", time: 10, guests: 2 };
  const open = (h: number) => slotsFor("clubhouse", "2026-11-03", [b], now).find((s) => s.hour === h)!.open;
  for (const h of [10, 11, 12, 13]) expect(open(h)).toBe(false);
  // 9 overlaps (9–13 vs 10–14); 14 does not
  expect(open(9)).toBe(false);
  expect(open(14)).toBe(true);
});
test("timeOfDay filter", () =>
  expect(slotsFor("tennis", "2026-11-03", [], now, "evening").map((s) => s.hour)).toEqual([17,18,19,20]));
test("openSlotsInRange skips full days and clips to window", () => {
  const r = openSlotsInRange("tennis", { from: "2026-12-20", to: "2027-01-10" }, [], now);
  expect(r.every((d) => d.date <= "2026-12-28" && d.hours.length > 0)).toBe(true);
});
```

If the hash happens to mock-take Nov 3 starts used in the overlap test, pick a date where `isMockTaken` is false for 9–14, and say so in a test comment. The assertion must test the booking, not the mock.

- [ ] **Step 2: Run** `pnpm test availability`. Expected: FAIL.
- [ ] **Step 3: Implement** `availability.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "Add deterministic mock amenity availability"` (add the new files first).

---

### Task 3: Rules-based reader and the `interpret` swap point

**Files:**
- Create: `src/booking/rulesReader.ts`, `src/booking/interpret.ts`
- Test: `src/booking/__tests__/rulesReader.test.ts`

**Interfaces:**
- Consumes: `AMENITIES` aliases, date helpers, `Interpretation`, `ChatMessage`, `Draft`.
- Produces:
  - `parseMessage(text: string, today: ISODate): Interpretation`: sync, pure.
  - `type InterpretContext = { draft: Draft; today: ISODate; history: ChatMessage[] }`
  - `interpret(text: string, ctx: InterpretContext): Promise<Interpretation>`: v1 returns `Promise.resolve(parseMessage(text, ctx.today))`. A comment at the top states that a Claude-backed implementation replaces this function body (posting `text` + `ctx` to a server that holds the API key) and may set `reply`.

Rules. Matching is case-insensitive on the trimmed text.

**Amenity:**
- Match any alias as a whole word.
- "court" alone, with no other alias, sets `ambiguous: "court"`.
- When more than one alias matches, the first in `AMENITIES` order wins.

**Date:**
- `today`, `tomorrow`.
- A weekday name means its next occurrence on or after today.
- `this <weekday>` is the same as the bare weekday.
- `next <weekday>` means that weekday within `nextWeek(today)`.
- `this weekend` sets `range` to the coming Sat–Sun. On a Sunday, the range is that Sunday only.
- `next week` sets `range = nextWeek(today)`.
- Month-name dates: `nov 14` or `november 14`. `m/d` dates: `11/14`.
- `the 14th` (any ordinal suffix) means the next occurrence on or after today.
- A month and day earlier than today rolls to next year.
- Any resolved date outside the window sets `outOfWindow: true` and keeps the date.

**Time:**
- `10am`, `10 am`, `10:30 pm`, `noon` (12), `2pm`.
- A bare hour after `at` or `@` (e.g. "at 3"): 1–6 → PM, 7–11 → AM, 12 → noon.
- Minutes other than `:00` snap down to the hour and set `snappedFrom` to the original string (e.g. `"10:30 am"`).
- `morning` / `afternoon` / `evening` / `tonight` set `timeOfDay`. `tonight` also sets the date to today.

**Guests:** `for 3 people`, `3 guests`, `party of 3` set `guests`.

**Intent**, checked in this order:
1. `confirm` when the text is yes / yep / confirm / book it / looks good.
2. `listReservations` on "my reservations" / "my bookings".
3. `find` on find / show / when … available / availability / open times.
4. `changeAmenity` / `changeDay` / `changeTime` on "different|another|change|instead|actually" together with an amenity, a date or a time (in that precedence).
5. `book` when any slot, range or ambiguity was found, or on reserve / book.
6. `offTopic` on balance / ARC / violation / pool key.
7. Otherwise `unknown`.

- [ ] **Step 1: Write failing tests**, with `today = "2026-10-29"`:

```ts
const p = (t: string) => parseMessage(t, "2026-10-29");
test("amenity only", () => expect(p("I want to book the tennis court")).toMatchObject({ intent: "book", slots: { amenity: "tennis" } }));
test("everything at once", () =>
  expect(p("Saturday at 10am for tennis")).toMatchObject({ intent: "book", slots: { amenity: "tennis", date: "2026-10-31", time: 10 } }));
test("bare hours", () => {
  expect(p("saturday at 3").slots.time).toBe(15);
  expect(p("saturday at 9").slots.time).toBe(9);
  expect(p("at noon").slots.time).toBe(12);
});
test("snap half hours", () => expect(p("10:30 am")).toMatchObject({ slots: { time: 10 }, snappedFrom: "10:30 am" }));
test("next week range", () => expect(p("next week").range).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
test("find", () =>
  expect(p("find times next week when the tennis court is available")).toMatchObject({
    intent: "find", slots: { amenity: "tennis" }, range: { from: "2026-11-02", to: "2026-11-08" } }));
test("change amenity", () => expect(p("actually make it pickleball")).toMatchObject({ intent: "changeAmenity", slots: { amenity: "pickleball" } }));
test("court is ambiguous", () => expect(p("book a court")).toMatchObject({ intent: "book", ambiguous: "court" }));
test("dates", () => {
  expect(p("tomorrow").slots.date).toBe("2026-10-30");
  expect(p("thursday").slots.date).toBe("2026-10-29");
  expect(p("next friday").slots.date).toBe("2026-11-06");
  expect(p("nov 14").slots.date).toBe("2026-11-14");
  expect(p("11/14").slots.date).toBe("2026-11-14");
  expect(p("the 14th").slots.date).toBe("2026-11-14");
  expect(p("this weekend").range).toEqual({ from: "2026-10-31", to: "2026-11-01" });
});
test("out of window", () => expect(p("jan 5")).toMatchObject({ slots: { date: "2027-01-05" }, outOfWindow: true }));
test("time of day", () => expect(p("saturday evening").slots).toMatchObject({ date: "2026-10-31", timeOfDay: "evening" }));
test("guests", () => expect(p("tennis for 3 people").slots.guests).toBe(3));
test("confirm / list / off-topic / unknown", () => {
  expect(p("yes").intent).toBe("confirm");
  expect(p("show my reservations").intent).toBe("listReservations");
  expect(p("What is my current account balance?").intent).toBe("offTopic");
  expect(p("blorp").intent).toBe("unknown");
});
test("interpret resolves to parseMessage and never sets reply", async () => {
  const r = await interpret("tennis", { draft: { guests: 1 }, today: "2026-10-29", history: [] });
  expect(r).toEqual(p("tennis"));
  expect(r.reply).toBeUndefined();
});
```

- [ ] **Step 2: Run** `pnpm test rulesReader`. Expected: FAIL.
- [ ] **Step 3: Implement** `rulesReader.ts` and `interpret.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add rules-based reader behind async interpret()"`

---

### Task 4: Chat reducer

**Files:**
- Create: `src/booking/chatReducer.ts`
- Test: `src/booking/__tests__/chatReducer.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `initChat(now: Date): ChatState`: no messages, `draft = { guests: 1 }`, no bookings, `pending: false`, `nextId: 1`.
  - `chatReducer(state: ChatState, event: ChatEvent): ChatState`: pure.
  - `RESERVE_QUESTION = "Reserve an amenity for me"`
  - `COMMON_QUESTIONS: string[]`: `RESERVE_QUESTION` first, then the four existing questions from `AskHoaiPanel.tsx`.

**Core behaviour (`advance`, internal).** After every accepted event, the reducer:
- deactivates every existing message;
- appends a user echo when the event came from a tap. Echo text:
  - amenity: its name
  - date: `formatDayLong`
  - slot: `formatHour`
  - confirm: `"Confirm"`
  - change: `"Change"`
  - back chips: the chip label
- appends the agent prompt and widget for the first missing piece:
  1. `ambiguous === "court"`: "Which court would you like?" + `amenities`.
  2. No amenity: "Happy to help! Which amenity would you like to reserve?" + `amenities`.
  3. `draft.find && draft.range`: "Here are the open times for {name}:" + `slotList`. Clear `find` after showing.
  4. No date:
     - with `draft.range`: "What day works for you?" + `days { from: range.from, count: days in range }`;
     - else: "Great choice. What day works for you? Tap a day or type one, like “Saturday”." + `days { from: today, count: 14 }`.
  5. Date with no open slot: "{name} is fully booked on {formatDayLong}. Please pick another day." + `days`. Drop `date` and `time`.
  6. No time, or the time isn't open: if a time was typed but isn't open, prefix "{formatHour} isn't available." Then "Here are the open {hours}-hour slots for the {name} on {formatDayLong}:" + `slots`, followed by a `chips` message with `← Pick a different day` (back day) and `Change amenity` (back amenity). These two chips are in the same reply as `slots`, so both stay active together. Model this as one agent message with the `slots` widget plus a second agent message with `chips`, where **both stay active**. Deactivation runs only before appending.
  7. Otherwise: "Here's your reservation. Does this look right?" + `summary`.

**Event handling:**
- **`commonQuestion`:** echo the text.
  - `RESERVE_QUESTION` → advance.
  - Other questions → the off-topic canned reply.
- **`userText`:** echo the text and set `pending: true`. Nothing else.
- **`interpreted`:** set `pending: false`.
  - Use `result.reply` as the agent text when present (with the widget that `advance` would show).
  - **`unknown`:** not-understood reply, then re-append a copy of the last widget message (and its chips).
  - **`offTopic`:** the canned reply.
  - **`outOfWindow`:** the window reply + `days { from: today, count: 14 }`. Drop the date.
  - **`listReservations`:** `reservations`.
  - **`confirm`:** acts like `confirm` when a summary is active. Otherwise acts like `unknown`.
  - **Everything else:** merge the slots into the draft.
    - `changeAmenity` keeps date and time.
    - `changeDay` clears time.
    - A new `range` clears `date`.
    - `intent === "find"` sets `draft.find = true`. If there's no range, the range defaults to `{ from: today, to: today + 6 }`.
    - When `snappedFrom` is set, prefix "The closest start is {formatHour}." to the next agent text.
    - Then advance.
- **`interpretFailed`:** error reply + re-append the last widget. Set `pending: false`.
- **`pickAmenity`:** set the amenity. Clamp guests to `maxGuests`. Advance.
- **`pickDate`:** set the date. Clear time and range. Advance.
- **`openCalendar`:** append `calendar { month: first of the current month }` with no echo, keeping the strip message active too.
- **`calendarMonth`:** replace that calendar message's month **in place** (no new messages). Only allowed between the first of the current month and the month of `lastBookable`.
- **`pickSlot`:** set the date and time. Advance (shows the summary).
- **`setGuests`:** update the guests in the draft and in the active summary widget **in place**. Clamp to 1..maxGuests.
- **`confirm`:** create a booking with `confirmation = "RS" + 5 digits` (derived from `nextId` + the date so it's deterministic in tests), push it to `bookings`, and append "You're all set!" + `confirmation` + `chips` [`Book another amenity`, `View my reservations`]. Reset the draft to `{ guests: 1 }`.
- **`change`:** append `chips` [`Different time` → back time, `Different day` → back day, `Different amenity` → back amenity].
- **`back`:**
  - `time` clears time.
  - `day` clears date and time.
  - `amenity` clears the amenity, then re-checks the kept date and time against the new amenity on the next pick.
  - Then advance.
- **`bookAnother`:** reset the draft. Echo. Advance.
- **`listReservations`:** echo. Append "Here are your reservations:" + `reservations` (or "You don't have any reservations yet." when empty).
- **Inactive sources:** any event with `from` not matching an active message id returns `state` unchanged (same reference).

- [ ] **Step 1: Write failing tests.** Use `const s0 = initChat(new Date(2026, 9, 29, 9, 0))`, a helper `last(s)` returning the last message, and `activeWidgets(s)` returning the widgets of active messages.

```ts
test("reserve question shows amenity tiles", () => {
  const s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
  expect(s.messages[0]).toMatchObject({ role: "user", text: "Reserve an amenity for me" });
  expect(last(s).widget).toEqual({ kind: "amenities" });
});
test("tap path reaches summary then confirmation", () => {
  let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
  s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
  expect(last(s).widget).toEqual({ kind: "days", from: "2026-10-29", count: 14 });
  const day = /* first date in the strip where hasOpenSlot */;
  s = chatReducer(s, { type: "pickDate", date: day, from: last(s).id });
  const slotsMsg = s.messages.find((m) => m.active && m.widget?.kind === "slots")!;
  const hour = /* first open hour from slotsFor */;
  s = chatReducer(s, { type: "pickSlot", date: day, time: hour, from: slotsMsg.id });
  expect(last(s).widget).toMatchObject({ kind: "summary", amenity: "tennis", date: day, time: hour, guests: 1 });
  s = chatReducer(s, { type: "confirm", from: last(s).id });
  expect(s.bookings).toHaveLength(1);
  expect(s.bookings[0].confirmation).toMatch(/^RS\d{5}$/);
  expect(s.draft).toEqual({ guests: 1 });
});
test("events from inactive widgets are ignored", () => {
  /* reach summary as above, confirm, then dispatch confirm again with the old summary id */
  expect(after).toBe(before);
  expect(after.bookings).toHaveLength(1);
});
test("only the newest widget is active (slots + its chips together)", () => { /* after pickDate */
  expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
});
test("typed everything jumps to summary", () => {
  let s = chatReducer(s0, { type: "userText", text: "x" });
  expect(s.pending).toBe(true);
  s = chatReducer(s, { type: "interpreted", result: { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR } } });
  expect(s.pending).toBe(false);
  expect(last(s).widget?.kind).toBe("summary");
});
test("typed taken time says unavailable and shows slots", () => { /* time = a mock-taken hour */
  expect(agentTexts(s).at(-1)).toContain("isn't available");
});
test("typed today when no starts left", () => {
  const late = initChat(new Date(2026, 9, 29, 20, 30));
  /* interpreted: tennis + date 2026-10-29 */
  expect(text).toContain("fully booked on Thursday, Oct 29");
  expect(last(s).widget?.kind).toBe("days");
});
test("next week while strip showing adapts strip", () => { /* amenity set, interpreted range next week */
  expect(last(s).widget).toEqual({ kind: "days", from: "2026-11-02", count: 7 });
});
test("find shows slot list", () => {
  /* interpreted { intent: "find", slots: { amenity: "tennis" }, range: nextWeek } */
  expect(last(s).widget).toEqual({ kind: "slotList", amenity: "tennis", range: { from: "2026-11-02", to: "2026-11-08" } });
});
test("change amenity clamps guests and drops a full date", () => {
  /* draft clubhouse, date D where tennis isFullyBookedByMock, guests 30 → interpreted changeAmenity tennis */
  expect(s.draft.guests).toBe(4);
  expect(s.draft.date).toBeUndefined();
});
test("unknown re-shows current picker", () => { /* after amenities shown */
  expect(texts).toContain("Sorry, I didn't catch that. You can pick from the options below.");
  expect(last(s).widget).toEqual({ kind: "amenities" });
});
test("out of window", () => { expect(text).toBe("I can only book up to 60 days ahead."); });
test("snapped time is announced", () => { expect(text).toContain("The closest start is 10:00 AM"); });
test("setGuests updates summary in place and clamps", () => {
  /* summary for tennis; setGuests 9 */
  expect(last(s).widget).toMatchObject({ kind: "summary", guests: 4 });
  expect(s.messages.length).toBe(before.messages.length);
});
test("calendarMonth edits in place and respects bounds", () => { /* month beyond Dec 2026 ignored */ });
test("interpretFailed shows error and re-shows picker", () => {});
```

Pick `OPEN_DAY` / `OPEN_HOUR` / the full-day `D` in the tests by searching with the availability functions, not by hard-coding them. That keeps the tests valid whatever hash Task 2 chose.

- [ ] **Step 2: Run** `pnpm test chatReducer`. Expected: FAIL.
- [ ] **Step 3: Implement** `chatReducer.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add chat reducer for amenity booking flow"`

---

### Task 5: Widget components

**Files:**
- Create in `src/chat/widgets/`:
  - `AmenityGrid.tsx`, `DayStrip.tsx`, `MonthCalendar.tsx`, `SlotTiles.tsx`, `SlotList.tsx`
  - `SummaryCard.tsx`, `ConfirmationCard.tsx`, `ReservationList.tsx`, `ChipRow.tsx`
  - `WidgetView.tsx`
- Test: `src/chat/__tests__/widgets.test.tsx`

**Interfaces:**
- Consumes: `Widget`, `ChatEvent`, `Booking`, `getAmenity`, `AMENITIES`, availability, dates.
- Produces: `WidgetView({ message, state, dispatch }: { message: ChatMessage; state: ChatState; dispatch: (e: ChatEvent) => void }): JSX.Element`.
  - Switches on `message.widget.kind`.
  - Every dispatched event carries `from: message.id`.
  - The outer wrapper gets `opacity-50 pointer-events-none` and `aria-disabled="true"` when `!message.active`.
  - Each component renders the visual from the mockup (`.superpowers/brainstorm/26778-1793278524/content/reserve-flow-v3.html`, if present locally) using the colours in Global Constraints.

| Component | Renders | Dispatches |
| --- | --- | --- |
| `AmenityGrid` | 2-column grid of `AMENITIES`: photo `aspect-[16/10] object-cover`, name, `"{hours} hr · up to {maxGuests}"` | `pickAmenity` |
| `DayStrip` | `overflow-x-auto` row of `count` day tiles from `from` (weekday / day / month), each a `<button>` disabled when `!hasOpenSlot` or out of window; trailing **Pick another date** tile | `pickDate`, `openCalendar` |
| `MonthCalendar` | Month header with ‹ ›, S–S header row, day buttons; past, out-of-window and fully booked days disabled | `calendarMonth`, `pickDate` |
| `SlotTiles` | 3-column grid of `slotsFor(...)`: open = `<button>`, taken = disabled + `line-through` | `pickSlot` |
| `SlotList` | One block per day from `openSlotsInRange`: `formatDayLong` heading + slot buttons | `pickSlot` |
| `SummaryCard` | Photo, name, Date, Time (`formatRange`), Guests − / + stepper, note `"Up to {maxGuests} guests · free cancellation up to 24 hrs before"`, **Change** / **Confirm** buttons | `setGuests`, `change`, `confirm` |
| `ConfirmationCard` | Green card: "✓ Reservation confirmed", `name · Sat, Oct 31 · 10:00 – 11:00 AM · 2 guests`, `Confirmation #RS…` | none |
| `ReservationList` | One row per booking (same line as the confirmation) | none |
| `ChipRow` | Pill buttons | each chip's `event` with `from` replaced by `message.id` |

Widgets are indented 32px (`ml-8`) to sit under the agent avatar, matching the mockup.

- [ ] **Step 1: Write failing tests** with Testing Library. Build states with `initChat` + `chatReducer`, as in Task 4.

```tsx
test("amenity grid dispatches pickAmenity with message id", async () => {
  render(<WidgetView message={{ id: 7, role: "agent", widget: { kind: "amenities" }, active: true }} state={s} dispatch={spy} />);
  await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
  expect(spy).toHaveBeenCalledWith({ type: "pickAmenity", amenity: "tennis", from: 7 });
});
test("inactive widget is aria-disabled", () => { /* active: false */
  expect(container.firstChild).toHaveAttribute("aria-disabled", "true");
});
test("day strip disables full days and offers Pick another date", () => {
  /* strip from 2026-10-29 count 14 for an amenity with a known full day in range */
  expect(screen.getByRole("button", { name: /Pick another date/ })).toBeEnabled();
  expect(fullDayButton).toBeDisabled();
});
test("slot tiles disable taken slots", () => {});
test("summary stepper dispatches setGuests", async () => {});
test("calendar disables past days", () => { /* Oct 2026 view: Oct 28 disabled, Oct 29 enabled if open */ });
```

- [ ] **Step 2: Run** `pnpm test widgets`. Expected: FAIL.
- [ ] **Step 3: Implement** the components.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add booking chat widgets"`

---

### Task 6: Conversation mode in AskHoaiPanel

**Files:**
- Modify: `src/chat/AskHoaiPanel.tsx`
- Test: `src/chat/__tests__/AskHoaiPanel.test.tsx`

**Interfaces:**
- Consumes: `initChat`, `chatReducer`, `COMMON_QUESTIONS`, `interpret`, `WidgetView`, `toISODate`.
- Produces: no new exports. `AskHoaiPanel()` keeps its signature.

Changes:
- Replace the local `COMMON_QUESTIONS` with the import.
- `const [state, dispatch] = useReducer(chatReducer, new Date(), initChat)`.
- `hasConversation = state.messages.length > 0`.
- **Welcome screen** (no messages): unchanged layout. Tapping a common question dispatches `commonQuestion` (it no longer fills the input).
- **Conversation mode**, matching home-vision's `hasConversation` branch:
  - a scrolling thread (`flex-1 overflow-y-auto px-5 pt-6 pb-4 flex flex-col gap-3`);
  - the input box pinned below it (`mx-5 mb-5 border-2 border-[#247ae4] rounded-xl p-3`);
  - footer unchanged.
- **Messages:**
  - User text renders as a blue right-aligned bubble.
  - Agent text renders as a grey bubble with an `AskHoaiIcon` avatar (port `MessageBubble` from `../home-vision/src/chat/AskHoaiPanel.tsx`, without the attachment).
  - A widget message renders `WidgetView`.
- **Scroll:** a `useEffect` on `state.messages.length` sets `scrollTop = scrollHeight` (instant).
- **Send:**
  - Ignore blank input or `state.pending`.
  - Otherwise `dispatch({ type: "userText", text })`, clear the input, then `interpret(text, { draft: state.draft, today: toISODate(state.now), history: state.messages })`, and dispatch `interpreted` or, on rejection, `interpretFailed`.
  - Enter (without Shift) in the textarea sends.
  - The Send button and textarea are disabled while `pending`.
- Attach button stays visual only.

- [ ] **Step 1: Write failing tests**

```tsx
test("reserve question is first and starts the flow", async () => {
  render(<AskHoaiPanel />);
  const qs = screen.getAllByRole("button").filter((b) => b.textContent?.includes("?") || b.textContent?.includes("Reserve"));
  expect(qs[0]).toHaveTextContent("Reserve an amenity for me");
  await user.click(qs[0]);
  expect(screen.getByRole("button", { name: /Tennis Court/ })).toBeInTheDocument();
  expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
});
test("typing a full request reaches the summary", async () => {
  /* vi.setSystemTime(new Date(2026, 9, 29, 9, 0)); type "tennis on <OPEN_DAY as 'nov 3'> at <OPEN_HOUR>" + Enter */
  expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
});
test("blank input does not send", async () => { /* press Enter on empty textarea → still welcome screen */ });
test("interpret rejection shows the error reply", async () => {
  /* vi.spyOn(interpretModule, "interpret").mockRejectedValueOnce(new Error()) */
  expect(await screen.findByText("Something went wrong, please try again.")).toBeInTheDocument();
});
```

Set the clock with `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(...)` so promises still resolve. Choose the typed date and hour by searching availability, as in Task 4.

- [ ] **Step 2: Run** `pnpm test AskHoaiPanel`. Expected: FAIL.
- [ ] **Step 3: Implement** the panel changes.
- [ ] **Step 4: Run** `pnpm test` and `pnpm build`. Expected: all pass, build succeeds.
- [ ] **Step 5: Verify in the browser.**
  - Run `pnpm dev`, open the app at ≥1280px wide, and walk the tap path: Reserve → Tennis → a day → a time → + guest → Confirm → View my reservations.
  - Then type each example from the spec's table:
    - "I want to book the tennis court"
    - "Saturday at 10am for tennis"
    - "next week" while the strip shows
    - "find times next week when the tennis court is available"
    - "actually make it pickleball"
  - Expected: each behaves as the spec table says, no widget overflows the 400px panel, and old widgets are faded and can't be clicked.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Wire amenity booking flow into Ask HOAi panel"`
