import { hasOpenSlot } from "../../booking/availability";
import { addDays, formatDayLong, formatDayShort, inWindow, toISODate } from "../../booking/dates";
import type { ChatEvent, ChatState, ISODate } from "../../booking/types";

export function DayStrip({
  from,
  count,
  state,
  dispatch,
}: {
  from: ISODate;
  count: number;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const today = toISODate(state.now);
  const amenity = state.draft.amenity;
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {days.map((d) => {
        const ok = inWindow(d, today) && (!amenity || hasOpenSlot(amenity, d, state.bookings, state.now));
        const f = formatDayShort(d);
        return (
          <button
            key={d}
            type="button"
            aria-label={formatDayLong(d)}
            disabled={!ok}
            onClick={() => dispatch({ type: "pickDate", date: d, from: 0 })}
            className="flex-none w-[52px] rounded-[10px] border border-[#e2e8f0] bg-white py-1.5 text-center text-[#262630] enabled:hover:border-[#247ae4] enabled:cursor-pointer disabled:opacity-40"
          >
            <span className="block text-[10.5px] uppercase text-[#8a8a96]">{f.weekday}</span>
            <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold block text-[17px] leading-[1.2] font-bold">{f.day}</span>
            <span className="block text-[10.5px] text-[#8a8a96]">{f.month}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => dispatch({ type: "openCalendar", from: 0 })}
        className="font-['DM_Sans:SemiBold',sans-serif] font-semibold flex-none w-[70px] rounded-[10px] border border-dashed border-[#247ae4] bg-white px-1 text-[11px] text-[#247ae4] cursor-pointer"
      >
        Pick another date
      </button>
    </div>
  );
}
