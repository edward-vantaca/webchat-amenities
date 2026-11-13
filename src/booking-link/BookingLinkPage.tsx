import { useState } from "react";
import { getAmenity } from "@/booking/amenities";
import { confirmationNumber, initChat } from "@/booking/chatReducer";
import { formatDayLong, toISODate } from "@/booking/dates";
import type { Booking, ChatEvent, ChatState, ISODate } from "@/booking/types";
import { AskHoaiIcon } from "@/chat/AskHoaiPanel";
import { AmenityGrid } from "@/chat/widgets/AmenityGrid";
import { ConfirmationCard } from "@/chat/widgets/ConfirmationCard";
import { DayStrip } from "@/chat/widgets/DayStrip";
import { MonthCalendar } from "@/chat/widgets/MonthCalendar";
import { SlotTiles } from "@/chat/widgets/SlotTiles";
import { SummaryCard } from "@/chat/widgets/SummaryCard";
import { type DropNote, type LinkDraft, noteText, parseLink, stepBack, stepOf } from "./link";

// Placeholders until the magic link signs a real resident in.
const RESIDENT_LINE = "Maple Ridge HOA · Hi, Jordan";

const STEPS = {
  amenity: { n: 1, title: "Choose an amenity" },
  date: { n: 2, title: "Pick a date" },
  time: { n: 3, title: "Pick a time" },
  review: { n: 4, title: "Review your reservation" },
} as const;

type PageState = {
  token?: string;
  draft: LinkDraft;
  note?: DropNote;
  bookings: Booking[];
  calendarMonth?: ISODate; // set while the month calendar replaces the day strip
  done?: Booking;
};

const firstOfMonth = (s: ISODate) => `${s.slice(0, 7)}-01`;

export default function BookingLinkPage() {
  const [state, setState] = useState<PageState>(() => ({ ...parseLink(window.location.search, [], new Date()), bookings: [] }));
  const now = new Date();
  const { draft, bookings, done } = state;
  const step = stepOf(draft);

  // Every tap clears the drop note; leaving the date step closes the calendar.
  const go = (next: LinkDraft) => setState((s) => ({ ...s, draft: next, note: undefined, calendarMonth: undefined }));

  function confirm() {
    if (!draft.amenity || !draft.date || draft.time === undefined) return;
    const booking: Booking = {
      confirmation: confirmationNumber(bookings.length + 1, draft.date, draft.time),
      amenity: draft.amenity,
      date: draft.date,
      time: draft.time,
      guests: 1,
    };
    setState((s) => ({ ...s, bookings: [...s.bookings, booking], done: booking, draft: {}, note: undefined, calendarMonth: undefined }));
  }

  // The chat widgets read a ChatState and send ChatEvents; translate both ways.
  const widgetState: ChatState = { ...initChat(now), bookings, draft: { guests: 1, amenity: draft.amenity } };
  function onWidget(e: ChatEvent) {
    switch (e.type) {
      case "pickAmenity":
        return go({ amenity: e.amenity });
      case "pickDate":
        return go({ amenity: draft.amenity, date: e.date });
      case "openCalendar":
        return setState((s) => ({ ...s, note: undefined, calendarMonth: firstOfMonth(toISODate(now)) }));
      case "calendarMonth":
        return setState((s) => ({ ...s, note: undefined, calendarMonth: e.month }));
      case "pickSlot":
        return go({ amenity: draft.amenity, date: draft.date, time: e.time });
      case "change":
        return go(stepBack(draft));
      case "confirm":
        return confirm();
    }
  }

  let body;
  if (done) {
    body = (
      <div className="flex flex-col gap-4">
        <ConfirmationCard booking={done} />
        <p className="text-[14px] text-[#6b6b78]">You can close this page.</p>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, done: undefined }))}
          className="font-['DM_Sans:SemiBold',sans-serif] font-semibold rounded-lg border border-[#cfd6df] py-2.5 text-[15px] text-[#262630] hover:bg-[#f4f6f9] cursor-pointer"
        >
          Book something else
        </button>
      </div>
    );
  } else {
    const { n, title } = STEPS[step];
    const amenity = draft.amenity && getAmenity(draft.amenity);
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={`h-1 flex-1 rounded-sm ${i <= n ? "bg-[#247ae4]" : "bg-[#e2e8f0]"}`} />
          ))}
        </div>
        {n > 1 && (
          <button type="button" onClick={() => go(stepBack(draft))}
            className="font-['DM_Sans:SemiBold',sans-serif] font-semibold self-start text-[14px] text-[#247ae4] cursor-pointer">
            ‹ Back
          </button>
        )}
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[#8a8a96]">Step {n} of 4</p>
          <h1 className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[22px] text-[#262630]">{title}</h1>
        </div>
        {state.note && (
          <p role="status" className="rounded-lg bg-[#fff7e6] px-3 py-2 text-[14px] text-[#7a5200]">{noteText(state.note)}</p>
        )}
        {amenity && (step === "date" || step === "time") && (
          <div className="flex items-center gap-3 rounded-[10px] border border-[#cfe0f5] bg-[#f5f9ff] p-2 text-[14px] text-[#262630]">
            <img src={amenity.image} alt="" className="h-10 w-14 rounded-md object-cover" />
            <div>
              <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold">{amenity.name}</p>
              {step === "time" && draft.date && (
                <p className="text-[#6b6b78]">{formatDayLong(draft.date)} · {amenity.hours} hr</p>
              )}
            </div>
          </div>
        )}
        <div className="bl-widget">
          {step === "amenity" && <AmenityGrid dispatch={onWidget} />}
          {step === "date" &&
            (state.calendarMonth ? (
              <MonthCalendar month={state.calendarMonth} state={widgetState} dispatch={onWidget} />
            ) : (
              <DayStrip from={toISODate(now)} count={14} state={widgetState} dispatch={onWidget} />
            ))}
          {step === "time" && draft.amenity && draft.date && (
            <SlotTiles amenity={draft.amenity} date={draft.date} state={widgetState} dispatch={onWidget} />
          )}
          {step === "review" && draft.amenity && draft.date && draft.time !== undefined && (
            <SummaryCard amenity={draft.amenity} date={draft.date} time={draft.time} dispatch={onWidget} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="booking-link min-h-full bg-white">
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col">
        <header className="flex items-center gap-3 border-b border-[#eef0f4] px-4 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f0f4fb] text-[#1D70DC]">
            <AskHoaiIcon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[16px] text-[#262630]">Reserve an amenity</p>
            <p className="text-[13px] text-[#6b6b78]">{RESIDENT_LINE}</p>
          </div>
        </header>
        <main className="flex-1 px-4 py-4">{body}</main>
        <p className="pb-4 text-center text-[11px] text-[#b5b9c2]">Powered by HOAi</p>
      </div>
    </div>
  );
}
