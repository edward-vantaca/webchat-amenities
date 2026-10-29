import { AMENITIES } from "../../booking/amenities";
import type { ChatEvent } from "../../booking/types";

export function AmenityGrid({ dispatch }: { dispatch: (e: ChatEvent) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AMENITIES.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => dispatch({ type: "pickAmenity", amenity: a.id, from: 0 })}
          className="overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white text-left hover:border-[#247ae4] cursor-pointer"
        >
          <img src={a.image} alt="" className="block w-full aspect-[16/10] object-cover" />
          <span className="block px-2 pt-1.5 pb-2">
            <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold block text-[12.5px] text-[#262630]">{a.name}</span>
            <span className="block text-[11px] text-[#6b6b78]">
              {a.hours} hr · up to {a.maxGuests} guests
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
