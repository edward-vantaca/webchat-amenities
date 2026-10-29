import type { ChatEvent, ChatMessage, ChatState } from "../../booking/types";
import { AmenityGrid } from "./AmenityGrid";
import { ChipRow } from "./ChipRow";
import { ConfirmationCard } from "./ConfirmationCard";
import { DayStrip } from "./DayStrip";
import { MonthCalendar } from "./MonthCalendar";
import { ReservationList } from "./ReservationList";
import { SlotList } from "./SlotList";
import { SlotTiles } from "./SlotTiles";
import { SummaryCard } from "./SummaryCard";

export function WidgetView({
  message,
  state,
  dispatch,
}: {
  message: ChatMessage;
  state: ChatState;
  dispatch: (e: ChatEvent) => void;
}) {
  const w = message.widget;
  // Chip events from the reducer carry from: 0; stamp every event with this message's id.
  const send = (e: ChatEvent) => dispatch({ ...e, from: message.id } as ChatEvent);
  let body = null;
  if (w) {
    switch (w.kind) {
      case "amenities":
        body = <AmenityGrid dispatch={send} />;
        break;
      case "days":
        body = <DayStrip from={w.from} count={w.count} state={state} dispatch={send} />;
        break;
      case "calendar":
        body = <MonthCalendar month={w.month} state={state} dispatch={send} />;
        break;
      case "slots":
        body = <SlotTiles amenity={w.amenity} date={w.date} timeOfDay={w.timeOfDay} state={state} dispatch={send} />;
        break;
      case "slotList":
        body = <SlotList amenity={w.amenity} range={w.range} state={state} dispatch={send} />;
        break;
      case "summary":
        body = <SummaryCard amenity={w.amenity} date={w.date} time={w.time} guests={w.guests} dispatch={send} />;
        break;
      case "confirmation":
        body = <ConfirmationCard booking={w.booking} />;
        break;
      case "reservations":
        body = <ReservationList bookings={w.bookings} />;
        break;
      case "chips":
        body = <ChipRow chips={w.chips} messageId={message.id} dispatch={dispatch} />;
        break;
    }
  }
  return (
    <div
      className={`ml-8 min-w-0 ${message.active ? "" : "opacity-50 pointer-events-none"}`}
      aria-disabled={message.active ? undefined : "true"}
    >
      {body}
    </div>
  );
}
