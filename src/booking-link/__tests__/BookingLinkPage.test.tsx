import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingLinkPage from "../BookingLinkPage";
import { AMENITIES } from "@/booking/amenities";
import { isFullyBookedByMock, isMockTaken, startTimes } from "@/booking/availability";
import { addDays, formatDayLong, formatHour } from "@/booking/dates";

const TODAY = "2026-11-12";
// A tennis day inside the 14-day strip that the mock leaves bookable, and an open start on it.
const openHourOn = (d: string) => startTimes("tennis").find((h) => !isMockTaken("tennis", d, h));
const OPEN_DAY = Array.from({ length: 13 }, (_, i) => addDays(TODAY, i + 1))
  .find((d) => !isFullyBookedByMock("tennis", d) && openHourOn(d) !== undefined)!;
const OPEN_HOUR = openHourOn(OPEN_DAY)!;
const REVIEW_LINK = `?token=t&amenity=tennis&date=${OPEN_DAY}&time=${OPEN_HOUR}`;

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
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: formatHour(OPEN_HOUR) }));
    expect(heading("Review your reservation")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText("✓ Reservation confirmed")).toBeInTheDocument();
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
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
  });

  test("back works from a step the link filled in", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Pick a time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Pick a date")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(heading("Choose an amenity")).toBeInTheDocument();
  });

  test("summary Change goes to times", async () => {
    const user = open(REVIEW_LINK);
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(heading("Pick a time")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: formatHour(OPEN_HOUR) })).toBeDisabled();
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

  test("back after confirm lands on times with the booked slot taken", async () => {
    const user = open("?token=t&amenity=tennis");
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    await user.click(screen.getByRole("button", { name: formatHour(OPEN_HOUR) }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(window.location.search).toBe("?token=t");
    back();
    expect(await screen.findByRole("heading", { name: "Pick a time" })).toBeInTheDocument();
    expect(window.location.search).toBe(`?token=t&amenity=tennis&date=${OPEN_DAY}`);
    expect(screen.getByRole("button", { name: formatHour(OPEN_HOUR) })).toBeDisabled();
  });

  test("token kept through taps, confirm and book something else", async () => {
    const seen: string[] = [];
    const user = open("?token=t");
    await user.click(screen.getByRole("button", { name: /Tennis Court/ }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: formatDayLong(OPEN_DAY) }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: formatHour(OPEN_HOUR) }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    seen.push(window.location.search);
    await user.click(screen.getByRole("button", { name: "Book something else" }));
    seen.push(window.location.search);
    for (const s of seen) expect(s.startsWith("?token=t")).toBe(true);
    expect(seen[2]).toBe(`?token=t&amenity=tennis&date=${OPEN_DAY}&time=${OPEN_HOUR}`);
  });
});
