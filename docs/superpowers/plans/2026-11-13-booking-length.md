# Booking Length Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Residents choose how long to book (30 minutes up to each amenity's limit, start time first) in both the Ask HOAi chat and the `/booking-link` page.

**Architecture:** One shared rule layer in `src/booking/` moves every time to minutes since midnight, marks the pretend calendar in half-hour blocks, and answers "which lengths fit from this start, and if not, why". The chat reducer gains a length step between time and summary, driven by `draft.minutes`; the booking link gains a fifth step driven by the same rule and a new `length` URL param. A new `LengthTiles` widget is shared by both flows.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind v4, Vitest 4 + Testing Library (jsdom), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-13-booking-length-design.md`

## Global Constraints

- All times are **minutes since midnight** (10:30 AM = 630). Opening hours (`Amenity.open`, `Amenity.close`) stay whole hours. Booking lengths are minutes.
- Limits (minutes): tennis 120, pickleball 120, clubhouse 360, basketball 120, lounge 240, conference 240. The old `hours` field is removed, not kept alongside.
- Lengths offered: 30, 60, 90 … up to the limit. Lengths above the limit are never listed.
- A start is open when its first half-hour block is free, it is later than now (today only), and it is at least 30 minutes before closing. A length fits when every block in it is free and it ends by closing (ending exactly at closing is fine).
- Copy, verbatim from the spec:
  - lengths `"30 min"`, `"1 hr"`, `"1½ hr"`, `"2 hr"`, `"2½ hr"` …; amenity tile `"Up to 2 hrs · up to 4 guests"`
  - disabled length reasons `"booked at 11:30"` (clock without AM/PM) and `"closes at 9:00 PM"`
  - chat: `"How long would you like the Tennis Court?"`, chip `"← Pick a different time"`, `"The Tennis Court can be booked for up to 2 hrs."`, `"1½ hr doesn't fit at 10:00 AM."`, `"Bookings go in 30-minute steps."`, `"Here are the open start times for the Tennis Court on Friday, Nov 20:"`, summary-change chip `"Different length"` listed first
  - link: step title `"How long?"`, `"Step N of 5"`, notes `"That length isn't available. Pick how long."` and `"1½ hr doesn't fit at that time. Pick how long."`
- Link format: `time=HH:MM` (24-hour, zero-padded, e.g. `07:00`, `10:30`), `length=` minutes. A bare hour (`time=10`) still reads as 10:00.
- Both flows must use the same functions from `src/booking/availability.ts` for "is this start open" and "does this length fit". No flow-local availability math.
- Test fixtures keep deriving days and times from the mock calendar (never hard-coded), as the existing tests do.
- **Suite state between tasks:** Task 1 changes shared types and function units, so test files not yet migrated fail until their owning task. Each task's gate is the test command its last step names. The whole suite and `pnpm exec tsc --noEmit` must be green at the end of Task 5 (chat side done) and Task 7 (everything).

## Review Focus

1. **"Now" at half-hour granularity.** At 9:10 today, 9:00 is gone and 9:30 is the first tennis start; at 9:00 exactly, 9:00 is gone too (as today). Pinned in Task 1.
2. **A length that ends exactly at closing.** Tennis from 8:00 PM: 30 min and 1 hr are offered, 1½ hr is disabled with "closes at 9:00 PM". Pinned in Task 1.
3. **A resident's own booking blocks its whole span**, not just its start: after booking 10:00 for 1½ hr, 11:00 is not an open start, 11:30 is, and from 9:00 the 1½ hr length says "booked at 10:00". Pinned in Task 1.
4. **A kept length meeting a smaller limit.** Typing "clubhouse for 5 hours", then switching to tennis, must not offer or book 5 hours: the note "The Tennis Court can be booked for up to 2 hrs." and the tiles. Pinned in Task 3.
5. **A link with `length` but no `time`.** `?amenity=tennis&date=…&length=60` opens on Pick a time with no note (the read stops at the first missing value, as today). Pinned in Task 6.

---

### Task 0: Commit the pending preview and transition work

The Mobile | Desktop toggle and the step transitions are uncommitted on `feature/booking-link`, and Task 7 edits the same page. Commit them first so the length work has a clean base.

- [ ] **Step 1: Verify and commit**

Run: `pnpm test 2>&1 | tail -5 && pnpm exec tsc --noEmit`
Expected: all tests pass, tsc prints nothing.

```bash
git add src/booking-link/BookingLinkPage.tsx src/booking-link/__tests__/BookingLinkPage.test.tsx src/index.css src/booking-link/DevicePreview.tsx src/booking-link/__tests__/DevicePreview.test.tsx
git commit -m "booking-link: Mobile | Desktop preview toggle and step transitions"
```

---

### Task 1: Shared rules in minutes, half-hour calendar, length rule

**Files:**
- Modify: `src/booking/types.ts`, `src/booking/amenities.ts`, `src/booking/dates.ts`, `src/booking/availability.ts`
- Test: `src/booking/__tests__/dates.test.ts`, `src/booking/__tests__/availability.test.ts`, `src/booking/__tests__/amenities.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `Amenity`: `hours` removed; `maxMinutes: number` added (the limit).
  - `Booking = { confirmation; amenity; date; time: number /* minutes */; minutes: number; guests }`
  - `Draft` gains `minutes?: number`; `Draft.time` is now minutes.
  - `ChangeTarget = "amenity" | "day" | "time" | "length"`; `Intent` gains `"changeLength"`.
  - `Interpretation.slots` gains `minutes?: number`; `snappedFrom` comment becomes "when the time was snapped down to the half-hour".
  - `Widget` gains `{ kind: "lengths"; amenity: AmenityId; date: ISODate; time: number }`; the `summary` widget gains `minutes: number`.
  - `BaseEvent` gains `{ type: "pickLength"; minutes: number; from: number }`.
- Produces (dates.ts) — `formatHour` is **removed** (its unit changed; a rename forces every caller to be revisited):
  - `formatTime(m: number): string` → `formatTime(630) === "10:30 AM"`, `formatTime(720) === "12:00 PM"`
  - `formatClock(m: number): string` → `"11:30"` (no AM/PM; used by "booked at")
  - `formatRange(start: number, minutes: number): string` → `formatRange(600, 90) === "10:00 – 11:30 AM"`, `formatRange(660, 240) === "11:00 AM – 3:00 PM"`, `formatRange(1320, 120) === "10:00 PM – 12:00 AM"`
  - `formatLength(minutes: number): string` → 30 `"30 min"`, 60 `"1 hr"`, 90 `"1½ hr"`, 120 `"2 hr"`, 150 `"2½ hr"`, 360 `"6 hr"`
  - `formatLimit(minutes: number): string` → 120 `"Up to 2 hrs"`, 360 `"Up to 6 hrs"`
- Produces (availability.ts):
  - `LENGTH_STEP = 30`
  - `startTimes(amenity): number[]` — every 30 minutes from `open*60` to `close*60 - 30`
  - `isMockTaken(amenity, date, minute): boolean` — one half-hour block
  - `isFullyBookedByMock(amenity, date)` — unchanged
  - `slotsFor(amenity, date, bookings, now, timeOfDay?): { time: number; open: boolean }[]` (field renamed `hour` → `time`)
  - `hasOpenSlot(...)` — unchanged signature
  - `openSlotsInRange(...): { date: ISODate; times: number[] }[]` (field renamed `hours` → `times`)
  - `type LengthOption = { minutes: number; ok: true } | { minutes: number; ok: false; reason: { kind: "booked"; at: number } | { kind: "closes"; at: number } }`
  - `lengthsFrom(amenity, date, time, bookings): LengthOption[]` — one entry per length 30…limit
  - `lengthFits(amenity, date, time, minutes, bookings): boolean` — false for a length that isn't a multiple of 30, is under 30 or over the limit
  - `lengthReason(r): string` → `"booked at 11:30"` / `"closes at 9:00 PM"`

- [ ] **Step 1: Write the failing tests**

`dates.test.ts`: replace the `formatHour`/`formatRange` cases with the `formatTime`, `formatClock`, `formatRange`, `formatLength`, `formatLimit` values listed above.

`amenities.test.ts`: add
```ts
test("limits", () =>
  expect(Object.fromEntries(AMENITIES.map((a) => [a.id, a.maxMinutes]))).toEqual({
    tennis: 120, pickleball: 120, clubhouse: 360, basketball: 120, lounge: 240, conference: 240,
  }));
```

`availability.test.ts` (rewrite, keeping each old test's intent; `now = new Date(2026, 9, 29, 9, 0)`):
- `start times`: `startTimes("tennis")` is `[420, 450, …, 1230]` (28 entries, last 8:30 PM); clubhouse starts at 540 and ends at 1350.
- `deterministic` — unchanged.
- `every amenity has a fully booked day and a partly booked day in the window` — unchanged intent.
- `every amenity has, in the window, an open start whose longest length is cut off by a booking`: some `d`, `t` with `slotsFor` open and `lengthsFrom(...).some(o => !o.ok && o.reason.kind === "booked")`.
- `past starts on today are omitted`: first start on today at 9:00 is 570; with `new Date(2026, 9, 29, 9, 10)` it is also 570 (Review Focus 1).
- `hasOpenSlot is false late in the day`: at 20:30, false; at 20:29, `slotsFor` returns only `[1230]` (open or not).
- `a length may end exactly at closing` (Review Focus 2): on a tennis day where blocks 1200, 1230 are free (search the window), `lengthsFrom("tennis", d, 1200, [])` is `[{minutes:30,ok:true},{minutes:60,ok:true},{minutes:90,ok:false,reason:{kind:"closes",at:1260}},{minutes:120,ok:false,reason:{kind:"closes",at:1260}}]`.
- `a taken block cuts lengths off, and the earlier obstacle wins`: on a searched tennis day/start where the block at `t+60` is taken and `t`, `t+30` are free, lengths 30, 60 ok; 90 and 120 `{kind:"booked", at: t+60}`.
- `a booking blocks its whole span` (Review Focus 3): on a clubhouse day with blocks 540–720 all free (search), booking `{time: 600, minutes: 90}`: starts 600, 630, 660 not open, 690 open; `lengthsFrom("clubhouse", d, 540, [b])[1]` is `{minutes:60, ok:false, reason:{kind:"booked", at:600}}` and `[0]` is ok.
- `lengthFits` rejects 45, 0, 150 for tennis; accepts 60 where `lengthsFrom` says ok.
- `lengthReason`: `{kind:"booked",at:690}` → `"booked at 11:30"`; `{kind:"closes",at:1260}` → `"closes at 9:00 PM"`.
- `timeOfDay filter`: evening tennis starts are `[1020, 1050, …, 1230]`.
- `openSlotsInRange skips full days and clips to window` — same, using `times`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/booking/__tests__/dates.test.ts src/booking/__tests__/availability.test.ts src/booking/__tests__/amenities.test.ts`
Expected: FAIL (missing exports `formatTime`, `lengthsFrom`, `maxMinutes`).

- [ ] **Step 3: Implement** the types, amenities (`make(id, name, maxMinutes, …)`), dates and availability listed in Interfaces.

Mock density: `isMockTaken` hashes `${amenity}|${date}|${minute}`; choose the modulus (start with `% 6 === 0`) so the "partly booked" and "cut off by a booking" tests pass and a typical day still has several open starts. Own bookings block `[b.time, b.time + b.minutes)`. For a length from `t`, the obstacle is the earlier of the first taken block at or after `t` and `close*60`; the length is ok when `t + minutes <=` that obstacle, otherwise its reason is that obstacle (`booked` if it's a block, `closes` if closing).

- [ ] **Step 4: Run to verify they pass**

Run: same command as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/booking/types.ts src/booking/amenities.ts src/booking/dates.ts src/booking/availability.ts src/booking/__tests__/dates.test.ts src/booking/__tests__/availability.test.ts src/booking/__tests__/amenities.test.ts
git commit -m "booking: times in minutes, half-hour calendar, per-amenity length limit and length rule"
```

---

### Task 2: Rules reader — half-hour times, lengths, length changes

**Files:**
- Modify: `src/booking/rulesReader.ts`
- Test: `src/booking/__tests__/rulesReader.test.ts`

**Interfaces:**
- Consumes: `ChangeTarget` with `"length"`, `Intent` with `"changeLength"`, `slots.minutes` (Task 1).
- Produces: `parseMessage` returns `slots.time` in minutes and `slots.minutes` when a length is typed. The reader does **not** validate lengths (45 stays 45); the reducer does.

- [ ] **Step 1: Write the failing tests** (update existing time expectations to minutes; `p` as in the file)

```ts
test("times are minutes; half-hours are exact", () => {
  expect(p("saturday at 3").slots.time).toBe(900);
  expect(p("at noon").slots.time).toBe(720);
  expect(p("10:30 am")).toEqual({ intent: "book", slots: { time: 630 } });
  expect(p("10:30")).toEqual({ intent: "book", slots: { time: 630 } });
});
test("other minutes snap down to the half-hour", () => {
  expect(p("10:15 am")).toMatchObject({ slots: { time: 600 }, snappedFrom: "10:15 am" });
  expect(p("at 2:45")).toMatchObject({ slots: { time: 870 }, snappedFrom: "at 2:45" });
});
test("lengths", () => {
  const len = (t: string) => p(t).slots.minutes;
  expect(len("for 90 minutes")).toBe(90);
  expect(len("90 mins")).toBe(90);
  expect(len("for 2 hours")).toBe(120);
  expect(len("2 hrs")).toBe(120);
  expect(len("1.5 hours")).toBe(90);
  expect(len("an hour")).toBe(60);
  expect(len("half an hour")).toBe(30);
  expect(len("an hour and a half")).toBe(90);
  expect(len("2 hours and a half")).toBe(150);
  expect(len("45 minutes")).toBe(45);
  expect(len("1 hour 15")).toBe(75);
  expect(len("tennis")).toBeUndefined();
});
test("a length with a time and a day", () =>
  expect(p("tennis friday at 10 for 90 minutes")).toMatchObject({
    intent: "book", slots: { amenity: "tennis", date: "2026-10-30", time: 600, minutes: 90 } }));
test("a length alone is a booking turn", () => expect(p("for 2 hours").intent).toBe("book"));
test("length doesn't read as a time or guests", () => {
  expect(p("for 2 hours").slots.time).toBeUndefined();
  expect(p("for 2 hours").slots.guests).toBeUndefined();
});
test("change the length", () => {
  for (const t of ["change the length", "different length", "longer", "shorter", "can it be longer"])
    expect(p(t)).toMatchObject({ intent: "changeLength", changeTarget: "length" });
  expect(p("actually 2 hours")).toMatchObject({ intent: "changeLength", slots: { minutes: 120 } });
  expect(p("actually 2 hours").changeTarget).toBeUndefined();
});
test("go back from a full draft steps back from length", () =>
  expect(parseMessage("go back", "2026-10-29", { guests: 1, amenity: "tennis", date: "2026-10-30", time: 600, minutes: 60 }).changeTarget).toBe("length"));
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/booking/__tests__/rulesReader.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement in `rulesReader.ts`**

- `readTime` returns minutes; `snap` keeps `:00`/`:30` exact and floors other minutes to the half-hour with `snappedFrom`.
- `readLength(text): number | undefined` covering the phrases in the test. Order: "half an hour", "N hours and a half" / "an hour and a half", "N(.N) hours|hrs [and] M [minutes]" (a trailing bare number is minutes unless followed by `am|pm|:`), "an hour", "N minutes|mins". Hours are rounded to whole minutes.
- `STEP_RE` gains `length`; `/\b(?:longer|shorter)\b/` is a length change target when no length is given. `CHANGE_RE` with `slots.minutes` (and no amenity/date/time) gives `"changeLength"`. `CHANGE_INTENT.length = "changeLength"`.
- `lastStep(draft)` returns `"length"` when `draft.minutes` and `draft.time` are both set.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/booking/__tests__/rulesReader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/booking/rulesReader.ts src/booking/__tests__/rulesReader.test.ts
git commit -m "rules reader: half-hour times, typed lengths, length change requests"
```

---

### Task 3: Chat reducer — the length step

**Files:**
- Modify: `src/booking/chatReducer.ts`
- Test: `src/booking/__tests__/chatReducer.test.ts`, `src/booking/__tests__/conversations.test.ts`

**Interfaces:**
- Consumes: Task 1 (`slotsFor` `.time`, `lengthFits`, `formatTime`, `formatLength`, `formatLimit`, `LENGTH_STEP`, `getAmenity().maxMinutes`), Task 2 (`slots.minutes`, `changeTarget: "length"`).
- Produces: the `lengths` widget message and `pickLength` handling; `summary` widget carries `minutes`; `Booking.minutes` set on confirm. `confirmationNumber(nextId, date, time)` is unchanged in signature (time is now minutes).

Behavior to build (spec "The chat"):
- In `prompt`, after an open start time: if `draft.minutes` is undefined → `"How long would you like the <name>?"` with `{ kind: "lengths", amenity, date, time }`, followed by a chips message with only `chip("← Pick a different time", { type: "back", to: "time", from: 0 })`.
- If `draft.minutes` is set, check in this order and on failure drop `minutes`, push the note, and show the same length prompt:
  1. not a multiple of 30 or under 30 → `"Bookings go in 30-minute steps."`
  2. over the limit → `"The <name> can be booked for up to <N> hrs."` (`formatLimit(max).replace("Up to", "up to")`)
  3. `!lengthFits(...)` → `"<formatLength(m)> doesn't fit at <formatTime(time)>."`
  Otherwise go to the summary with `minutes`.
- Time-tiles text: `"Here are the open start times for the <name> on <day>:"`; with a time-of-day filter `"Here are the open <timeOfDay> start times for the <name> on <day>:"`. Taken-time note becomes `"<formatTime(t)> isn't available."`; snapped note `"The closest start is <formatTime(t)>."`.
- `backDraft(draft, "length")` drops only `minutes`. `"time"`, `"day"` and `"amenity"` keep `minutes` (it is re-checked later).
- `onInterpreted`: copy `s.minutes` into the draft.
- `pickLength` tap (source kinds `["lengths"]`): echo `formatLength(minutes)`, set `draft.minutes`, `advance`.
- `pickSlot` echo uses `formatTime`.
- `change` chips: `Different length`, `Different time`, `Different day`, `Different amenity`, in that order. `BACK_LABELS.length = "Different length"`.
- `confirm` copies `minutes` from the summary widget into the booking.

- [ ] **Step 1: Update existing tests and write the new ones**

Update fixtures to minutes (`openHour` → `openTime`, `.hour` → `.time`, `formatHour` → `formatTime`), the "1-hour slots" wording to "start times", and `toSummary()` to tap a length (first `ok` option from `lengthsFrom`) after the time. The tap-path test now expects, after `pickSlot`: echo `formatTime(OPEN_TIME)`, `"How long would you like the Tennis Court?"` with `{ kind: "lengths", amenity: "tennis", date: OPEN_DAY, time: OPEN_TIME }`, then the `← Pick a different time` chip; after `pickLength` 60: echo `"1 hr"`, summary `toMatchObject({ minutes: 60, time: OPEN_TIME })`, and the confirmed booking has `minutes: 60`.

New tests in `chatReducer.test.ts` (`describe("length")`):
- `typed time and length that fit skip the length step`: typed `{ amenity:"tennis", date, time, minutes }` where `lengthFits` → last widget is `summary` with that `minutes`.
- `a length that doesn't fit shows tiles with a note`: pick a searched start where `lengthsFrom` has a `booked` option `m` → last agent text `"<formatLength(m)> doesn't fit at <formatTime(t)>. How long would you like the Tennis Court?"`, widget `lengths`, `draft.minutes` undefined.
- `over the limit`: typed `minutes: 180` for tennis → text starts `"The Tennis Court can be booked for up to 2 hrs."`.
- `not a half-hour step`: typed `minutes: 45` → text starts `"Bookings go in 30-minute steps."`.
- `a length typed before a time is held`: typed `{ amenity:"tennis", minutes: 60 }` → day prompt; tap a day; tap an open time where 60 fits → summary with `minutes: 60` (no length step).
- `the change menu lists Different length first`, and tapping it shows the `lengths` widget with `draft.time` kept.
- `changing the time keeps the length and re-checks it`: from summary, chip Different time, tap a start where the kept length fits → summary directly; where it doesn't → the doesn't-fit note and tiles.
- `pickLength from an inactive widget is ignored`.

New tests in `conversations.test.ts` (typed turns through the real reader via `say`):
- `"tennis <day> at <t> for 1 hour"` with a fitting start reaches the summary in one turn.
- `"for 45 minutes"` on the length step → `"Bookings go in 30-minute steps."` and tiles.
- **Review Focus 4:** `say(s0, "clubhouse for 5 hours")`, tap a day, `say("actually tennis")`, tap a day, tap an open start → last text starts `"The Tennis Court can be booked for up to 2 hrs."` and widget is `lengths`; no summary with `minutes: 300` ever appears.
- `"go back"` on the summary returns to the length tiles.
- `"find times next week for tennis"` lists half-hour starts (some `:30` time appears in the `slotList` data via `openSlotsInRange(...).times`); tapping one echoes `"<day> at <formatTime(t)>"` and shows the length tiles.
- `"10:15"` typed on the time step → `"The closest start is 10:00 AM."` (when 10:00 is open on the searched day).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/booking/__tests__/chatReducer.test.ts src/booking/__tests__/conversations.test.ts`
Expected: FAIL (no `lengths` widget, old wording).

- [ ] **Step 3: Implement the behavior above in `chatReducer.ts`.**

- [ ] **Step 4: Run to verify they pass**

Run: same command as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/booking/chatReducer.ts src/booking/__tests__/chatReducer.test.ts src/booking/__tests__/conversations.test.ts
git commit -m "chat: choose how long after the start time"
```

---

### Task 4: Widgets — LengthTiles and minutes everywhere

**Files:**
- Create: `src/chat/widgets/LengthTiles.tsx`
- Modify: `src/chat/widgets/WidgetView.tsx`, `AmenityGrid.tsx`, `SlotTiles.tsx`, `SlotList.tsx`, `SummaryCard.tsx`, `ConfirmationCard.tsx`
- Test: `src/chat/__tests__/widgets.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`lengthsFrom`, `lengthReason`, formatters), Task 3 (`lengths` widget shape, `pickLength`).
- Produces:
  - `LengthTiles({ amenity, date, time, state, dispatch }: { amenity: AmenityId; date: ISODate; time: number; state: ChatState; dispatch: (e: ChatEvent) => void })` — one full-width button per `lengthsFrom` option, length on the left and `formatRange(time, m)` (or `lengthReason`) on the right; disabled when `!ok`; `aria-label` is `"<formatLength>, <range or reason>"`, e.g. `"1½ hr, 10:00 – 11:30 AM"`, `"2 hr, booked at 11:30"`; click dispatches `{ type: "pickLength", minutes, from: 0 }`. Style from the option A mockup (`.superpowers/brainstorm/30151-1794583663/content/length-picker.html`, `.len` / `.len.off`) in the existing slot-tile colors.
  - `SummaryCard({ amenity, date, time, minutes, dispatch })` — Time row `formatRange(time, minutes)`, new `Length` row `formatLength(minutes)` after it.
  - `bookingLine(b)` uses `formatRange(b.time, b.minutes)`.

- [ ] **Step 1: Write the failing tests** (update existing ones to minutes; `booking` fixture gets `time: 600, minutes: 90`)

- `amenity tiles read the limit · up to N guests`: Tennis `"Up to 2 hrs · up to 4 guests"`, Main Clubhouse `"Up to 6 hrs · up to 60 guests"`.
- `slot tiles show half-hour starts`: on a searched open day, a button named `formatTime(t)` exists for a `:30` start.
- `length tiles`: on a searched tennis day/start with a booked cut-off, buttons named `"30 min, <range>"` enabled; the cut-off one named `"<len>, booked at <formatClock(at)>"` disabled; no button for lengths over 120; clicking `"1 hr, …"` dispatches `{ type: "pickLength", minutes: 60, from: 7 }`.
- `summary shows range and length`: widget `{ kind:"summary", amenity:"tennis", date, time: 600, minutes: 90, guests: 1 }` shows `"10:00 – 11:30 AM"` and a `Length` row `"1½ hr"`.
- `confirmation line uses the booked length`: text contains `"10:00 – 11:30 AM"`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/chat/__tests__/widgets.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the widget changes above and route `lengths` in `WidgetView`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/chat/__tests__/widgets.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/chat/widgets src/chat/__tests__/widgets.test.tsx
git commit -m "chat widgets: length tiles, half-hour starts, real ranges"
```

---

### Task 5: Chat panel end to end, chat side green

**Files:**
- Test: `src/chat/__tests__/AskHoaiPanel.test.tsx`
- Modify: anything still failing tsc on the chat side (no behavior beyond Tasks 1–4)

- [ ] **Step 1: Update the panel test** fixtures to minutes (`openHourOn` → open start in minutes via `slotsFor`), typed text `"tennis on nov N at <formatTime(t)>"`, and add: after the typed turn, the length tiles appear; clicking the first enabled length tile shows the summary with a `Length` row.

- [ ] **Step 2: Run** `pnpm vitest run src/chat` — Expected: PASS after any fixture fixes.

- [ ] **Step 3: Chat-side gate**

Run: `pnpm vitest run src/booking src/chat && pnpm exec tsc --noEmit 2>&1 | grep -v "src/booking-link" | head`
Expected: tests PASS; no tsc errors outside `src/booking-link` (those belong to Tasks 6–7).

- [ ] **Step 4: Commit**

```bash
git add src/chat
git commit -m "chat: panel test covers the length step"
```

---

### Task 6: Link parsing with `HH:MM` and `length`

**Files:**
- Modify: `src/booking-link/link.ts`
- Test: `src/booking-link/__tests__/link.test.ts`

**Interfaces:**
- Consumes: Task 1 (`slotsFor`, `lengthFits`, `LENGTH_STEP`, `getAmenity().maxMinutes`, `formatTime`, `formatLength`).
- Produces:
  - `Step = "amenity" | "date" | "time" | "length" | "review"`
  - `LinkDraft = { amenity?; date?; time?: number /* minutes */; minutes?: number }`
  - `DropNote` gains `{ reason: "lengthInvalid" }` and `{ reason: "lengthDoesntFit"; minutes: number }`; `timeTaken`/`timeUnavailable` carry minutes.
  - `parseLink`, `toSearch`, `stepOf`, `stepBack`, `noteText` — same signatures.

Rules:
- `time`: `^\d{1,2}$` (hour ≤ 23) → `h*60`; `^\d{1,2}:\d{2}$` (hour ≤ 23, minutes ≤ 59) → `h*60+m`; anything else → `timeInvalid`. A parsed time not on the half-hour, or not among `slotsFor` starts → `timeUnavailable`; a listed but taken start → `timeTaken`.
- `length` (only read once time is good): empty → stop (length step). Not `^\d+$`, not a multiple of 30, under 30, or over the limit → `lengthInvalid`. Valid but `!lengthFits` → `lengthDoesntFit`.
- `toSearch` writes `time` as zero-padded `HH:MM` and `length` as minutes.
- `stepOf`: time set and `minutes` undefined → `"length"`. `stepBack` clears the last of minutes → time → date → amenity (clearing time also clears minutes).
- Notes: `lengthInvalid` → `"That length isn't available. Pick how long."`; `lengthDoesntFit` → `` `${formatLength(m)} doesn't fit at that time. Pick how long.` ``; time notes use `formatTime`.

- [ ] **Step 1: Write the failing tests** (fixtures move to minutes: `OPEN_TIME`, `TAKEN_TIME` from `startTimes` + `isMockTaken`; a `FIT` length and a `CUT` length found with `lengthsFrom` on `OPEN_DAY`/`OPEN_TIME`)

- `HH:MM and bare hours`: `time=10:30` → `time: 630` (on a day where 630 is open); `time=10` → `600` where open; `time=07:00` → `420`.
- `off-half-hour time`: `time=10:15` → note `{ reason: "timeUnavailable", time: 615 }`, `noteText` `"10:15 AM isn't available that day. Pick another time."`.
- `unreadable times`: `10am`, `10.5`, `24`, `25`, `10:5`, `10:60` → `timeInvalid`.
- `length`: `length=<FIT>` → draft has `minutes`; no `length` → `stepOf` is `"length"`.
- `bad lengths`: `45`, `0`, `150` (tennis), `abc`, `-30` → `{ reason: "lengthInvalid" }`, draft keeps amenity/date/time.
- `length that doesn't fit`: `length=<CUT>` → `{ reason: "lengthDoesntFit", minutes: CUT }`, text `` `${formatLength(CUT)} doesn't fit at that time. Pick how long.` ``.
- **Review Focus 5:** `?amenity=tennis&date=<OPEN_DAY>&length=60` → `{ draft: { amenity, date } }`, no note.
- `toSearch` round trip: `toSearch("t", { amenity:"tennis", date, time: 420, minutes: 90 })` is `?token=t&amenity=tennis&date=<date>&time=07%3A00&length=90` and `parseLink` of it returns the same draft (when open and fitting — use fixtures).
- `stepBack` from review clears only `minutes`; from length clears `time`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/booking-link/__tests__/link.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the rules above in `link.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/booking-link/__tests__/link.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/booking-link/link.ts src/booking-link/__tests__/link.test.ts
git commit -m "booking-link: read and write time as HH:MM and the booking length"
```

---

### Task 7: Booking link page — the "How long?" step

**Files:**
- Modify: `src/booking-link/BookingLinkPage.tsx`
- Test: `src/booking-link/__tests__/BookingLinkPage.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`LengthTiles`, `SummaryCard` with `minutes`), Task 6 (`Step` with `"length"`, `LinkDraft.minutes`).

Changes:
- `STEPS` gains `length: { n: 4, title: "How long?" }`; review becomes `n: 5`; the done screen's order is 6. Label `"Step {n} of 5"`; progress bar has 5 segments.
- Context row: on `time`, `"<formatDayLong(date)> · <formatLimit(max) lower-cased>"` (e.g. `"Friday, Nov 20 · up to 2 hrs"`); on `length`, `"<formatDayLong(date)> · starts <formatTime(time)>"`.
- `onWidget`: `pickSlot` → `go({ amenity, date, time })` (no minutes: the link's steps each clear their own value); `pickLength` → `go({ ...draft, minutes })`; `change` → `go(stepBack(draft))` (review → How long).
- `confirm` requires `minutes` and writes it into the `Booking`.
- Render `<LengthTiles amenity date time state={widgetState} dispatch={onWidget} />` on the length step and pass `minutes` to `SummaryCard`.

- [ ] **Step 1: Update existing tests and write the new ones**

Fixtures: `OPEN_TIME` in minutes, `FIT` length from `lengthsFrom`; `REVIEW_LINK` adds `&time=<HH:MM>&length=<FIT>`; time buttons are found by `formatTime(OPEN_TIME)`; every `"Step N of 4"` becomes `of 5`.
- `full flow by tapping` now goes amenity → date → time → `heading("How long?")` with `"Step 4 of 5"` and the text `` `starts ${formatTime(OPEN_TIME)}` `` → click the `FIT` length tile (`/^<formatLength(FIT)>,/`) → review shows the `Length` row → Confirm → confirmation line contains `formatRange(OPEN_TIME, FIT)`.
- `a link without length opens on How long?` and the address bar reads `…&time=<HH:MM>` with no `length`.
- `Back from How long returns to Pick a time` and `Change on review returns to How long?` (address bar loses `length`).
- `a length note`: link with `length=45` shows `"That length isn't available. Pick how long."` on the How long step.
- `phone back from review lands on How long?` (popstate re-parses the URL without `length`).
- `the progress bar has five segments`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/booking-link/__tests__/BookingLinkPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the page changes above.

- [ ] **Step 4: Run to verify they pass, then the whole gate**

Run: `pnpm vitest run src/booking-link && pnpm test 2>&1 | tail -5 && pnpm exec tsc --noEmit`
Expected: all tests pass; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/booking-link
git commit -m "booking-link: How long? step between time and review"
```
