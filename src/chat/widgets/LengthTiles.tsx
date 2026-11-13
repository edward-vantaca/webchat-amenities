import { lengthReason, lengthsFrom } from "../../booking/availability";
import { formatLength, formatRange } from "../../booking/dates";
import type { AmenityId, ChatEvent, ChatState, ISODate } from "../../booking/types";

// One tile per length up to the amenity's limit, each with its end time; a length that
// doesn't fit says why ("booked at 11:30", "closes at 9:00 PM").
export function LengthTiles({
  amenity,
  date,
  time,
  state,
  dispatch,
}: {
  amenity: AmenityId;
  date: ISODate;
  time: number;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const options = lengthsFrom(amenity, date, time, state.bookings);
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => {
        const length = formatLength(o.minutes);
        const detail = o.ok ? formatRange(time, o.minutes) : lengthReason(o.reason);
        return (
          <button
            key={o.minutes}
            type="button"
            aria-label={`${length}, ${detail}`}
            disabled={!o.ok}
            onClick={() => dispatch({ type: "pickLength", minutes: o.minutes, from: 0 })}
            className={
              o.ok
                ? "flex items-center justify-between rounded-[10px] border border-[#cfe0f5] bg-[#f5f9ff] px-3 py-2 text-[12.5px] hover:border-[#247ae4] cursor-pointer"
                : "flex items-center justify-between rounded-[10px] border border-[#eceef2] bg-[#f6f7f9] px-3 py-2 text-[12.5px]"
            }
          >
            <span className={`font-['DM_Sans:SemiBold',sans-serif] font-semibold ${o.ok ? "text-[#1d5fb8]" : "text-[#b5b9c2]"}`}>{length}</span>
            <span className={o.ok ? "text-[#6b6b78]" : "text-[#c3c7cf]"}>{detail}</span>
          </button>
        );
      })}
    </div>
  );
}
