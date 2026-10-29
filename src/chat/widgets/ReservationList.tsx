import type { Booking } from "../../booking/types";
import { bookingLine } from "./ConfirmationCard";

export function ReservationList({ bookings }: { bookings: Booking[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {bookings.map((b) => (
        <li key={b.confirmation} className="rounded-xl border border-[#bfe3cc] bg-[#f1faf4] px-3 py-2 text-[12.5px] leading-[1.5] text-[#262630]">
          <p>{bookingLine(b)}</p>
          <p className="text-[#6b6b78]">Confirmation #{b.confirmation}</p>
        </li>
      ))}
    </ul>
  );
}
