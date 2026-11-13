import { useState, type ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";

type View = "desktop" | "mobile";
const KEY = "booking-link-view";

function readView(): View {
  try {
    return localStorage.getItem(KEY) === "mobile" ? "mobile" : "desktop";
  } catch {
    return "desktop";
  }
}

// Demo aid: a floating Mobile | Desktop toggle, with mobile showing the page inside a phone frame.
// Both only appear from the sm breakpoint up; on a real phone the page renders as is.
export function DevicePreview({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(readView);

  function choose(v: View) {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
  }

  const option = (v: View, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => choose(v)}
      className={`font-['DM_Sans:SemiBold',sans-serif] font-semibold flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] cursor-pointer ${
        view === v ? "bg-[#247ae4] text-white" : "text-[#262630] hover:bg-[#f4f6f9]"
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <>
      {view === "mobile" ? (
        <div className="min-h-full sm:flex sm:items-center sm:justify-center sm:bg-[#e9edf3] sm:pt-8 sm:pb-24">
          <div
            data-testid="device-frame"
            className="h-full sm:relative sm:h-[844px] sm:max-h-[calc(100vh-8rem)] sm:w-[390px] sm:overflow-hidden sm:rounded-[52px] sm:border-[12px] sm:border-[#1f2430] sm:bg-white sm:shadow-2xl"
          >
            <div aria-hidden="true" className="absolute top-2 left-1/2 z-10 hidden h-6 w-28 -translate-x-1/2 rounded-full bg-[#1f2430] sm:block" />
            <div className="h-full sm:overflow-y-auto sm:pt-8">{children}</div>
          </div>
        </div>
      ) : (
        <div className="min-h-full sm:pb-20">{children}</div>
      )}
      <div
        role="group"
        aria-label="Preview size"
        className="fixed bottom-6 left-1/2 z-50 hidden -translate-x-1/2 gap-1 rounded-full border border-[#e2e8f0] bg-white p-1 shadow-lg sm:flex"
      >
        {option("mobile", "Mobile", Smartphone)}
        {option("desktop", "Desktop", Monitor)}
      </div>
    </>
  );
}
