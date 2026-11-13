import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
