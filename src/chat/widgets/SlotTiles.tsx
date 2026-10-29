import { slotsFor } from "../../booking/availability";
import { formatHour } from "../../booking/dates";
import type { AmenityId, ChatEvent, ChatState, ISODate, TimeOfDay } from "../../booking/types";

export function SlotTiles({
  amenity,
  date,
  timeOfDay,
  state,
  dispatch,
}: {
  amenity: AmenityId;
  date: ISODate;
  timeOfDay?: TimeOfDay;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const slots = slotsFor(amenity, date, state.bookings, state.now, timeOfDay);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {slots.map((s) => (
        <button
          key={s.hour}
          type="button"
          disabled={!s.open}
          onClick={() => dispatch({ type: "pickSlot", date, time: s.hour, from: 0 })}
          className={
            s.open
              ? "font-['DM_Sans:SemiBold',sans-serif] font-semibold rounded-lg border border-[#cfe0f5] bg-[#f5f9ff] py-2 text-center text-[12.5px] text-[#1d5fb8] hover:border-[#247ae4] cursor-pointer"
              : "rounded-lg border border-[#eceef2] bg-[#f6f7f9] py-2 text-center text-[12.5px] text-[#b5b9c2] line-through"
          }
        >
          {formatHour(s.hour)}
        </button>
      ))}
    </div>
  );
}
