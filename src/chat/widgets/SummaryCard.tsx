import { getAmenity } from "../../booking/amenities";
import { formatDayLong, formatRange } from "../../booking/dates";
import type { AmenityId, ChatEvent, ISODate } from "../../booking/types";

export function SummaryCard({
  amenity,
  date,
  time,
  dispatch,
}: {
  amenity: AmenityId;
  date: ISODate;
  time: number;
  dispatch: (e: ChatEvent) => void;
}) {
  const a = getAmenity(amenity);
  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
      <img src={a.image} alt="" className="block h-[90px] w-full object-cover" />
      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[12.5px] text-[#262630]">
        <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[13.5px]">{a.name}</p>
        <div className="flex justify-between"><span className="text-[#6b6b78]">Date</span><span>{formatDayLong(date)}</span></div>
        <div className="flex justify-between"><span className="text-[#6b6b78]">Time</span><span>{formatRange(time, a.hours)}</span></div>
        <p className="text-[12px] leading-[1.45] text-[#6b6b78]">
          Up to {a.maxGuests} guests · free cancellation up to 24 hrs before
        </p>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={() => dispatch({ type: "change", from: 0 })}
            className="font-['DM_Sans:SemiBold',sans-serif] font-semibold flex-1 rounded-lg border border-[#cfd6df] py-2 text-[13px] text-[#262630] hover:bg-[#f4f6f9] cursor-pointer">
            Change
          </button>
          <button type="button" onClick={() => dispatch({ type: "confirm", from: 0 })}
            className="font-['DM_Sans:SemiBold',sans-serif] font-semibold flex-1 rounded-lg bg-[#247ae4] py-2 text-[13px] text-white hover:bg-[#1d5fb8] cursor-pointer">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
