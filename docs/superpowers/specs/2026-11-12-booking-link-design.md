# Booking link (`/booking-link`): design

Date: 2026-11-12. Status: draft, awaiting the user's review.

## Why

Residents don't always reach us through the web chat. A voice agent (on a call) or an SMS agent (by text) can learn part of what a resident wants, such as "tennis on Friday", but booking by voice or by text is clumsy. Instead the agent texts the resident a link. The link opens a small, tap-only booking page in the app, already advanced as far as the agent got. The resident finishes with a few taps.

The tap flow already exists in the Ask HOAi chat (`docs/superpowers/specs/2026-10-29-amenity-booking-chat-design.md`). This page reuses that flow without the chat around it.

## Goals

- A mobile-first page at `/booking-link`, opened from a link texted by a voice or SMS agent.
- The same tappable flow as the chat: amenity cards → date → time slots → review and confirm → confirmation card.
- The link carries whatever the agent already knows, and the page opens at the first step that is still missing.
- The resident can always step back and change anything the agent filled in.

## Non-goals (for now)

- Real sign-in. The link is a magic link in concept, but nothing validates it yet (see "Link format").
- Real bookings. Confirming pretends, exactly as the chat does: a made-up confirmation number, kept only while the page is open.
- The agent side: generating or sending links, voice or SMS integration.
- Hosting. This is a local demo, run on the Vite dev server (the user's decision). No hosting config or production fallback for `/booking-link`.
- Viewing or cancelling existing reservations.
- Guest count. The summary card no longer has a guest stepper, and this page doesn't either.
- Typing or free text of any kind.

## Anti-goals

- It must not look or behave like a chat: no message thread, no input box, no agent bubbles.
- It must not book anything without the resident tapping Confirm, even when the link fills in every value.
- The page and the chat must never disagree about availability, the booking window or booking lengths, so the rules can't be copied into this page.

## Decided with the user

- **Layout: one step per screen** (option A in the mockups, `.superpowers/brainstorm/83393-1794541245/content/booking-link-layout.html`). The rejected option B was a single page with finished steps folded into rows.
- **Simplified app UI.** The magic link lands the resident in the app, but without the portal: no sidebar, no dashboard, no Ask HOAi panel.
- **Deep-linking.** As much as the agent knows advances the flow to that stage.
- **Pretend bookings,** the same as the chat.

## The page

### Frame

- A slim header: the HOA logo mark, "Reserve an amenity", and a line with the HOA name and "Hi, <first name>". Both are placeholders until real sign-in exists (Claude's call: "Maple Ridge HOA" / "Jordan", kept in one constant).
- Below the header: a four-segment progress bar, a "‹ Back" link (hidden on the first step), a small "Step N of 4" label, and the step title.
- A "Powered by HOAi" footer, as in the chat panel.
- Phone-first. On wider screens it stays a single column at phone width (about 420–480px), centred. Claude's call.

### Steps

1. **Amenity.** Title "Choose an amenity". The six photo cards in two columns, each showing name, booking length and guest limit (the chat's `AmenityGrid` content). Tapping one goes to step 2.
2. **Date.** Title "Pick a date". A small context row shows the chosen amenity (thumbnail + name). Below it, the chat's 14-day strip, where days with no open slots are disabled, plus "Pick another date", which shows the month calendar in place of the strip. Tapping a day goes to step 3.
3. **Time.** Title "Pick a time". The context row shows amenity, date and booking length. Below it are the slot tiles, with taken hours greyed and struck through. Tapping an open hour goes to step 4.
4. **Review & confirm.** Title "Review your reservation". The chat's summary card, with Confirm. The card's "Change" button goes back one step, to the times (Claude's call; Back and the progress bar cover jumping further).

After Confirm, the page shows a **done** screen with no progress bar and no Back. It shows the existing confirmation card ("✓ Reservation confirmed", the booking line, a confirmation number), a line saying "You can close this page.", and a "Book something else" button that starts again at step 1. The pretend booking stays in page memory, so booking the same slot again shows it as taken, as in the chat.

### Back behaviour

- "‹ Back" goes to the previous step and clears that step's value and everything after it. From Review it goes to Time with no time picked. From Time it goes to Date with no date picked, keeping the amenity (Claude's call). Nothing in the flow needs a "selected" state, so the chat's widgets can be used as they are.
- The URL query always holds exactly the values chosen so far (`amenity`, `date`, `time`, plus `token`). Reading the URL uses the same rules as an incoming link, so a reload lands on the same step.
- Every step change pushes a history entry, and the page listens for `popstate`, so the phone's back button retraces the steps the resident actually took during this visit (Claude's call; no router library). The page doesn't invent history for steps the link skipped. Phone back from the step the link opened on leaves the page, normally back to the text message. The in-page "‹ Back" link always works, including on steps the link filled in, so if the agent guessed wrong, one tap fixes it.
- On Confirm, the page replaces the current history entry with a clean `/booking-link?token=…` URL and shows the done screen (Claude's call). That means phone back can't return to a Review screen for a slot that's now taken, and reloading the done screen starts fresh at Amenity, since pretend bookings live only in page memory. "Book something else" pushes the same clean URL.

### Sizing

Tap targets must be comfortable on a phone: at least 44px tall for slot tiles, day tiles and buttons, and larger text than the chat's 12.5px. The widgets keep their look (colors, borders, photos) but are allowed bigger sizes on this page.

## Link format

`/booking-link?token=<t>&amenity=<id>&date=<YYYY-MM-DD>&time=<hour>`

- `token`: the magic-link credential. For now it is accepted and ignored. A missing `token` still shows the page (Claude's call; there is no real sign-in to enforce it yet). It is kept on the URL as the page updates it.
- `amenity`: an `AmenityId` (`tennis`, `pickleball`, `clubhouse`, `basketball`, `lounge`, `conference`).
- `date`: a local date, `YYYY-MM-DD`.
- `time`: a start hour, 0–23 (e.g. `10` for 10 AM).

The page reads these in order and stops at the first one that is missing or can't be used. Everything after that point is dropped:

| Link carries | Opens on |
|---|---|
| nothing, or a bad `amenity` | Amenity |
| valid `amenity` | Date |
| + `date` that's in the booking window and has an open slot | Time |
| + `time` that's an open start hour that day | Review & confirm |

"Can't be used" means: an unknown amenity id; a malformed date, one outside the booking window (today through 60 days out), or a day with no open slots for that amenity; a time that isn't a start hour for that amenity, is already past, or is taken.

When a value is dropped, the step it falls back to shows one line explaining why, above the choices (Claude's call on wording):

- unknown amenity: "We couldn't find that amenity. Pick one below."
- bad date: "That date isn't available. Pick another day."
- bad time: "<time> is taken that day. Pick another time." (or "isn't available" when it's past or not a start hour)
- unreadable time (e.g. `10am`, `25`): "That time isn't available. Pick another time." (added after the final review)

The note goes away after the resident's next tap.

A date without an amenity is ignored, and so is a time without a date.

## Building on what exists

- **Rules:** all availability, window and formatting comes from `src/booking/` (`availability.ts`, `dates.ts`, `amenities.ts`), the same as the chat. Nothing is duplicated.
- **Widgets:** reuse `src/chat/widgets/` (amenity grid, day strip, month calendar, slot tiles, summary card, confirmation card). These currently take the chat's `ChatState` and dispatch `ChatEvent`s. How to let this page use them, whether a thin adapter, loosening their props, or a size variant, is left to the builder, as long as the chat's behaviour and tests don't change.
- **Confirmation numbers:** made the same way as in the chat, so they look the same.
- **Routing:** there's no router in the app. `main.tsx`/`App.tsx` choose this page when `location.pathname` is `/booking-link`, and the portal otherwise (Claude's call; no new dependency). The Vite dev server already falls back to `index.html` for unknown paths.

## Left to the builder

- Component and file structure (e.g. `src/booking-link/`).
- Whether page state is a small reducer or plain state, and how it shares the chat's pretend-booking logic.
- Exact spacing and type sizes, within the sizing rule above.
- Tests: link parsing (each fallback row and each drop reason), step navigation including the browser back button, the done screen, and "Book something else". The chat's existing tests must still pass.
