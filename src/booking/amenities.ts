import type { Amenity, AmenityId } from "./types";

const make = (
  id: AmenityId,
  name: string,
  maxMinutes: number,
  maxGuests: number,
  open: number,
  close: number,
  aliases: string[],
): Amenity => ({ id, name, image: `/assets/amenity-${id}.jpg`, maxMinutes, maxGuests, open, close, aliases });

export const AMENITIES: Amenity[] = [
  make("tennis", "Tennis Court", 120, 4, 7, 21, ["tennis"]),
  make("pickleball", "Pickleball Court", 120, 4, 7, 21, ["pickleball", "pickle ball"]),
  make("clubhouse", "Main Clubhouse", 360, 60, 9, 23, ["clubhouse", "club house"]),
  make("basketball", "Basketball Court", 120, 10, 7, 21, ["basketball", "hoops"]),
  make("lounge", "Lounge Meeting Room", 240, 20, 8, 22, ["lounge"]),
  make("conference", "Conference Room", 240, 10, 8, 22, ["conference", "meeting room"]),
];

export function getAmenity(id: AmenityId): Amenity {
  const a = AMENITIES.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown amenity: ${id}`);
  return a;
}
