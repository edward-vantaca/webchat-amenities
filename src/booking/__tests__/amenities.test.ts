import { AMENITIES, getAmenity } from "../amenities";

test("six amenities in spec order", () =>
  expect(AMENITIES.map((a) => a.id)).toEqual(["tennis", "pickleball", "clubhouse", "basketball", "lounge", "conference"]));
test("clubhouse values", () =>
  expect(getAmenity("clubhouse")).toMatchObject({ name: "Main Clubhouse", hours: 4, maxGuests: 60, open: 9, close: 23 }));
