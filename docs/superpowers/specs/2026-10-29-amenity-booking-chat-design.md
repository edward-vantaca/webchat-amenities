# Amenity booking in the Ask HOAi chat: design

Date: 2026-10-29
Status: ready for approval
Mockups: `.superpowers/brainstorm/26778-1793278524/content/reserve-flow-v3.html` (git-ignored; local only)

## Intent

Ask HOAi is the chat panel on the right of the resident portal (`src/chat/AskHoaiPanel.tsx`). This app is a React product to be sold later. The first real task the chat handles is **reserving an amenity**.

The chat should feel clickable rather than typed. At every step the resident can just tap tiles. But typing has to work at any point too: a resident who already knows what they want can say so, and the chat fills in what it understood and asks only for what's missing.

## Goals

- A resident can reserve an amenity end to end without typing a single character.
- A resident can type at any point, and what they type is applied to the booking in progress: amenity, day, time, or a request to change one of them.
- The chat always shows the right picker for whatever is still missing.
- The text understanding sits behind one replaceable interface, so a Claude-backed version can take over later without touching the UI.

## Non-goals (this version)

- No AI or LLM, and no API key. Text understanding is rules-based for now. (The user expects to add a Claude API key later.)
- No backend. Amenities and availability are mock data generated in the browser, and bookings live in memory only (they don't survive a reload).
- No other chat topics. The other common questions stay as they are and get a generic "I can help you reserve an amenity" reply when sent.
- No cancelling or editing a reservation after it's confirmed.
- No sidebar navigation or other dashboard changes.
- No animations or transitions. This matches the rest of the app (the user removed them on purpose).

## Anti-goals (would count as failure even if it works)

- The resident gets stuck: a dead end with no tiles and no way back.
- Typed input that was understood gets ignored, or the chat re-asks for something the resident already said.
- An old picker higher up in the conversation can still be tapped and silently changes the booking.
- Building this means rewriting the chat UI later to add AI.

## The flow (tap path)

Each step adds messages to the conversation. Nothing rewinds or rewrites earlier messages.

1. **Welcome.** "Reserve an amenity for me" is added as the **first** common question. Tapping a common question sends it straight away (today it only fills the input box). The other questions stay.
2. **Pick an amenity.** The agent replies "Happy to help! Which amenity would you like to reserve?" above a 2-column grid of six photo tiles. Each tile shows the photo, the name, and "booking length · up to N guests". The amenities are the six from home-vision's `BOOKABLE_AMENITIES` (`../home-vision/src/App.tsx` ~line 3211), copied in with their photos:
   - Tennis Court: 1 hr, up to 4 guests, 7 AM–9 PM
   - Pickleball Court: 1 hr, up to 4 guests, 7 AM–9 PM
   - Main Clubhouse: 4 hr, up to 60 guests, 9 AM–11 PM
   - Basketball Court: 1 hr, up to 10 guests, 7 AM–9 PM
   - Lounge Meeting Room: 2 hr, up to 20 guests, 8 AM–10 PM
   - Conference Room: 2 hr, up to 10 guests, 8 AM–10 PM
3. **Pick a day.** The agent asks what day works ("Tap a day or type one, like 'Saturday'"). Below that is a **sideways-scrolling strip of 14 day tiles** starting today (weekday / date / month). Days with no open slots are greyed out and can't be tapped. The strip ends with a **"Pick another date"** tile, which adds an **inline month calendar** to the chat (‹ › to change month). Past dates and fully booked dates are disabled.
4. **Pick a time.** The agent lists the open start times for that amenity and day as **tiles, 3 per row**. Taken slots are shown struck through and can't be tapped. Below the tiles are two chips: **"← Pick a different day"** and **"Change amenity"**.
5. **Review.** A **summary card** shows the amenity photo, name, date, time range (start + booking length), a **guest count with − / + buttons** (default 1, max = amenity's limit), a cancellation note, and **Change** / **Confirm** buttons. *Change* shows chips for "Different time", "Different day" and "Different amenity".
6. **Booked.** Tapping Confirm adds a green **"Reservation confirmed"** card: amenity · date · time · guests, plus a generated confirmation number (e.g. `RS48213`). Under it are two chips: **"Book another amenity"** (starts the flow again at step 2) and **"View my reservations"** (lists this session's confirmed bookings in the chat).

Each tap is echoed as the resident's own message bubble, like "Tennis Court" or "Saturday, Oct 31", so the conversation reads naturally.

### Panel layout once a conversation starts

This follows home-vision's own `AskHoaiPanel` conversation mode (`../home-vision/src/chat/AskHoaiPanel.tsx`, the `hasConversation` branch):

- The welcome heading and common questions go away after the first message.
- The message thread fills the scroll area, and the input box (same bordered style) is pinned at the bottom above the "Powered by HOAi" footer.
- The thread scrolls to the newest message whenever one is added. The scroll is instant, with no animation.
- Agent message bubbles use the `AskHoaiIcon` avatar and user bubbles are blue and right-aligned, matching home-vision's `MessageBubble`.
- Agent replies wait behind a typing indicator (three bouncing dots in an agent bubble) for 0.5–1.4 s depending on reply length; the resident's own messages appear immediately and the input is disabled until the reply shows. (Added after the first build at the user's request; the dots are the one animation in the panel and stop under reduced-motion.)

### Time slots and booking length

- Start times are on the hour, from opening time to the last start that still ends by closing time. For example, the Clubhouse (4 hr, 9 AM–11 PM) has starts from 9 AM to 7 PM.
- Starts can overlap. A booking blocks every start whose time range overlaps it: a 10 AM–2 PM Clubhouse booking blocks the 9 AM through 1 PM starts (9 AM is the earliest start, since the Clubhouse opens at 9).
- On today's date, start times that have already passed aren't shown.
- A typed time that isn't on the hour (e.g. "10:30") snaps to the nearest earlier start, and the reply says so ("The closest start is 10:00 AM").

### Booking window

Residents can book from today up to **60 days ahead**. The calendar's › stops at the month holding the last bookable day. A typed date outside the window gets "I can only book up to 60 days ahead" plus the day strip. There are no holiday closures in v1, so the mockup's Thanksgiving note is dropped.

### Going back

Back chips work by adding to the conversation. For example, "Pick a different day" adds the resident's message, an agent reply, and a fresh day strip at the bottom. **Only the latest picker is live.** Every earlier picker (tiles, strip, calendar, slots, summary buttons) is shown faded and can't be tapped.

## Typed input (slot filling)

The chat keeps a **booking draft** with three slots: `amenity`, `date`, `time` (plus `guests` once the summary is up). After every resident message, whether a tap or typed text, the chat:

1. works out what the message means (the intent) and any slot values it contains;
2. merges them into the draft (new values replace old ones);
3. shows the picker for the **first missing slot**, in the order amenity → date → time. Once all three are filled, it shows the summary card.

Behaviours the user asked for specifically:

| Resident types | Result |
| --- | --- |
| "I want to book the tennis court" | Amenity filled → asks for the day (strip). |
| "Saturday at 10am for tennis" | All filled → summary card, if 10 AM is open. If it isn't, says so and shows that day's open slots. |
| "next week" (while the day strip is showing) | The strip shows next week's 7 days (Mon–Sun). |
| "find times next week when the tennis court is available" | A **list of open slots grouped by day** for that range, each slot a tile; tapping one fills date + time. |
| "actually make it pickleball" (mid-flow) | Swaps the amenity, keeps the date. Re-checks the time against the new amenity and drops it if it's no longer open. |

Typing a day or time while a picker is showing does the same as tapping the matching tile.

**Not understood:** reply "Sorry, I didn't catch that. You can pick from the options below." and show the current picker again. Never leave a dead end.

### What the rules-based reader must understand (v1)

- **Amenities:** names and obvious short forms (tennis, pickleball, clubhouse, basketball/hoops, lounge, conference/meeting room). Case doesn't matter. "court" alone is ambiguous: ask which court.
- **Dates:** today, tomorrow, weekday names (next occurrence), "this/next <weekday>", "this weekend", "next week", "Nov 14" / "November 14" / "11/14", "the 14th".
- **Times:** "10", "10am", "10:30 am", "2pm", "noon", plus morning / afternoon / evening as ranges (used to filter the slot tiles).
- **Intents:** start a booking, set or change a slot, find availability ("find / show / when … available"), go back / change, confirm, list my reservations.

## Architecture (the parts decided)

- **Swappable reader.** One **async** function decides what a message means:
  `interpret(text, { draft, today, history }) → Promise<{ intent, slots, range?, reply? }>`.
  - v1 is a rules-based module that resolves immediately and never sets `reply`.
  - Later, a Claude-backed version (through a small server that holds the key) implements the same signature. It gets the conversation so far in `history`, and it can return its own `reply` text, for example to answer off-topic questions. When `reply` is set, the chat shows it instead of the built-in wording.
  - The chat already handles a pending state (input disabled while waiting) and an error reply ("Something went wrong, please try again" plus the current picker), so adding a network call later needs no UI changes.
  - Nothing else in the chat depends on how the reader works.
- **Chat state** is a list of messages. A message is either text or a widget (amenity grid, day strip, calendar, slots, slot list, summary, confirmation), and widgets are marked active or inactive. A reducer (`useReducer`) handles events (a tile tap or text submitted), updates the draft and appends messages.
- **Mock availability** is generated by a deterministic function of amenity + date, so the same day always shows the same taken slots. Some days come out fully booked, so the greyed-out state can be seen. Confirmed bookings are taken out of availability.
- Same stack and styling conventions as the existing app: React 19, Tailwind v4, inline Tailwind classes, DM Sans faces, `lucide-react` icons.

## Constraints

- Panel width is 400px (shown at the `lg` breakpoint and up). All widgets must fit that width. The day strip scrolls sideways inside it.
- "Today" comes from the real clock, so the strip always starts at the current date.

## Calls Claude made (not discussed with the user)

- Guest count stepper, the cancellation note text, and the two follow-up chips after booking.
- Faded and non-tappable is how old pickers are shown as inactive.
- A typed time that's taken leads to "not available" plus that day's open slots.
- "next week" means Monday–Sunday of the following week.
- Other common questions get a single canned reply.
- Bookings are in memory only.
- Panel conversation layout copies home-vision's conversation mode (input pinned at the bottom, welcome screen goes away, instant scroll to the newest message, no typing delay).
- Hourly start times with overlapping bookings blocking each other; off-hour typed times snap to the earlier hour.
- 60-day booking window, no holiday closures.
- The reader is async, receives the conversation history, and may return reply text, so Claude can drop in later.

## Left to the builder

- File and component breakdown, and naming.
- The confirmation number format, beyond "short and readable".
- Exact agent message wording, as long as it matches the examples above in tone.
- The pseudo-random formula for mock availability, as long as it's deterministic and includes some fully booked days.
- Test approach (the stack used Vitest + Testing Library in home-vision). The reader and the reducer should have unit tests.
