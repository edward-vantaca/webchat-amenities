import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AskHoaiPanel from "../AskHoaiPanel";
import { interpret } from "@/booking/interpret";
import { isMockTaken, startTimes } from "@/booking/availability";
import { formatHour } from "@/booking/dates";

vi.mock("@/booking/interpret", async () => {
  const actual = await vi.importActual<typeof import("@/booking/interpret")>("@/booking/interpret");
  return { ...actual, interpret: vi.fn(actual.interpret) };
});

const OPEN_DAY = "2026-11-03";
const OPEN_HOUR = startTimes("tennis").find((h) => !isMockTaken("tennis", OPEN_DAY, h))!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AskHoaiPanel conversation", () => {
  test("reserve question is first and starts the flow", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    const qs = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("?") || b.textContent?.includes("Reserve"));
    expect(qs[0]).toHaveTextContent("Reserve an amenity for me");
    await user.click(qs[0]);
    expect(screen.getByRole("button", { name: /Tennis Court/ })).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  test("typing a full request reaches the summary", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    await user.type(
      screen.getByRole("textbox"),
      `tennis on nov 3 at ${formatHour(OPEN_HOUR)}{Enter}`,
    );
    expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  test("blank input does not send", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    await user.type(screen.getByRole("textbox"), "{Enter}");
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  test("interpret rejection shows the error reply", async () => {
    const user = userEvent.setup();
    vi.mocked(interpret).mockRejectedValueOnce(new Error("boom"));
    render(<AskHoaiPanel />);
    await user.type(screen.getByRole("textbox"), "hello{Enter}");
    expect(await screen.findByText("Something went wrong, please try again.")).toBeInTheDocument();
  });

  test("textarea regains focus after a typed turn", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    await user.type(screen.getByRole("textbox"), "hello{Enter}");
    await screen.findByText(/Sorry, I didn't catch that|I can help you reserve/);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  test("the reader gets the current day, the newest active widget, and its result is applied (R10)", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    await user.click(screen.getByRole("button", { name: /Reserve an amenity for me/ }));
    vi.setSystemTime(new Date(2026, 9, 30, 9, 0)); // the clock moves on after mount
    await user.type(screen.getByRole("textbox"), "tennis{Enter}");
    expect(vi.mocked(interpret)).toHaveBeenLastCalledWith(
      "tennis",
      expect.objectContaining({ today: "2026-10-30", activeWidget: "amenities" }),
    );
    // the day strip starts at the new today (Fri, Oct 30), not the mount day
    const strip = await screen.findByText(/Great choice/);
    expect(strip).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thursday, Oct 29" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Friday, Oct 30" })).toBeInTheDocument();
  });

  test("tile tap does not steal focus", async () => {
    const user = userEvent.setup();
    render(<AskHoaiPanel />);
    await user.click(screen.getByRole("button", { name: /Reserve an amenity for me/ }));
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });
});
