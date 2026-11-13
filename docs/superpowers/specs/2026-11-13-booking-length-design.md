# Booking length: design

Date: 2026-11-13. Status: draft, awaiting the user's review.

## Why

Today every amenity books for one fixed length: tennis is always 1 hour and the clubhouse always 4. Real amenities don't work that way. A resident chooses how long they want, up to the amenity's **block limit**. Both booking flows, the Ask HOAi chat and the `/booking-link` page, need to let them choose.

## Decided with the user

- **Block limits.** Each amenity has its own longest allowed booking. Tennis is 2 hours and the clubhouse 6 hours (made-up values are fine for now).
- **The minimum is 30 minutes** for every amenity.
- **Order: start time first, then how long.**
- **Layout: length is its own step** (option A in `.superpowers/brainstorm/30151-1794583663/content/length-picker.html`). After the time, a "How long?" screen lists each length with its end time. The rejected options were length chips under the time grid (B) and a length control on the review card (C).
- **Both flows change the same way.**

## Goals

- Residents pick how long to book, in 30-minute steps from 30 minutes up to the amenity's limit.
- They are only offered lengths that are actually free: no overlap with another booking and no running past closing.
- The chosen length shows everywhere the booking does: summary card, confirmation card and reservations list.

## Non-goals

- Real availability or limits from an API. Everything stays in the pretend data, as today.
- Per-resident rules (weekly caps, member tiers), buffers between bookings, or pricing by length.
- Changing guest handling.

## Anti-goals

- Offering a length that then fails, or that silently books shorter than chosen.
- The chat and the booking link disagreeing about which lengths are free. Both must use one shared rule in `src/booking/`.

## The rules (shared, `src/booking/`)

- **Limits** (Claude's call for the four the user didn't name): Tennis Court 2 hrs, Pickleball Court 2 hrs, Main Clubhouse 6 hrs, Basketball Court 2 hrs, Lounge Meeting Room 4 hrs, Conference Room 4 hrs. The fixed `hours` booking length is replaced by this limit. Opening hours and guest limits are unchanged.
- **Times move to half-hours.** Start times are every 30 minutes from opening, so tennis starts at 7:00, 7:30 … 8:30 PM. A booking must end by closing time. Claude's call: represent times as minutes since midnight, and give a booking a `minutes` length alongside its start.
- **Lengths** are 30, 60, 90 … up to the limit.
- **The pretend calendar** marks individual half-hour blocks as taken, using the same stable hashing as today so it doesn't change between reloads, at roughly today's density. "Fully booked" days stay as they are. A resident's own pretend bookings block their whole span.
- **A start time is open** when its first half-hour block is free, it's in the future (for today), and at least 30 minutes remain before closing.
- **A length is available from a start** when every half-hour block in it is free and it ends by closing time.
- **When a length isn't available, say why.** It is listed but disabled, with a reason: "booked at 11:30" when a taken block cuts it off, or "closes at 9:00 PM" when closing does. Whichever comes first wins. Lengths above the limit aren't listed at all.

## Display (Claude's calls)

- Lengths: "30 min", "1 hr", "1½ hr", "2 hr", "2½ hr" and so on.
- Amenity tiles: "Up to 2 hrs · up to 4 guests" (replacing "1 hr · up to 4 guests").
- Time tiles: "10:00 AM", "10:30 AM" in the existing three-column grid. There are now twice as many, so the grid simply gets longer.
- Each length tile shows the length on the left and its range on the right ("1½ hr · 10:00 – 11:30 AM"). A disabled tile shows its reason in place of the range.
- Summary card: the Time row shows the real range ("10:00 – 11:30 AM"). Add a "Length" row ("1½ hr").
- Confirmation line and reservations list: use the real range.

## The booking link (`/booking-link`)

- **Five steps:** amenity → date → time → **how long** → review. The progress bar has five segments and the label reads "Step N of 5".
- **The "How long?" step:** title "How long?". A context row shows the amenity thumbnail, name, date and "starts 10:00 AM". Below it, one tile per length up to the limit, as described in Display.
- **Back** from review goes to How long, and from How long to Time. Each step clears its own value, as today. The review card's "Change" goes to How long.
- **Link format** gains `length` in minutes, and `time` becomes `HH:MM` in 24-hour form: `/booking-link?token=…&amenity=tennis&date=2026-11-20&time=10:30&length=90`. A bare hour (`time=10`) is still accepted as 10:00, so links sent today keep working. The page writes `HH:MM`.
- **Link validation** extends the existing amenity → date → time chain with length:
  - a time that isn't on the half-hour → the "isn't available" note;
  - a `length` that isn't a multiple of 30, is below 30, or is above the limit → "That length isn't available. Pick how long.";
  - a length that is allowed but doesn't fit at that start → "<1½ hr> doesn't fit at that time. Pick how long.";
  - a missing length opens on the How long step.

## The chat

- **The new step.** Once a start time is chosen (tapped, or typed and open), the agent replies "How long would you like the Tennis Court?" with a new length-tiles widget. A "← Pick a different time" chip follows it. Tapping a length goes to the summary.
- **Typing a length is understood** by the rules reader: "for 90 minutes", "for 2 hours", "1.5 hours", "an hour", "half an hour", "an hour and a half", "2 hrs". Typed together with a time ("tennis Friday at 10 for 90 minutes"), it skips the length step when it fits.
  - A length over the limit: "The Tennis Court can be booked for up to 2 hrs." plus the length tiles.
  - A length that doesn't fit at that start: "1½ hr doesn't fit at 10:00 AM." plus the length tiles.
  - A length typed before any time is held, and applied once a time is picked (Claude's call).
  - A typed length that isn't a whole number of half-hours ("45 minutes", "15 minutes", "1 hour 15") is not snapped, since snapping would book a different length than asked. The agent replies "Bookings go in 30-minute steps." plus the length tiles (Claude's call).
- **A chosen length is kept** when the resident later changes the time, day or amenity, the same way a typed time already survives a day change (Claude's call). Once a new start time is set, the length is re-checked. If it still fits, the length step is skipped. If not, it is dropped and the tiles are shown with the matching note ("doesn't fit at …" or "can be booked for up to …").
- **Typed times on the half-hour** ("10:30") are now exact. Other minutes ("10:15") snap down to the half-hour with the existing snapped notice (Claude's call).
- **Change requests** gain a length target: "change the length", "longer", "shorter" and "different length" go back to the length tiles. The summary card's "Change" keeps its existing menu ("What would you like to change?") and gains a "Different length" chip, listed first (Claude's call). Only the booking link's "Change" goes straight back a step.
- **Slot lists.** "Find times next week" lists open half-hour start times. Picking one goes to the length step.
- The time-tiles reply no longer says "1-hour slots". Claude's wording: "Here are the open start times for the Tennis Court on Friday, Nov 20:".

## Left to the builder

- Data shapes and names beyond those fixed above, and how `Draft`, `Widget` and `ChatEvent` grow (a `pickLength` event and a `lengths` widget are the obvious fit).
- Exact hash thresholds for the half-hour pretend calendar, as long as days still have a realistic mix of free and taken time and some lengths get cut off.
- Updating existing tests whose fixtures assume whole-hour slots or fixed lengths. Their intent must survive.
- Tests: the length rule (fits, cut off by a booking, cut off by closing, limit), link parsing for `time=HH:MM`, bare hours and `length`, the new step in both flows, the reader's length phrases, and the summary and confirmation ranges.
