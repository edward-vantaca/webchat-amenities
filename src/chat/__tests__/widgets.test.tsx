import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetView } from "../widgets/WidgetView";
import { chatReducer, initChat } from "../../booking/chatReducer";
import { AMENITIES } from "../../booking/amenities";
import { addDays, formatDayLong } from "../../booking/dates";
import { hasOpenSlot, isFullyBookedByMock, slotsFor } from "../../booking/availability";
import type { AmenityId, Booking, ChatMessage, ChatState, Widget } from "../../booking/types";

const NOW = new Date(2026, 9, 29, 9, 0);
const TODAY = "2026-10-29";
const base = initChat(NOW);
const withAmenity = (amenity: AmenityId, bookings: Booking[] = []): ChatState => ({
  ...base,
  bookings,
  draft: { ...base.draft, amenity },
});

function setup(widget: Widget, state: ChatState = base, active = true) {
  const dispatch = vi.fn();
  const message: ChatMessage = { id: 7, role: "agent", widget, active };
  const utils = render(<WidgetView message={message} state={state} dispatch={dispatch} />);
  return { dispatch, user: userEvent.setup(), ...utils };
}

const booking: Booking = { confirmation: "RS12345", amenity: "tennis", date: "2026-10-31", time: 10, guests: 2 };

describe("widgets", () => {
  test("amenity grid dispatches pickAmenity with message id", async () => {
    const { dispatch, user } = setup({ kind: "amenities" });
    expect(screen.getAllByRole("button")).toHaveLength(AMENITIES.length);
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: "pickAmenity", amenity: "tennis", from: 7 });
  });

  test("inactive widget is aria-disabled and faded", () => {
    const { container } = setup({ kind: "amenities" }, base, false);
    expect(container.firstChild).toHaveAttribute("aria-disabled", "true");
    expect((container.firstChild as HTMLElement).className).toContain("opacity-50");
    expect((container.firstChild as HTMLElement).className).toContain("pointer-events-none");
  });

  test("day strip disables full days and offers Pick another date", async () => {
    let found: { amenity: AmenityId; date: string } | undefined;
    for (const a of AMENITIES) {
      for (let i = 0; i < 61 && !found; i++) {
        const d = addDays(TODAY, i);
        if (isFullyBookedByMock(a.id, d)) found = { amenity: a.id, date: d };
      }
      if (found) break;
    }
    expect(found).toBeDefined();
    const { dispatch, user } = setup({ kind: "days", from: found!.date, count: 14 }, withAmenity(found!.amenity));
    expect(screen.getByRole("button", { name: formatDayLong(found!.date) })).toBeDisabled();
    const more = screen.getByRole("button", { name: /Pick another date/ });
    expect(more).toBeEnabled();
    await user.click(more);
    expect(dispatch).toHaveBeenCalledWith({ type: "openCalendar", from: 7 });
  });

  test("day strip dispatches pickDate for an open day", async () => {
    const day = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).find((d) =>
      hasOpenSlot("tennis", d, [], NOW),
    )!;
    const { dispatch, user } = setup({ kind: "days", from: TODAY, count: 14 }, withAmenity("tennis"));
    await user.click(screen.getByRole("button", { name: formatDayLong(day) }));
    expect(dispatch).toHaveBeenCalledWith({ type: "pickDate", date: day, from: 7 });
  });

  test("slot tiles disable taken slots and dispatch pickSlot", async () => {
    const date = Array.from({ length: 30 }, (_, i) => addDays(TODAY, i + 1)).find((d) => {
      const sl = slotsFor("tennis", d, [], NOW);
      return sl.some((x) => x.open) && sl.some((x) => !x.open);
    })!;
    const slots = slotsFor("tennis", date, [], NOW);
    const taken = slots.find((s) => !s.open)!;
    const open = slots.find((s) => s.open)!;
    const { dispatch, user } = setup({ kind: "slots", amenity: "tennis", date }, withAmenity("tennis"));
    const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? "PM" : "AM"}`;
    expect(screen.getByRole("button", { name: label(taken.hour) })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: label(open.hour) }));
    expect(dispatch).toHaveBeenCalledWith({ type: "pickSlot", date, time: open.hour, from: 7 });
  });

  test("slot list shows a heading per day", async () => {
    const { dispatch, user } = setup(
      { kind: "slotList", amenity: "tennis", range: { from: "2026-11-02", to: "2026-11-08" } },
      withAmenity("tennis"),
    );
    expect(screen.getByText("Monday, Nov 2")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button")[0]);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "pickSlot", from: 7 }));
  });

  test("summary stepper dispatches setGuests, Change and Confirm", async () => {
    const { dispatch, user } = setup({ kind: "summary", amenity: "tennis", date: "2026-10-31", time: 10, guests: 2 });
    expect(screen.getByText("Up to 4 guests · free cancellation up to 24 hrs before")).toBeInTheDocument();
    expect(screen.getByText("10:00 – 11:00 AM")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Increase guests" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "setGuests", guests: 3, from: 7 });
    await user.click(screen.getByRole("button", { name: "Decrease guests" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "setGuests", guests: 1, from: 7 });
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "change", from: 7 });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "confirm", from: 7 });
  });

  test("summary stepper stops at 1 and maxGuests", () => {
    setup({ kind: "summary", amenity: "tennis", date: "2026-10-31", time: 10, guests: 4 });
    expect(screen.getByRole("button", { name: "Increase guests" })).toBeDisabled();
  });

  test("calendar disables past days and navigates months", async () => {
    const { dispatch, user } = setup({ kind: "calendar", month: "2026-10-01" }, withAmenity("tennis"));
    expect(screen.getByRole("button", { name: "Wednesday, Oct 28" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Friday, Oct 30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "calendarMonth", month: "2026-11-01", from: 7 });
  });

  test("calendar picks an open day and caps at the last bookable month", async () => {
    const day = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).find((d) =>
      hasOpenSlot("tennis", d, [], NOW),
    )!;
    const first = day.slice(0, 7) + "-01";
    const { dispatch, user } = setup({ kind: "calendar", month: first }, withAmenity("tennis"));
    await user.click(screen.getByRole("button", { name: formatDayLong(day) }));
    expect(dispatch).toHaveBeenCalledWith({ type: "pickDate", date: day, from: 7 });
  });

  test("calendar next is disabled in the last bookable month", () => {
    setup({ kind: "calendar", month: "2026-12-01" }, withAmenity("tennis"));
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tuesday, Dec 29" })).toBeDisabled();
  });

  test("confirmation and reservations render text and dispatch nothing", async () => {
    const a = setup({ kind: "confirmation", booking });
    expect(screen.getByText("✓ Reservation confirmed")).toBeInTheDocument();
    expect(screen.getByText("Tennis Court · Sat, Oct 31 · 10:00 – 11:00 AM · 2 guests")).toBeInTheDocument();
    expect(screen.getByText("Confirmation #RS12345")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    a.unmount();
    setup({ kind: "reservations", bookings: [booking, { ...booking, confirmation: "RS2", guests: 1 }] });
    expect(screen.getAllByText(/Tennis Court · Sat, Oct 31/)).toHaveLength(2);
    expect(screen.getByText(/1 guest$/)).toBeInTheDocument();
  });

  test("chips replace from with the message id", async () => {
    const { dispatch, user } = setup({
      kind: "chips",
      chips: [{ label: "Book another", event: { type: "bookAnother", from: 0 } }],
    });
    await user.click(within(screen.getByRole("button", { name: "Book another" }).parentElement!).getByRole("button"));
    expect(dispatch).toHaveBeenCalledWith({ type: "bookAnother", from: 7 });
  });

  test("state reducer integration: summary from a real state", () => {
    const s = chatReducer(base, { type: "commonQuestion", text: "Reserve an amenity for me" });
    expect(s.messages.some((m) => m.widget?.kind === "amenities")).toBe(true);
  });
});
