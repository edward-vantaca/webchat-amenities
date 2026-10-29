import { openSlotsInRange } from "../../booking/availability";
import { formatDayLong, formatHour } from "../../booking/dates";
import type { AmenityId, ChatEvent, ChatState, DateRange } from "../../booking/types";

export function SlotList({
  amenity,
  range,
  state,
  dispatch,
}: {
  amenity: AmenityId;
  range: DateRange;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const days = openSlotsInRange(amenity, range, state.bookings, state.now);
  return (
    <div className="flex flex-col gap-2.5">
      {days.map((d) => (
        <div key={d.date}>
          <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold mb-1 text-[12px] text-[#262630]">{formatDayLong(d.date)}</p>
          <div className="flex flex-wrap gap-1.5">
            {d.hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => dispatch({ type: "pickSlot", date: d.date, time: h, from: 0 })}
                className="font-['DM_Sans:SemiBold',sans-serif] font-semibold rounded-lg border border-[#cfe0f5] bg-[#f5f9ff] px-2.5 py-1.5 text-[12.5px] text-[#1d5fb8] hover:border-[#247ae4] cursor-pointer"
              >
                {formatHour(h)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
