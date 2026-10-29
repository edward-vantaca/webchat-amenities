import { useEffect, useReducer, useRef, useState } from "react";
import { History, ChevronRight, Paperclip, ArrowUp, Info, ChevronsRight } from "lucide-react";
import { COMMON_QUESTIONS, chatReducer, initChat } from "@/booking/chatReducer";
import { toISODate } from "@/booking/dates";
import { interpret } from "@/booking/interpret";
import { WidgetView } from "./widgets/WidgetView";

export function AskHoaiIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="73 0 22 21"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M81.367 16.9752C81.367 15.9135 80.5103 15.0522 79.4544 15.0522H75.6295C75.2788 15.0522 74.992 14.7637 74.992 14.4112V2.8731C74.992 2.52055 75.2788 2.2321 75.6295 2.2321H85.1405C86.4526 2.2321 86.4169 0.309082 85.1405 0.309082H75.6295C74.223 0.309082 73.0795 1.45888 73.0795 2.8731V14.4112C73.0795 15.8254 74.223 16.9752 75.6295 16.9752H79.4544V20.1802C79.4544 20.4246 79.5859 20.6449 79.8051 20.7531C80.0242 20.8613 80.2832 20.8372 80.4744 20.693L81.1558 20.1802L81.359 20.028L81.367 20.02L85.4032 16.9752H90.9295C92.3359 16.9752 93.4795 15.8254 93.4795 14.4112V8.94574C93.4795 7.68622 91.567 7.68622 91.567 8.94574V14.4112C91.567 14.7637 91.2801 15.0522 90.9295 15.0522H85.4032C84.9888 15.0522 84.5864 15.1884 84.2557 15.4368L81.367 17.6162V16.9752Z" />
      <path d="M91.4931 1.44282C91.4173 1.47161 91.3668 1.54443 91.3668 1.62571C91.3668 1.707 91.4173 1.77982 91.4931 1.80861L92.4447 2.16762L92.8017 3.12441C92.8303 3.20063 92.9027 3.25142 92.9836 3.25142C93.0644 3.25142 93.1368 3.20063 93.1655 3.12441L93.5225 2.16762L94.4741 1.80861C94.5499 1.77982 94.6004 1.707 94.6004 1.62571C94.6004 1.54443 94.5499 1.47161 94.4741 1.44282L93.5225 1.08381L93.1655 0.12701C93.1368 0.0508054 93.0644 0 92.9836 0C92.9027 0 92.8303 0.0508054 92.8017 0.12701L92.4447 1.08381L91.4931 1.44282ZM86.134 4.06428C86.0379 4.10833 85.9773 4.20484 85.9773 4.3115C85.9773 4.41824 86.0379 4.51303 86.134 4.55707L86.4203 4.69087L86.5567 4.75349L86.5668 4.7586L88.0539 5.44953L88.7411 6.94317L88.7461 6.95332L88.8085 7.0905L88.9415 7.38005C88.9853 7.47656 89.0813 7.53752 89.1858 7.53752C89.2901 7.53752 89.3862 7.47656 89.4299 7.38005L89.563 7.0905L89.6253 6.95332L89.6303 6.94317L90.3175 5.4478L91.8046 4.7586L91.8148 4.75349L91.9511 4.69087L92.2392 4.55707C92.3352 4.51303 92.3958 4.41651 92.3958 4.3115C92.3958 4.2065 92.3352 4.10998 92.2392 4.06601L91.9511 3.93221L91.8148 3.86952L91.8046 3.86448L90.3175 3.17353L89.632 1.67821L89.627 1.66805L89.5647 1.52919L89.4316 1.23961C89.3878 1.14308 89.2918 1.08212 89.1874 1.08212C89.083 1.08212 88.987 1.14308 88.9432 1.23961L88.8102 1.52919L88.7478 1.66635L88.7427 1.67652L88.0556 3.17184L86.5685 3.86276L86.5584 3.86787L86.4219 3.93048L86.134 4.06428Z" />
    </svg>
  );
}

function AskHoaiWordmark() {
  return (
    <svg
      width="95"
      height="21"
      viewBox="0 0 95 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-auto"
      role="img"
      aria-labelledby="askhoai-wordmark-title"
    >
      <title id="askhoai-wordmark-title">Ask HOAi</title>
      <path
        d="M0.42 15.436L4.275 4.936H5.91L9.765 15.436H8.16L5.085 6.736L1.995 15.436H0.42ZM2.16 12.841L2.58 11.641H7.515L7.935 12.841H2.16ZM14.111 15.616C13.471 15.616 12.911 15.511 12.431 15.301C11.951 15.091 11.571 14.796 11.291 14.416C11.011 14.036 10.841 13.591 10.781 13.081H12.311C12.361 13.321 12.456 13.541 12.596 13.741C12.746 13.941 12.946 14.101 13.196 14.221C13.456 14.341 13.761 14.401 14.111 14.401C14.441 14.401 14.711 14.356 14.921 14.266C15.141 14.166 15.301 14.036 15.401 13.876C15.501 13.706 15.551 13.526 15.551 13.336C15.551 13.056 15.481 12.846 15.341 12.706C15.211 12.556 15.011 12.441 14.741 12.361C14.481 12.271 14.166 12.191 13.796 12.121C13.446 12.061 13.106 11.981 12.776 11.881C12.456 11.771 12.166 11.636 11.906 11.476C11.656 11.316 11.456 11.116 11.306 10.876C11.156 10.626 11.081 10.321 11.081 9.961C11.081 9.531 11.196 9.146 11.426 8.806C11.656 8.456 11.981 8.186 12.401 7.996C12.831 7.796 13.336 7.696 13.916 7.696C14.756 7.696 15.431 7.896 15.941 8.296C16.451 8.696 16.751 9.261 16.841 9.991H15.386C15.346 9.651 15.196 9.391 14.936 9.211C14.676 9.021 14.331 8.926 13.901 8.926C13.471 8.926 13.141 9.011 12.911 9.181C12.681 9.351 12.566 9.576 12.566 9.856C12.566 10.036 12.631 10.196 12.761 10.336C12.891 10.476 13.081 10.596 13.331 10.696C13.591 10.786 13.906 10.871 14.276 10.951C14.806 11.051 15.281 11.176 15.701 11.326C16.121 11.476 16.456 11.696 16.706 11.986C16.956 12.276 17.081 12.691 17.081 13.231C17.091 13.701 16.971 14.116 16.721 14.476C16.481 14.836 16.136 15.116 15.686 15.316C15.246 15.516 14.721 15.616 14.111 15.616ZM23.6021 15.436L20.1221 11.296L23.2721 7.876H25.0871L21.3371 11.881V10.756L25.4921 15.436H23.6021ZM18.8471 15.436V4.636H20.3471V15.436H18.8471ZM37.3452 15.436V4.936H38.8452V15.436H37.3452ZM30.6702 15.436V4.936H32.1702V15.436H30.6702ZM31.9152 10.696V9.466H37.6752V10.696H31.9152ZM45.7663 15.616C44.7563 15.616 43.8663 15.391 43.0963 14.941C42.3363 14.481 41.7363 13.846 41.2963 13.036C40.8663 12.216 40.6513 11.266 40.6513 10.186C40.6513 9.116 40.8663 8.176 41.2963 7.366C41.7363 6.546 42.3363 5.906 43.0963 5.446C43.8663 4.986 44.7563 4.756 45.7663 4.756C46.7963 4.756 47.6963 4.986 48.4663 5.446C49.2363 5.906 49.8313 6.546 50.2513 7.366C50.6813 8.176 50.8963 9.116 50.8963 10.186C50.8963 11.266 50.6813 12.216 50.2513 13.036C49.8313 13.846 49.2363 14.481 48.4663 14.941C47.6963 15.391 46.7963 15.616 45.7663 15.616ZM45.7813 14.281C46.5013 14.281 47.1313 14.116 47.6713 13.786C48.2113 13.456 48.6263 12.986 48.9163 12.376C49.2163 11.766 49.3663 11.036 49.3663 10.186C49.3663 9.336 49.2163 8.606 48.9163 7.996C48.6263 7.386 48.2113 6.921 47.6713 6.601C47.1313 6.271 46.5013 6.106 45.7813 6.106C45.0613 6.106 44.4313 6.271 43.8913 6.601C43.3513 6.921 42.9313 7.386 42.6313 7.996C42.3313 8.606 42.1813 9.336 42.1813 10.186C42.1813 11.036 42.3313 11.766 42.6313 12.376C42.9313 12.986 43.3513 13.456 43.8913 13.786C44.4313 14.116 45.0613 14.281 45.7813 14.281ZM51.3087 15.436L55.1637 4.936H56.7987L60.6537 15.436H59.0487L55.9737 6.736L52.8837 15.436H51.3087ZM53.0487 12.841L53.4687 11.641H58.4037L58.8237 12.841H53.0487ZM62.1797 15.436V7.876H63.6797V15.436H62.1797ZM62.9447 6.451C62.6547 6.451 62.4147 6.361 62.2247 6.181C62.0447 6.001 61.9547 5.771 61.9547 5.491C61.9547 5.221 62.0447 5.001 62.2247 4.831C62.4147 4.651 62.6547 4.561 62.9447 4.561C63.2247 4.561 63.4597 4.651 63.6497 4.831C63.8397 5.001 63.9347 5.221 63.9347 5.491C63.9347 5.771 63.8397 6.001 63.6497 6.181C63.4597 6.361 63.2247 6.451 62.9447 6.451Z"
        fill="#1D70DC"
      />
      <g clipPath="url(#askhoai-wordmark-clip)">
        <mask
          id="askhoai-wordmark-mask"
          maskUnits="userSpaceOnUse"
          x="73"
          y="0"
          width="22"
          height="21"
          style={{ maskType: "luminance" }}
        >
          <path d="M94.6247 0H73.0795V20.872H94.6247V0Z" fill="white" />
        </mask>
        <g mask="url(#askhoai-wordmark-mask)">
          <path
            d="M81.367 16.9752C81.367 15.9135 80.5103 15.0522 79.4544 15.0522H75.6295C75.2788 15.0522 74.992 14.7637 74.992 14.4112V2.8731C74.992 2.52055 75.2788 2.2321 75.6295 2.2321H85.1405C86.4526 2.2321 86.4169 0.309082 85.1405 0.309082H75.6295C74.223 0.309082 73.0795 1.45888 73.0795 2.8731V14.4112C73.0795 15.8254 74.223 16.9752 75.6295 16.9752H79.4544V20.1802C79.4544 20.4246 79.5859 20.6449 79.8051 20.7531C80.0242 20.8613 80.2832 20.8372 80.4744 20.693L81.1558 20.1802L81.359 20.028L81.367 20.02L85.4032 16.9752H90.9295C92.3359 16.9752 93.4795 15.8254 93.4795 14.4112V8.94574C93.4795 7.68622 91.567 7.68622 91.567 8.94574V14.4112C91.567 14.7637 91.2801 15.0522 90.9295 15.0522H85.4032C84.9888 15.0522 84.5864 15.1884 84.2557 15.4368L81.367 17.6162V16.9752Z"
            fill="#1D70DC"
          />
          <path
            d="M91.4931 1.44282C91.4173 1.47161 91.3668 1.54443 91.3668 1.62571C91.3668 1.707 91.4173 1.77982 91.4931 1.80861L92.4447 2.16762L92.8017 3.12441C92.8303 3.20063 92.9027 3.25142 92.9836 3.25142C93.0644 3.25142 93.1368 3.20063 93.1655 3.12441L93.5225 2.16762L94.4741 1.80861C94.5499 1.77982 94.6004 1.707 94.6004 1.62571C94.6004 1.54443 94.5499 1.47161 94.4741 1.44282L93.5225 1.08381L93.1655 0.12701C93.1368 0.0508054 93.0644 0 92.9836 0C92.9027 0 92.8303 0.0508054 92.8017 0.12701L92.4447 1.08381L91.4931 1.44282ZM86.134 4.06428C86.0379 4.10833 85.9773 4.20484 85.9773 4.3115C85.9773 4.41824 86.0379 4.51303 86.134 4.55707L86.4203 4.69087L86.5567 4.75349L86.5668 4.7586L88.0539 5.44953L88.7411 6.94317L88.7461 6.95332L88.8085 7.0905L88.9415 7.38005C88.9853 7.47656 89.0813 7.53752 89.1858 7.53752C89.2901 7.53752 89.3862 7.47656 89.4299 7.38005L89.563 7.0905L89.6253 6.95332L89.6303 6.94317L90.3175 5.4478L91.8046 4.7586L91.8148 4.75349L91.9511 4.69087L92.2392 4.55707C92.3352 4.51303 92.3958 4.41651 92.3958 4.3115C92.3958 4.2065 92.3352 4.10998 92.2392 4.06601L91.9511 3.93221L91.8148 3.86952L91.8046 3.86448L90.3175 3.17353L89.632 1.67821L89.627 1.66805L89.5647 1.52919L89.4316 1.23961C89.3878 1.14308 89.2918 1.08212 89.1874 1.08212C89.083 1.08212 88.987 1.14308 88.9432 1.23961L88.8102 1.52919L88.7478 1.66635L88.7427 1.67652L88.0556 3.17184L86.5685 3.86276L86.5584 3.86787L86.4219 3.93048L86.134 4.06428Z"
            fill="#1D70DC"
          />
        </g>
      </g>
      <defs>
        <clipPath id="askhoai-wordmark-clip">
          <rect width="21.5453" height="20.872" fill="white" transform="translate(73.0795)" />
        </clipPath>
      </defs>
    </svg>
  );
}

// Docked on the right of the portal at lg+.
export default function AskHoaiPanel() {
  const [state, dispatch] = useReducer(chatReducer, new Date(), initChat);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasConversation = state.messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || state.pending) return;
    dispatch({ type: "userText", text });
    setInput("");
    interpret(text, { draft: state.draft, today: toISODate(state.now), history: state.messages }).then(
      (result) => dispatch({ type: "interpreted", result }),
      () => dispatch({ type: "interpretFailed" }),
    );
  }

  const chatInput = (
    <ChatInput input={input} onChange={setInput} onSend={handleSend} pending={state.pending} />
  );

  return (
    <aside data-ux-id="askhoai-panel" className="hidden lg:flex w-[400px] shrink-0 h-full">
      <div className="flex flex-col h-full w-full bg-white border-l border-[#e5eaf0]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5eaf0]">
          <AskHoaiWordmark />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md border border-[#e5eaf0] text-[#262630] hover:bg-black/[0.03]"
            >
              <History size={14} /> History
            </button>
            <button
              type="button"
              aria-label="Collapse panel"
              className="p-1.5 rounded-md border border-[#e5eaf0] text-[#262630] hover:bg-black/[0.03]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {hasConversation ? (
          <>
            <div
              ref={scrollRef}
              data-ash-section="thread"
              className="flex-1 overflow-y-auto px-5 pt-6 pb-4 flex flex-col gap-3"
            >
              {state.messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-3">
                  {m.text && <MessageBubble role={m.role} text={m.text} />}
                  {m.widget && <WidgetView message={m} state={state} dispatch={dispatch} />}
                </div>
              ))}
            </div>
            <div data-ash-section="input" className="mx-5 mb-5 border-2 border-[#247ae4] rounded-xl p-3 bg-white">
              {chatInput}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
            <div data-ash-section="welcome">
              <h2 className="font-['DM_Sans:Bold',sans-serif] font-bold text-[22px] text-[#262630] leading-tight">
                Welcome back, Alex Johnson
              </h2>
              <p className="text-[13px] text-[#5a5a66] mt-1">How can I help you today?</p>
            </div>

            {/* Input */}
            <div data-ash-section="input" className="mt-5 border-2 border-[#247ae4] rounded-xl p-3 bg-white">
              {chatInput}
            </div>

            {/* Common questions */}
            <div data-ash-section="questions">
              <p className="text-[11px] font-semibold text-[#8a8a96] tracking-[0.1em] mt-6 mb-3">
                COMMON QUESTIONS:
              </p>
              <div className="flex flex-col gap-2">
                {COMMON_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => dispatch({ type: "commonQuestion", text: q })}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#f4f6f9] hover:bg-[#e8ecf3] text-left text-[13px] leading-snug text-[#262630]"
                  >
                    <span className="flex-1">{q}</span>
                    <ChevronsRight size={14} className="text-[#8a8a96] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#e5eaf0]">
          <p className="text-center text-[11px] text-[#8a8a96] mb-2">Powered by HOAi</p>
          <div className="flex items-start gap-2 px-3 py-2 border border-[#e5eaf0] rounded-md">
            <Info size={14} className="text-[#8a8a96] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#5a5a66] leading-snug">
              AI-generated responses may contain errors. Please verify before acting.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({ role, text }: { role: "user" | "agent"; text: string }) {
  if (role === "user") {
    return (
      <div className="self-end max-w-[80%]">
        <div className="bg-[#247ae4] text-white text-[14px] leading-relaxed rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="self-start max-w-[85%] flex items-start gap-2">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[#f0f4fb] text-[#1D70DC] grid place-items-center">
        <AskHoaiIcon className="w-4 h-4" />
      </div>
      <div className="bg-[#f4f6f9] text-[#262630] text-[14px] leading-relaxed rounded-2xl rounded-bl-md px-4 py-2.5 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function ChatInput({
  input,
  onChange,
  onSend,
  pending,
}: {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  pending: boolean;
}) {
  return (
    <>
      <textarea
        value={input}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={pending}
        placeholder="Hello! How can I help you today?"
        className="w-full resize-none outline-none text-[14px] placeholder:text-[#9a9aa6] bg-transparent"
        rows={2}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1a1a24] text-white text-[13px] rounded-full hover:bg-black"
        >
          <Paperclip size={13} /> Attach
        </button>
        <button
          type="button"
          onClick={onSend}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#247ae4] text-white text-[13px] rounded-full hover:bg-[#1d6fd4] disabled:bg-[#8ab6ec] disabled:opacity-70"
          disabled={!input.trim() || pending}
        >
          <ArrowUp size={13} /> Send
        </button>
      </div>
    </>
  );
}
