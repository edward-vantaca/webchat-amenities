import type { Chip, ChatEvent } from "../../booking/types";

export function ChipRow({
  chips,
  messageId,
  dispatch,
}: {
  chips: Chip[];
  messageId: number;
  dispatch: (e: ChatEvent) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => dispatch({ ...c.event, from: messageId } as ChatEvent)}
          className="font-['DM_Sans:SemiBold',sans-serif] font-semibold rounded-full border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] text-[#262630] hover:border-[#247ae4] cursor-pointer"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
