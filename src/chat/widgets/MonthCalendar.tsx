import { ChevronLeft, ChevronRight } from "lucide-react";
import { hasOpenSlot } from "../../booking/availability";
import { addDays, formatDayLong, fromISODate, inWindow, lastBookable, toISODate } from "../../booking/dates";
import type { ChatEvent, ChatState, ISODate } from "../../booking/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const firstOfMonth = (s: ISODate) => `${s.slice(0, 7)}-01`;

export function MonthCalendar({
  month,
  state,
  dispatch,
}: {
  month: ISODate;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const today = toISODate(state.now);
  const amenity = state.draft.amenity;
  const first = firstOfMonth(month);
  const start = fromISODate(first);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const prev = firstOfMonth(addDays(first, -1));
  const next = firstOfMonth(addDays(first, 31));
  const canPrev = first > firstOfMonth(today);
  const canNext = first < firstOfMonth(lastBookable(today));
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: start.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  const nav = "grid h-6 w-6 place-items-center rounded-md text-[#262630] enabled:hover:bg-[#f4f6f9] enabled:cursor-pointer disabled:opacity-30";
  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={!canPrev} className={nav}
          onClick={() => dispatch({ type: "calendarMonth", month: prev, from: 0 })}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[13px] text-[#262630]">
          {MONTH_NAMES[start.getMonth()]} {start.getFullYear()}
        </span>
        <button type="button" aria-label="Next month" disabled={!canNext} className={nav}
          onClick={() => dispatch({ type: "calendarMonth", month: next, from: 0 })}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[3px] text-center text-[12px]">
        {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
          <span key={i} aria-hidden="true" className="py-0.5 text-[10px] text-[#8a8a96]">{l}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const ok = inWindow(d, today) && (!amenity || hasOpenSlot(amenity, d, state.bookings, state.now));
          return (
            <button
              key={d}
              type="button"
              aria-label={formatDayLong(d)}
              disabled={!ok}
              onClick={() => dispatch({ type: "pickDate", date: d, from: 0 })}
              className="rounded-md py-1.5 text-[#262630] enabled:hover:bg-[#e8f1fd] enabled:cursor-pointer disabled:text-[#c3c7cf]"
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
