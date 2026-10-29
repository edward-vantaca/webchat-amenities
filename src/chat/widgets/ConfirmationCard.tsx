import { getAmenity } from "../../booking/amenities";
import { formatDayShort, formatRange } from "../../booking/dates";
import type { Booking } from "../../booking/types";

export function bookingLine(b: Booking): string {
  const a = getAmenity(b.amenity);
  const d = formatDayShort(b.date);
  return `${a.name} · ${d.weekday}, ${d.month} ${d.day} · ${formatRange(b.time, a.hours)} · ${b.guests} ${b.guests === 1 ? "guest" : "guests"}`;
}

export function ConfirmationCard({ booking }: { booking: Booking }) {
  return (
    <div className="rounded-xl border border-[#bfe3cc] bg-[#f1faf4] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[#262630]">
      <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[13px] text-[#1f7a43]">✓ Reservation confirmed</p>
      <p>{bookingLine(booking)}</p>
      <p className="text-[#6b6b78]">Confirmation #{booking.confirmation}</p>
    </div>
  );
}
