import { afterEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DevicePreview } from "../DevicePreview";

const KEY = "booking-link-view";

afterEach(() => localStorage.clear());

describe("DevicePreview", () => {
  test("starts on desktop with no device frame", () => {
    render(<DevicePreview><p>page</p></DevicePreview>);
    expect(screen.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("device-frame")).not.toBeInTheDocument();
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  test("mobile wraps the page in a device frame and back again", async () => {
    const user = userEvent.setup();
    render(<DevicePreview><p>page</p></DevicePreview>);
    await user.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByTestId("device-frame")).toContainElement(screen.getByText("page"));
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Desktop" }));
    expect(screen.queryByTestId("device-frame")).not.toBeInTheDocument();
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  test("remembers the last choice", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DevicePreview><p>page</p></DevicePreview>);
    await user.click(screen.getByRole("button", { name: "Mobile" }));
    expect(localStorage.getItem(KEY)).toBe("mobile");
    unmount();
    render(<DevicePreview><p>page</p></DevicePreview>);
    expect(screen.getByTestId("device-frame")).toBeInTheDocument();
  });

  test("ignores a junk stored value", () => {
    localStorage.setItem(KEY, "tablet");
    render(<DevicePreview><p>page</p></DevicePreview>);
    expect(screen.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
  });
});
