import { CURRENT_BALANCE, FEED_POSTS, INBOX_MESSAGES, RECENT_TRANSACTIONS } from "./data";
import { IconBell, IconChevronDown, IconChevronRight, IconQuestion } from "@/components/icons";

/* ─── Address / User Card ─── */
function AddressCard() {
  return (
    <div data-ux-id="address-card" className="bg-white drop-shadow-[0px_2px_9px_rgba(18,17,48,0.09)] flex gap-[13px] items-center pl-[15px] pr-[21px] py-[12px] rounded-[18px] shrink-0 w-[380px]">
      <div className="relative shrink-0 size-[52px]">
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <img src="/Mask_group.png" alt="" className="w-full h-full object-cover" />
        </div>
        <svg className="absolute" style={{ left: 12, right: 0, bottom: 0, top: 12 }} width="27" height="27" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#f03434" stroke="none"/>
        </svg>
      </div>
      <div className="flex flex-[1_0_0] flex-col gap-[3px] items-start min-w-px">
        <p className="font-['DM_Sans:Bold',sans-serif] font-bold leading-normal text-[#262630] text-[16px] w-full" style={{ fontVariationSettings: '"opsz" 14' }}>Waterfront</p>
        <div className="font-['DM_Sans:Medium',sans-serif] font-medium opacity-65 text-[#262630] text-[14px]" style={{ fontVariationSettings: '"opsz" 14' }}>
          <p className="leading-[16px] mb-0">151225 77th Rd N</p>
          <p className="leading-[16px]">Loxahatchee, FL 33470</p>
        </div>
      </div>
      <span className="text-[#262630]"><IconChevronDown /></span>
    </div>
  );
}

/* ─── Dashboard Page ─── */
export default function DashboardPage({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <div data-ux-id="dashboard-page" className="flex-1 min-w-0 h-full overflow-y-auto">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-[16px] py-[14px] bg-white border-b border-[#d9ecf8] shrink-0">
        <button onClick={onOpenSidebar} data-ux-id="dashboard-mobile-menu-button" className="w-[36px] h-[36px] flex items-center justify-center rounded-[8px] hover:bg-[#f0f5fa]" aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="#262630" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[17px]" style={{ fontVariationSettings: '"opsz" 14' }}>Dashboard</p>
        <div className="w-[36px]" />
      </div>

      <div className="flex flex-col gap-[24px] md:gap-[32px] w-full max-w-[1280px] mx-auto pb-[44px] pt-[20px] md:pt-[31px] px-[16px] md:px-[44px] min-w-0">
        {/* Header — desktop only */}
        <div className="hidden md:flex items-center justify-between w-full shrink-0">
          <div className="flex flex-col flex-1 min-w-0">
            <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[28px] leading-normal" style={{ fontVariationSettings: '"opsz" 14' }}>
              Dashboard
            </p>
            <p className="font-['DM_Sans:Regular',sans-serif] font-normal text-[#262630] opacity-70 text-[16px] leading-normal" style={{ fontVariationSettings: '"opsz" 14' }}>
              The latest and greatest from your community
            </p>
          </div>
          <AddressCard />
        </div>

        {/* Election Alert Banner */}
        <div data-ux-id="election-banner" className="bg-white rounded-[14px] md:rounded-[18px] shadow-[0px_2px_18px_0px_rgba(18,17,48,0.07)] w-full shrink-0 flex items-center">
          <div className="flex gap-[10px] items-start md:items-center px-[16px] md:px-[26px] py-[14px] md:py-[20px] w-full">
            <span className="text-[#247ae4] shrink-0 mt-[2px] md:mt-0"><IconBell width={14} height={14} /></span>
            <p className="flex-1 font-['DM_Sans:Regular',sans-serif] font-normal text-[14px] md:text-[15px] min-w-0 leading-snug" style={{ fontVariationSettings: '"opsz" 14' }}>
              <span className="text-[#262630]">You have </span>
              <span>a upcoming board election. Go to the </span>
              <button data-ux-id="election-banner-link" className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#247ae4] underline underline-offset-2 cursor-pointer" style={{ fontVariationSettings: '"opsz" 14' }}>Elections</button>
              {" "}
              <span>page to submit your vote.</span>
            </p>
          </div>
        </div>

        {/* Payments + Transactions row */}
        <div className="flex flex-col md:flex-row gap-[20px] md:gap-[32px] w-full shrink-0">
          {/* Payments widget */}
          <div
            data-ux-id="payments-widget"
            className="bg-white rounded-[18px] border border-[#d9e7f0] drop-shadow-[0px_2px_9px_rgba(18,17,48,0.07)] flex-1 min-w-0"
          >
            <div className="flex flex-col gap-[14px] pb-[18px] pt-[20px] md:pt-[24px] px-[16px] md:px-[26px]">
              <div className="flex items-center justify-between w-full gap-[8px]">
                <p className="flex-1 font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[20px] leading-normal min-w-0" style={{ fontVariationSettings: '"opsz" 14' }}>Payments</p>
                <div className="flex gap-[6px] items-center text-right shrink-0">
                  <p className="font-['DM_Sans:Medium',sans-serif] font-medium text-[13px] md:text-[15px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Account #: 4329980</p>
                  <span className="text-[14px]"><IconChevronDown /></span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-[16px] md:gap-[22px] w-full">
                <div className="flex flex-row md:flex-col gap-[20px] md:gap-[20px] flex-1 min-w-0 justify-between md:justify-start">
                  <div>
                    <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[28px] md:text-[34px] leading-normal" style={{ fontVariationSettings: '"opsz" 14' }}>{CURRENT_BALANCE}</p>
                    <div className="flex gap-[4px] items-center text-[14px]">
                      <p className="font-['DM_Sans:Regular',sans-serif] font-normal opacity-62 text-[#262630] text-[13px] md:text-[14px]" style={{ fontVariationSettings: '"opsz" 14' }}>Current Balance</p>
                      <span className="text-[#262630]"><IconQuestion /></span>
                    </div>
                  </div>
                  <div>
                    <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[22px] md:text-[24px] leading-normal" style={{ fontVariationSettings: '"opsz" 14' }}>$0.00</p>
                    <div className="flex gap-[4px] items-center text-[14px]">
                      <p className="font-['DM_Sans:Regular',sans-serif] font-normal opacity-62 text-[#262630] text-[13px] md:text-[14px]" style={{ fontVariationSettings: '"opsz" 14' }}>Upcoming Charges</p>
                      <span className="text-[#262630]"><IconQuestion /></span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-[12px] md:gap-[22px] md:items-end pb-0 md:pb-[11px] md:pt-[14px] md:shrink-0">
                  <button data-ux-id="payments-make-payment-button" className="bg-[#247ae4] flex items-center justify-center px-[24px] py-[10px] rounded-[8px] hover:bg-[#1a6ed0] w-full md:w-auto">
                    <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-white text-[16px] text-center whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Make a Payment</span>
                  </button>
                  <div className="flex flex-row md:flex-col gap-[16px] md:gap-[10px] md:items-end items-center">
                    <div className="flex gap-[7px] items-center">
                      <div data-ux-id="payments-autopay-toggle" className="bg-[#b8bec5] rounded-[8px] w-[34px] h-[18px] flex items-center px-[2px] shrink-0">
                        <div className="bg-white rounded-[6px] w-[14px] h-[14px]" />
                      </div>
                      <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[13px] md:text-[14px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Enroll in AutoPay</span>
                    </div>
                    <p data-ux-id="payments-manage-payments-link" className="font-['DM_Sans:Medium',sans-serif] font-medium text-[#247ae4] text-[13px] md:text-[14px] whitespace-nowrap cursor-pointer hover:underline" style={{ fontVariationSettings: '"opsz" 14' }}>Manage payments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions widget */}
          <div data-ux-id="transactions-widget" className="bg-white rounded-[18px] drop-shadow-[0px_2px_9px_rgba(18,17,48,0.07)] flex-1 min-w-0">
            <div className="flex flex-col gap-[24px] px-[16px] md:px-[26px] py-[20px] md:py-[24px]">
              <div className="flex gap-[14px] items-start w-full">
                <p className="flex-1 font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[20px] leading-normal min-w-0" style={{ fontVariationSettings: '"opsz" 14' }}>Recent Transactions</p>
                <div data-ux-id="transactions-view-all-link" className="flex gap-[7px] items-center text-[#0d5bba] text-[14px] whitespace-nowrap cursor-pointer">
                  <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: '"opsz" 14' }}>View All</span>
                  <IconChevronRight />
                </div>
              </div>
              <div className="w-full flex flex-col gap-[11px]">
                {RECENT_TRANSACTIONS.map((tx, i) => (
                  <div key={i} data-ux-id={`transactions-row-${tx.date.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <div className="flex gap-[22px] items-center w-full">
                      <div className="flex items-start opacity-65 w-[70px] shrink-0">
                        <p className="font-['DM_Sans:Medium',sans-serif] font-medium text-[#262630] text-[12px] leading-normal whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>{tx.date}</p>
                      </div>
                      <p className="flex-1 font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[15px] leading-normal min-w-0" style={{ fontVariationSettings: '"opsz" 14' }}>{tx.desc}</p>
                      <p className="font-['DM_Sans:Regular',sans-serif] font-normal text-[#262630] text-[13px] w-[32px]" style={{ fontVariationSettings: '"opsz" 14' }}>PAID</p>
                      <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[16px] text-right whitespace-nowrap w-[67px]" style={{ fontVariationSettings: '"opsz" 14' }}>{tx.amount}</p>
                    </div>
                    {i < 2 && <div className="bg-[#d9d9d9] h-px w-full mt-[11px]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Community Feed widget */}
        <div data-ux-id="dashboard-community-feed-widget" className="bg-white rounded-[18px] drop-shadow-[0px_2px_9px_rgba(18,17,48,0.07)] w-full shrink-0">
          <div className="flex flex-col gap-[18px] md:gap-[22px] px-[16px] md:px-[26px] py-[20px] md:py-[24px]">
            <div className="flex gap-[14px] items-center w-full">
              <p className="flex-1 font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[20px] leading-normal min-w-0" style={{ fontVariationSettings: '"opsz" 14' }}>Community Feed</p>
              <button data-ux-id="dashboard-community-feed-view-all-link" className="flex gap-[7px] items-center text-[#0d5bba] text-[14px] whitespace-nowrap cursor-pointer">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: '"opsz" 14' }}>View All Posts</span>
                <IconChevronRight />
              </button>
            </div>
            <div className="flex flex-col gap-[18px] md:gap-[22px]">
              {FEED_POSTS.map((post, i, arr) => (
                  <div key={post.id}>
                    <div data-ux-id={`dashboard-community-feed-post-${post.id}`} className="flex gap-[14px] md:gap-[18px] items-start w-full">
                      <img
                        src={post.image}
                        alt={post.imageAlt ?? ""}
                        className="w-[120px] h-[90px] md:w-[160px] md:h-[110px] rounded-[12px] object-cover shrink-0"
                        style={{ objectPosition: post.imagePosition }}
                      />
                      <div className="flex flex-col gap-[6px] min-w-0 flex-1">
                        <p className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[15px] leading-[1.25]" style={{ fontVariationSettings: '"opsz" 14' }}>
                          {post.title}
                        </p>
                        <p className="font-['DM_Sans:Regular',sans-serif] font-normal text-[#262630] opacity-65 text-[13px] leading-[1.4] line-clamp-2" style={{ fontVariationSettings: '"opsz" 14' }}>
                          {post.body}
                        </p>
                        {post.links && post.links.length > 0 && (
                          <div className="flex flex-wrap gap-[7px] mt-[2px]">
                            {post.links.map((link, linkIdx) => (
                              <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                data-ux-id={`dashboard-community-feed-post-${post.id}-link-${linkIdx}`}
                                className="max-w-full truncate rounded-full bg-[#e8f1f6] px-[12px] py-[5px] font-['DM_Sans:SemiBold',sans-serif] text-[12px] font-semibold leading-[1.2] text-[#262630] hover:bg-[#d9eaf3] hover:text-[#247ae4]"
                              >
                                {link.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {i < arr.length - 1 && <div className="bg-[#d9d9d9] h-px w-full mt-[18px] md:mt-[22px]" />}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Inbox widget */}
        <div data-ux-id="inbox-widget" className="bg-white rounded-[18px] drop-shadow-[0px_2px_9px_rgba(18,17,48,0.07)] w-full shrink-0">
          <div className="flex flex-col gap-[20px] md:gap-[24px] px-[16px] md:px-[26px] py-[20px] md:py-[24px]">
            <div className="flex gap-[14px] items-center w-full">
              <p className="flex-1 font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[20px] leading-normal min-w-0" style={{ fontVariationSettings: '"opsz" 14' }}>Inbox</p>
              <div data-ux-id="inbox-view-all-link" className="flex gap-[7px] items-center text-[#0d5bba] text-[14px] whitespace-nowrap cursor-pointer">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: '"opsz" 14' }}>View All</span>
                <IconChevronRight />
              </div>
            </div>
            {/* Filter chips */}
            <div className="flex flex-wrap gap-[9px] items-center">
              <div data-ux-id="inbox-filter-all" className="bg-[#247ae4] rounded-[50px] flex items-center gap-[10px] pl-[15px] pr-[7px] py-[8px]">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-white text-[14px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>All</span>
                <div className="bg-[rgba(255,255,255,0.3)] rounded-[50px] size-[19px] flex items-center justify-center">
                  <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-white text-[13px]" style={{ fontVariationSettings: '"opsz" 14' }}>21</span>
                </div>
              </div>
              <div data-ux-id="inbox-filter-needs-attention" className="bg-[#fff0dd] rounded-[50px] flex items-center gap-[10px] pl-[15px] pr-[7px] py-[8px]">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[14px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Needs Attention</span>
                <div className="bg-[#f17d11] rounded-[50px] size-[19px] flex items-center justify-center">
                  <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-white text-[13px]" style={{ fontVariationSettings: '"opsz" 14' }}>3</span>
                </div>
              </div>
              <div data-ux-id="inbox-filter-announcements" className="bg-[#dfeaf0] rounded-[50px] flex items-center gap-[10px] pl-[15px] pr-[7px] py-[8px]">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[14px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Announcements</span>
                <div className="bg-white rounded-[50px] size-[19px] flex items-center justify-center">
                  <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[13px]" style={{ fontVariationSettings: '"opsz" 14' }}>5</span>
                </div>
              </div>
              <div data-ux-id="inbox-filter-messages" className="bg-[#dfeaf0] rounded-[50px] flex items-center gap-[10px] pl-[15px] pr-[7px] py-[8px]">
                <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[14px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>Messages</span>
                <div className="bg-white rounded-[50px] size-[19px] flex items-center justify-center">
                  <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[13px]" style={{ fontVariationSettings: '"opsz" 14' }}>3</span>
                </div>
              </div>
            </div>
            {/* Inbox rows */}
            <div className="w-full border-t border-[#d9d9d9]">
              {INBOX_MESSAGES.map((msg, i) => (
                <div key={i} data-ux-id={`inbox-row-${msg.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`} className="border-b border-[#d9d9d9] flex items-center cursor-pointer hover:bg-[#f9fbfd]">
                  <div className="flex gap-[12px] md:gap-[29px] items-center px-[14px] md:px-[22px] py-[12px] md:py-[14px] w-full">
                    <div className="shrink-0 size-[8px]">
                      {msg.unread && (
                        <svg data-ux-id="inbox-row-unread-dot" width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <circle cx="4" cy="4" r="4" fill="#247AE4"/>
                        </svg>
                      )}
                    </div>
                    <p
                      className={`text-[13px] md:text-[14px] w-[80px] md:w-[120px] shrink-0 ${msg.unread ? "font-['DM_Sans:Medium',sans-serif] font-medium" : "font-['DM_Sans:Regular',sans-serif] font-normal opacity-70"}`}
                      style={{ fontVariationSettings: '"opsz" 14' }}
                    >
                      {msg.type}
                    </p>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex gap-[3px] items-center text-[14px] whitespace-nowrap overflow-hidden">
                        <span
                          className={`shrink-0 ${msg.unread ? "font-['DM_Sans:Bold',sans-serif] font-bold" : "font-['DM_Sans:Regular',sans-serif] font-normal opacity-70"}`}
                          style={{ fontVariationSettings: '"opsz" 14' }}
                        >
                          {msg.title}
                        </span>
                        <span className="opacity-70 overflow-hidden text-ellipsis flex-1 min-w-0 font-['DM_Sans:Regular',sans-serif]" style={{ fontVariationSettings: '"opsz" 14' }}>
                          {" -- "}{msg.preview}
                        </span>
                      </div>
                    </div>
                    <div className="hidden md:flex shrink-0 w-[80px] items-center justify-end">
                      {msg.tagBg !== "transparent" ? (
                        <div className="rounded-[50px] px-[10px] py-[2px]" style={{ backgroundColor: msg.tagBg }}>
                          <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[13px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>{msg.tag}</span>
                        </div>
                      ) : (
                        <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#262630] text-[13px] whitespace-nowrap" style={{ fontVariationSettings: '"opsz" 14' }}>{msg.tag}</span>
                      )}
                    </div>
                    <p
                      className={`hidden md:block text-[14px] w-[64px] shrink-0 whitespace-nowrap ${msg.unread ? "font-['DM_Sans:Bold',sans-serif] font-bold" : "font-['DM_Sans:Regular',sans-serif] font-normal opacity-70"}`}
                      style={{ fontVariationSettings: '"opsz" 14' }}
                    >
                      {msg.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
