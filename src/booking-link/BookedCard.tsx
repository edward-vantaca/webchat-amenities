import { getAmenity } from "@/booking/amenities";
import { formatDayLong, formatLength, formatRange } from "@/booking/dates";
import type { Booking } from "@/booking/types";

// The done screen's card: the review card's look (photo, detail rows) with the booking's status on top.
export function BookedCard({ booking, cancelled = false }: { booking: Booking; cancelled?: boolean }) {
  const a = getAmenity(booking.amenity);
  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
      <div className="relative">
        <img src={a.image} alt="" className={`block h-[110px] w-full object-cover ${cancelled ? "grayscale opacity-60" : ""}`} />
        <p
          className={`font-['DM_Sans:SemiBold',sans-serif] font-semibold absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[12.5px] ${
            cancelled ? "bg-[#f1f2f4] text-[#4b4b57]" : "bg-[#f1faf4] text-[#1f7a43]"
          }`}
        >
          {cancelled ? "Reservation cancelled" : "✓ Reservation confirmed"}
        </p>
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-3 text-[14px] text-[#262630]">
        <p className={`font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[16px] ${cancelled ? "line-through text-[#8a8a96]" : ""}`}>
          {a.name}
        </p>
        <div className="flex justify-between"><span className="text-[#6b6b78]">Date</span><span>{formatDayLong(booking.date)}</span></div>
        <div className="flex justify-between"><span className="text-[#6b6b78]">Time</span><span>{formatRange(booking.time, booking.minutes)}</span></div>
        <div className="flex justify-between"><span className="text-[#6b6b78]">Length</span><span>{formatLength(booking.minutes)}</span></div>
        <div className="flex justify-between border-t border-[#eef0f4] pt-2">
          <span className="text-[#6b6b78]">Confirmation</span>
          <span>#{booking.confirmation}</span>
        </div>
      </div>
    </div>
  );
}
