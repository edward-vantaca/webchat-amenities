# Booking Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tap-only, one-step-per-screen booking page at `/booking-link` that opens at the furthest step its query parameters allow, reusing the chat's booking rules and widgets.

**Architecture:** Pure link logic (parse, validate, serialize, step back) lives in `src/booking-link/link.ts`. `BookingLinkPage.tsx` holds page state and renders the chat's existing widgets through a thin adapter: a synthetic `ChatState` going in, and `ChatEvent`s mapped to page actions coming out. The chat widgets themselves don't change. The URL is kept in sync with `history.pushState`/`popstate`, and `main.tsx` picks the page by `location.pathname`. There is no router.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-12-booking-link-design.md`

## Global Constraints

- No new dependencies. In particular, no router library.
- Nothing under `src/chat/` changes behaviour. All existing tests must still pass (`pnpm test`). The one allowed change outside `src/booking-link/` in `src/booking/` is exporting `confirmationNumber`.
- All availability, booking-window and formatting rules come from `src/booking/` (`availability.ts`, `dates.ts`, `amenities.ts`). Nothing is copied.
- Bookings are pretend: they're held in page memory only, and the confirmation number is made by the chat's `confirmationNumber`.
- No typing or free text anywhere on the page. Nothing books without a tap on Confirm.
- Copy (exact): header "Reserve an amenity", "Maple Ridge HOA · Hi, Jordan" (one constant), "Step N of 4", "‹ Back", titles "Choose an amenity" / "Pick a date" / "Pick a time" / "Review your reservation", "You can close this page.", "Book something else", footer "Powered by HOAi".
- Drop notes (exact): "We couldn't find that amenity. Pick one below." / "That date isn't available. Pick another day." / "<formatHour(time)> is taken that day. Pick another time." / "<formatHour(time)> isn't available that day. Pick another time."
- Tap targets of at least 44px on this page. The page is a single column, max width 480px, centred.
- Local demo only (Vite dev server). No hosting config.

## Review Focus

1. **Malformed link values** such as `date=2026-02-30`, `date=11/14`, `time=10am`, `time=10.5` or `amenity=Tennis` must be handled as drops with the right note (or, for an uppercase id, accepted), never crash. Test: Task 1, "malformed values".
2. **A link opened late**, after its `time` has passed today, must fall back to Time with the "isn't available" note. Test: Task 1, "past hour today".
3. **Phone back onto a step whose slot the resident just booked**, after Confirm, must reparse that history entry and land on Time with the "is taken" note. Test: Task 3, "back after confirm".
4. **The `token` must survive** every step change, Confirm, and "Book something else". Test: Task 3, "token kept".
5. **A trailing slash** (`/booking-link/`) must still open the page, and any other path must open the portal. Test: Task 3, "route match".

---

### Task 1: Link logic

**Files:**
- Create: `src/booking-link/link.ts`
- Test: `src/booking-link/__tests__/link.test.ts`

**Interfaces:**
- Consumes: `AMENITIES`, `getAmenity` (`@/booking/amenities`); `slotsFor`, `hasOpenSlot`, `startTimes` (`@/booking/availability`); `inWindow`, `toISODate`, `fromISODate`, `formatHour` (`@/booking/dates`); `AmenityId`, `Booking`, `ISODate` (`@/booking/types`).
- Produces:
  ```ts
  export type Step = "amenity" | "date" | "time" | "review";
  export type LinkDraft = { amenity?: AmenityId; date?: ISODate; time?: number };
  export type DropNote =
    | { reason: "amenity" } | { reason: "date" }
    | { reason: "timeTaken"; time: number } | { reason: "timeUnavailable"; time: number };
  export type ParsedLink = { token?: string; draft: LinkDraft; note?: DropNote };
  export function parseLink(search: string, bookings: Booking[], now: Date): ParsedLink;
  export function toSearch(token: string | undefined, draft: LinkDraft): string; // "" or "?token=…&amenity=…&date=…&time=…", in that order, absent keys omitted
  export function stepOf(draft: LinkDraft): Step;
  export function stepBack(draft: LinkDraft): LinkDraft; // clears the last defined of time → date → amenity
  export function noteText(note: DropNote): string;
  ```

- [ ] **Step 1: Write the failing tests**

Freeze the clock as the chat tests do: `vi.useFakeTimers({ toFake: ["Date"] })` with `vi.setSystemTime(new Date(2026, 10, 12, 9, 0))`. Pass `new Date()` as `now`. Derive fixtures from the mock calendar rather than hard-coding them:
`OPEN_DAY` is a tennis day within 14 days that `!isFullyBookedByMock` and has an untaken start; `OPEN_HOUR` is an untaken start that day; `TAKEN_HOUR` is a taken start that day (pick a day that has both); `FULL_DAY` is a day where `isFullyBookedByMock("tennis", d)`.

| test | input `search` | expected |
|---|---|---|
| empty | `""` | `{ draft: {} }`, `stepOf` → `"amenity"`, no note |
| amenity only | `?token=abc&amenity=tennis` | `{ token: "abc", draft: { amenity: "tennis" } }`, step `"date"` |
| amenity + date | `&date=OPEN_DAY` | step `"time"` |
| full link | `+&time=OPEN_HOUR` | step `"review"`, no note |
| unknown amenity | `?amenity=squash&date=OPEN_DAY` | `draft: {}`, note `{reason:"amenity"}`; date also dropped |
| date out of window | `date=2027-03-01` (more than 60 days out) and `date=2026-11-11` (yesterday) | `draft: {amenity}`, note `{reason:"date"}` |
| fully booked day | `date=FULL_DAY` | note `{reason:"date"}` |
| taken hour | `time=TAKEN_HOUR` | `draft: {amenity, date}`, note `{reason:"timeTaken", time: TAKEN_HOUR}` |
| booked by me | `time=OPEN_HOUR` with `bookings` holding tennis/OPEN_DAY/OPEN_HOUR | note `{reason:"timeTaken"}` |
| not a start hour | `time=22` for tennis (closes 21) | note `{reason:"timeUnavailable", time: 22}` |
| past hour today | `date=2026-11-12&time=8` (clock 9:00) | note `{reason:"timeUnavailable", time: 8}` (pick a `date` of today that has open later slots) |
| orphans | `?date=OPEN_DAY&time=10` (no amenity); `?amenity=tennis&time=10` (no date) | orphan values ignored, **no** note |
| malformed values | `date=2026-02-30` and `date=11/14` → note `{reason:"date"}`. `time=10am`, `time=10.5` and `time=` → treated as absent: draft `{amenity, date}`, no note. `amenity=Tennis` → accepted as `"tennis"`. |
| toSearch | `toSearch("abc", {amenity:"tennis", date:"2026-11-14", time: 10})` | `"?token=abc&amenity=tennis&date=2026-11-14&time=10"`; `toSearch(undefined, {})` → `""` |
| round trip | for each full/partial draft, `parseLink(toSearch(t, d), [], now).draft` equals `d` | |
| stepBack | `{a,d,t}` → `{a,d}`; `{a,d}` → `{a}`; `{a}` → `{}`; `{}` → `{}` | |
| noteText | each reason → the exact Global Constraints copy, e.g. `noteText({reason:"timeTaken", time:10})` → `"10:00 AM is taken that day. Pick another time."` | |

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run src/booking-link/__tests__/link.test.ts`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `link.ts`**

Validate a date strictly: it must match `^\d{4}-\d{2}-\d{2}$` and give back the same string through `toISODate(fromISODate(s))`. It must also pass `inWindow(s, toISODate(now))` and `hasOpenSlot(amenity, s, bookings, now)`. A time must match `^\d{1,2}$`, otherwise it counts as absent. An integer time must be in `slotsFor(...)` with `open` true. When it's listed but not open, the reason is `timeTaken`. When it isn't listed (not a start hour, or past), the reason is `timeUnavailable`. Lower-case `amenity` before checking it against `AMENITIES`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run src/booking-link/__tests__/link.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/booking-link
git commit -m "booking-link: parse, validate and serialize link params"
```

---

### Task 2: The page and its steps

**Files:**
- Create: `src/booking-link/BookingLinkPage.tsx`
- Modify: `src/booking/chatReducer.ts`: export `confirmationNumber` (signature unchanged: `(nextId: number, date: ISODate, time: number) => string`)
- Modify: `src/index.css`: add a scoped `.booking-link` block
- Test: `src/booking-link/__tests__/BookingLinkPage.test.tsx`

**Interfaces:**
- Consumes: everything Task 1 produces; `initChat`, `confirmationNumber` (`@/booking/chatReducer`); `AmenityGrid`, `DayStrip`, `MonthCalendar`, `SlotTiles`, `SummaryCard`, `ConfirmationCard` (`@/chat/widgets/*`); `AskHoaiIcon` (`@/chat/AskHoaiPanel`); `getAmenity`, `formatDayLong`, `formatRange`.
- Produces: `export default function BookingLinkPage(): JSX.Element`. It reads `window.location.search` once on mount. This task keeps all state local; Task 3 adds URL sync.

Page state: `{ token?: string; draft: LinkDraft; note?: DropNote; bookings: Booking[]; calendarMonth?: ISODate; done?: Booking }`. The widgets receive `{ ...initChat(now), bookings, draft: { guests: 1, amenity: draft.amenity } }`. Their events map to actions:

| widget event | page action |
|---|---|
| `pickAmenity` | `draft = { amenity }` |
| `pickDate` | `draft = { amenity, date }`, clear `calendarMonth` |
| `openCalendar` | `calendarMonth = first of today's month` |
| `calendarMonth` | `calendarMonth = e.month` |
| `pickSlot` | `draft = { amenity, date, time }` |
| `change` (summary card) | `draft = stepBack(draft)` (goes to Time) |
| `confirm` | build `Booking` (`guests: 1`, number from `confirmationNumber(bookings.length + 1, date, time)`), append it to `bookings`, set `done`, set `draft = {}` |

Every action clears `note`. "‹ Back" sets `draft = stepBack(draft)` and clears `calendarMonth`. "Book something else" clears `done`.

Layout: the root is `<div className="booking-link …">`, a single column with `max-w-[480px] mx-auto`. It contains a header (`AskHoaiIcon`, "Reserve an amenity", "Maple Ridge HOA · Hi, Jordan"), a progress bar with four segments where the first `N` are filled (`aria-hidden`), "‹ Back" (a button, hidden on step 1 and on the done screen), "Step N of 4", an `<h1>` title, the note (`role="status"`) when one exists, a context row on Date (amenity thumbnail + name) and on Time (amenity, `formatDayLong(date)`, `${hours} hr`), the step's widget, and the footer. The done screen shows `ConfirmationCard`, "You can close this page." and a "Book something else" button, with no progress bar, step label or Back. The date step shows the 14-day `DayStrip` (from today) unless `calendarMonth` is set, in which case it shows `MonthCalendar`.

`index.css`: inside `.booking-link`, give `button` a `min-height: 44px`, and scale the widget wrapper (`.booking-link .bl-widget { zoom: 1.15; }`) so the chat's 12.5px text reads at about 14px. Nothing outside `.booking-link` changes.

- [ ] **Step 1: Write the failing tests**

Freeze the clock as in Task 1, and derive `OPEN_DAY` / `OPEN_HOUR` the same way. Before each render, set the URL with `window.history.replaceState(null, "", "/booking-link" + search)`.

- `opens on amenities with no params`: `getByRole("heading", { name: "Choose an amenity" })`, "Step 1 of 4", 6 amenity buttons, no "‹ Back" button, and "Maple Ridge HOA · Hi, Jordan" visible.
- `full flow by tapping`: tap "Tennis Court" → heading "Pick a date". Tap the day labelled `formatDayLong(OPEN_DAY)` → heading "Pick a time", with the context row showing "Tennis Court" and `formatDayLong(OPEN_DAY)`. Tap `formatHour(OPEN_HOUR)` → heading "Review your reservation". Tap "Confirm" → "✓ Reservation confirmed", text matching `/Confirmation #RS\d{5}/`, "You can close this page.", and no "‹ Back".
- `deep link opens on review`: `?token=t&amenity=tennis&date=OPEN_DAY&time=OPEN_HOUR` shows heading "Review your reservation" and "Step 4 of 4".
- `back from a link-filled step`: the same link, then tap "‹ Back" → heading "Pick a time". Tap "‹ Back" again → "Pick a date". Again → "Choose an amenity".
- `summary Change goes to times`: from the review deep link, tap "Change" → "Pick a time".
- `drop note shows then clears`: `?amenity=squash` shows a status reading "We couldn't find that amenity. Pick one below." Tapping "Tennis Court" makes `queryByRole("status")` return null.
- `pick another date shows the calendar`: on the date step, tap "Pick another date" → the "Next month" button is visible; tapping a calendar day goes to "Pick a time".
- `book something else`: after Confirm, tap "Book something else" → "Choose an amenity". Rebooking tennis on `OPEN_DAY` shows the `OPEN_HOUR` tile as disabled.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run src/booking-link/__tests__/BookingLinkPage.test.tsx`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Export `confirmationNumber` and implement `BookingLinkPage.tsx` plus the `.booking-link` CSS block**

- [ ] **Step 4: Run the whole suite and confirm it passes**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: every test passes, including the chat's, and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/booking-link src/booking/chatReducer.ts src/index.css
git commit -m "booking-link: one-step-per-screen page reusing chat widgets"
```

---

### Task 3: URL sync, phone back, and the route

**Files:**
- Modify: `src/booking-link/BookingLinkPage.tsx`
- Modify: `src/main.tsx`: render `BookingLinkPage` when `isBookingLinkPath(location.pathname)`, otherwise `App`
- Modify: `src/booking-link/link.ts`: add `isBookingLinkPath`
- Test: `src/booking-link/__tests__/BookingLinkPage.test.tsx`, `src/booking-link/__tests__/link.test.ts`

**Interfaces:**
- Consumes: `parseLink`, `toSearch`, `stepOf` (Task 1); `BookingLinkPage` (Task 2).
- Produces: `export function isBookingLinkPath(pathname: string): boolean`, true for `/booking-link` and `/booking-link/` only.

Behaviour (from the spec's "Back behaviour"):
- Every action that changes `draft` to a different step runs `history.pushState(null, "", "/booking-link" + toSearch(token, draft))`. Opening or closing the calendar and clearing a note don't push.
- On load, the page doesn't push. It replaces the entry with the normalized URL (`replaceState`), so dropped values leave the address bar.
- `popstate` → `parseLink(location.search, bookings, now)`. The page takes its `draft` and `note`, clears `done` and `calendarMonth`, and doesn't push.
- Confirm runs `replaceState` with `"/booking-link" + toSearch(token, {})`. "Book something else" pushes the same URL.

- [ ] **Step 1: Write the failing tests**

- `route match` (link.test.ts): `isBookingLinkPath` returns true for `"/booking-link"` and `"/booking-link/"`, and false for `"/"`, `"/booking-links"` and `"/booking-link/x"`.
- `address bar follows taps`: start at `?token=t`, tap "Tennis Court", and `window.location.search` becomes `"?token=t&amenity=tennis"`. Tap a day and it gains `&date=OPEN_DAY`.
- `normalizes on load`: start at `?token=t&amenity=squash&date=OPEN_DAY`, and after render `window.location.search === "?token=t"`.
- `phone back retraces taps`: start at `?token=t`, tap "Tennis Court", tap the day, then `act(() => window.history.back())` → `await findByRole("heading", { name: "Pick a date" })`. Back again → "Choose an amenity".
- `back after confirm`: start at `?token=t&amenity=tennis`, tap the day, tap `OPEN_HOUR`, tap "Confirm". `window.location.search === "?token=t"`. Then `history.back()` lands on the `…&date=OPEN_DAY` entry → heading "Pick a time", and the `OPEN_HOUR` tile is disabled.
- `token kept`: through tapping, Confirm and "Book something else", every observed `window.location.search` starts with `"?token=t"`.

(jsdom fires `popstate` asynchronously after `history.back()`, so await the heading with `findBy…`.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run src/booking-link`
Expected: the new tests FAIL. `isBookingLinkPath` isn't exported, and the URL doesn't change.

- [ ] **Step 3: Implement the history sync in `BookingLinkPage.tsx`, `isBookingLinkPath`, and the switch in `main.tsx`**

- [ ] **Step 4: Run the whole suite and confirm it passes**

Run: `pnpm test && pnpm build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 5: Check it by hand on a phone-sized screen**

Run `pnpm dev`. Open `/booking-link?token=t&amenity=tennis` in a browser at 390px wide and tap through to the confirmation. Check that buttons are comfortably tappable, nothing scrolls sideways except the day strip, and `/` still shows the portal with the chat.

- [ ] **Step 6: Commit**

```bash
git add src/booking-link src/main.tsx
git commit -m "booking-link: URL sync, phone back, and route"
```
