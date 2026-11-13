import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingLinkPage from "../BookingLinkPage";
import { AMENITIES } from "@/booking/amenities";
import { lengthFits, slotsFor } from "@/booking/availability";
import { addDays, formatDayLong, formatRange, formatTime } from "@/booking/dates";

const TODAY = "2026-11-12";
// A tennis day inside the 14-day strip, and an open start on it (minutes since midnight) where 1 hr fits.
const openTimeOn = (d: string) =>
  slotsFor("tennis", d, [], new Date(2026, 10, 12, 9, 0)).find((s) => s.open && lengthFits("tennis", d, s.time, 60, []))?.time;
const OPEN_DAY = Array.from({ length: 13 }, (_, i) => addDays(TODAY, i + 1)).find((d) => openTimeOn(d) !== undefined)!;
const OPEN_TIME = openTimeOn(OPEN_DAY)!;
const HHMM = `${String(Math.floor(OPEN_TIME / 60)).padStart(2, "0")}:${String(OPEN_TIME % 60).padStart(2, "0")}`;
const LENGTH_LINK = `?token=t&amenity=tennis&date=${OPEN_DAY}&time=${HHMM}`;
const REVIEW_LINK = `${LENGTH_LINK}&length=60`;
const oneHour = () => screen.getByRole("button", { name: /^1 hr,/ });

function open(search = "") {
  window.history.replaceState(null, "", "/booking-link" + search);
  render(<BookingLinkPage />);
  return userEvent.setup();
}
const heading = (name: string) => screen.getByRole("heading", { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("BookingLinkPage", () => {
  test("opens on amenities with no params", () => {
    open();
    expect(heading("Choose an amenity")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    for (const a of AMENITIES) expect(screen.getByRole("button", { name: new RegExp(a.name) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "‹ Back" })).not.toBeInTheDocument();
    expect(screen.getByText("Maple Ridge HOA · Hi, Jordan")).toBeInTheDocument();
  });

  test("full flow by tapping", async () => {
    const user = open();
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    expect(heading("Pick a date")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    expect(heading("Pick a time")).toBeInTheDocument();
    expect(screen.getByText("Tennis Court")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatDayLong(OPEN_DAY)))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: formatTime(OPEN_TIME) }));
    expect(heading("How long?")).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
    expect(screen.getByText(`${formatDayLong(OPEN_DAY)} · starts ${formatTime(OPEN_TIME)}`)).toBeInTheDocument();
    await user.click(oneHour());
    expect(heading("Review your reservation")).toBeInTheDocument();
    expect(screen.getByText("Length")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText("✓ Reservation confirmed")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatRange(OPEN_TIME, 60)))).toBeInTheDocument();
    expect(screen.getByText(/Confirmation #RS\d{5}/)).toBeInTheDocument();
    expect(screen.getByText("You can close this page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "‹ Back" })).not.toBeInTheDocument();
  });

  test("has the mobile / desktop preview toggle", () => {
    open();
    expect(screen.getByRole("group", { name: "Preview size" })).toBeInTheDocument();
  });

  test("steps slide forward on a pick and back on Back, with no slide on first load", async () => {
    const user = open("?amenity=tennis");
    expect(screen.getByTestId("step")).not.toHaveClass("bl-step-forward", "bl-step-back");
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    expect(screen.getByTestId("step")).toHaveClass("bl-step-forward");
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(screen.getByTestId("step")).toHaveClass("bl-step-back");
    await user.click(screen.getByRole("button", { name: "Pick another date" }));
    expect(screen.getByTestId("step")).toHaveClass("bl-step-back"); // opening the calendar isn't a step change
  });

  test("the done screen slides in forward", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByTestId("step")).toHaveClass("bl-step-forward");
  });

  test("deep link opens on review", () => {
    open(REVIEW_LINK);
    expect(heading("Review your reservation")).toBeInTheDocument();
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
  });

  test("the progress bar has five segments", () => {
    open(REVIEW_LINK);
    expect(document.querySelectorAll("main > div[aria-hidden] > i")).toHaveLength(5);
  });

  test("a link without length opens on How long?", () => {
    open(LENGTH_LINK);
    expect(heading("How long?")).toBeInTheDocument();
    expect(window.location.search).toBe(LENGTH_LINK);
  });

  test("a length the page can't use says so on How long?", () => {
    open(`${LENGTH_LINK}&length=45`);
    expect(heading("How long?")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("That length isn't available. Pick how long.");
  });

  test("back works from a step the link filled in", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("How long?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Pick a time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Pick a date")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Choose an amenity")).toBeInTheDocument();
  });

  test("summary Change goes to How long?", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(heading("How long?")).toBeInTheDocument();
    expect(window.location.search).toBe(LENGTH_LINK);
  });

  test("drop note shows then clears on the next tap", async () => {
    const user = open("?amenity=squash");
    expect(screen.getByRole("status")).toHaveTextContent("We couldn't find that amenity. Pick one below.");
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("pick another date shows the calendar", async () => {
    const user = open("?amenity=tennis");
    await user.click(screen.getByRole("button", { name: "Pick another date" }));
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    expect(heading("Pick a time")).toBeInTheDocument();
  });

  test("book something else starts over and remembers the booking", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.click(screen.getByRole("button", { name: "Book something else" }));
    expect(heading("Choose an amenity")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    expect(screen.getByRole("button", { name: formatTime(OPEN_TIME) })).toBeDisabled();
  });
});

describe("BookingLinkPage address bar", () => {
  const back = () => act(() => window.history.back());

  test("address bar follows taps", async () => {
    const user = open("?token=t");
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    expect(window.location.search).toBe("?token=t&amenity=tennis");
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    expect(window.location.search).toBe(`?token=t&amenity=tennis&date=${OPEN_DAY}`);
  });

  test("normalizes dropped values on load", () => {
    open(`?token=t&amenity=squash&date=${OPEN_DAY}`);
    expect(window.location.search).toBe("?token=t");
  });

  test("phone back retraces taps", async () => {
    const user = open("?token=t");
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    back();
    expect(await screen.findByRole("heading", { name: "Pick a date" })).toBeInTheDocument();
    back();
    expect(await screen.findByRole("heading", { name: "Choose an amenity" })).toBeInTheDocument();
  });

  test("phone back from review lands on How long?", async () => {
    const user = open(LENGTH_LINK);
    await user.click(oneHour());
    expect(heading("Review your reservation")).toBeInTheDocument();
    back();
    expect(await screen.findByRole("heading", { name: "How long?" })).toBeInTheDocument();
  });

  test("back after confirm lands on times with the booked slot taken", async () => {
    const user = open("?token=t&amenity=tennis");
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    await user.click(screen.getByRole("button", { name: formatTime(OPEN_TIME) }));
    await user.click(oneHour());
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(window.location.search).toBe("?token=t");
    back();
    expect(await screen.findByRole("heading", { name: "Pick a time" })).toBeInTheDocument();
    expect(window.location.search).toBe(`?token=t&amenity=tennis&date=${OPEN_DAY}`);
    expect(screen.getByRole("button", { name: formatTime(OPEN_TIME) })).toBeDisabled();
  });

  test("token kept through taps, confirm and book something else", async () => {
    const seen: string[] = [];
    const user = open("?token=t");
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: formatTime(OPEN_TIME) }));
    seen.push(window.location.search);
    await user.click(oneHour());
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: "Book something else" }));
    seen.push(window.location.search);
    for (const s of seen) expect(s.startsWith("?token=t")).toBe(true);
    expect(seen[2]).toBe(LENGTH_LINK);
    expect(seen[3]).toBe(REVIEW_LINK);
  });
});
