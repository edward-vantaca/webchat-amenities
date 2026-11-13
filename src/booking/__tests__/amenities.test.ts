import { AMENITIES, getAmenity } from "../amenities";

test("six amenities in spec order", () =>
  expect(AMENITIES.map((a) => a.id)).toEqual(["tennis", "pickleball", "clubhouse", "basketball", "lounge", "conference"]));
test("clubhouse values", () =>
  expect(getAmenity("clubhouse")).toMatchObject({ name: "Main Clubhouse", maxGuests: 60, open: 9, close: 23 }));
test("limits", () =>
  expect(Object.fromEntries(AMENITIES.map((a) => [a.id, a.maxMinutes]))).toEqual({
    tennis: 120, pickleball: 120, clubhouse: 360, basketball: 120, lounge: 240, conference: 240,
  }));
