import imgBranding from "@/assets/Branding.svg";
import { unreadInboxCount } from "@/dashboard/data";
import {
  IconBellConcierge,
  IconCalendar,
  IconDirectory,
  IconDocuments,
  IconFeed,
  IconHome,
  IconInbox,
  IconLogout,
  IconOffers,
  IconPayments,
  IconPlus,
  IconProfile,
  IconRequests,
  IconVote,
} from "./icons";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
  uxId: string;
}

function NavItem({ icon, label, badge, active, uxId }: NavItemProps) {
  return (
    <button
      data-ux-id={`sidebar-nav-${uxId}`}
      className={`w-full rounded-[8px] flex items-center gap-[12px] pl-[10px] pr-[22px] py-[8px] cursor-pointer ${
        active ? "bg-[#e8f1fd]" : "hover:bg-[#f2f6fa]"
      }`}
    >
      <span className="flex items-center justify-center size-[24px]" style={{ color: active ? "#247ae4" : "#262630" }}>
        {icon}
      </span>
      <span
        className={`font-['DM_Sans:Medium',sans-serif] font-medium text-[14px] flex-1 text-left whitespace-nowrap ${active ? "text-[#247ae4]" : "text-[#262630]"}`}
        style={{ fontVariationSettings: '"opsz" 14' }}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span data-ux-id="sidebar-nav-badge" className="bg-[#247ae4] rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
          <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-white text-[12px] px-[3px]" style={{ fontVariationSettings: '"opsz" 14' }}>
            {badge}
          </span>
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <div data-ux-id="sidebar" className="bg-white h-screen md:h-full shrink-0 w-[280px] md:w-[265px] border-r border-[#d9ecf8] flex flex-col overflow-hidden shadow-xl md:shadow-none">
      <div className="flex flex-col gap-[42px] items-center px-[26px] py-[40px] flex-1 overflow-y-auto">
        {/* Mobile close button */}
        <button
          onClick={onClose}
          data-ux-id="sidebar-close-button"
          className="md:hidden self-end -mt-[28px] -mr-[10px] w-[32px] h-[32px] flex items-center justify-center rounded-full text-[#262630] opacity-40 hover:opacity-70"
          aria-label="Close menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        {/* Branding */}
        <div data-ux-id="sidebar-logo" className="flex flex-col items-center shrink-0">
          <img src={imgBranding} alt="Waterfront Community Estates" className="object-contain" style={{ height: "80px" }} />
        </div>

        {/* Quick Actions */}
        <button
          data-ux-id="sidebar-quick-actions"
          className="w-full flex items-center justify-center gap-[10px] px-[23px] py-[12px] rounded-[8px] border border-[#247ae4] hover:bg-[#f0f7ff] shrink-0"
        >
          <span className="text-[#247ae4] flex items-center"><IconPlus /></span>
          <span className="font-['DM_Sans:SemiBold',sans-serif] font-semibold text-[#247ae4] text-[14px]" style={{ fontVariationSettings: '"opsz" 14' }}>
            Quick Actions
          </span>
        </button>

        {/* Nav Items */}
        <div data-ux-id="sidebar-nav-list" className="flex flex-col gap-[13px] w-full shrink-0">
          <NavItem icon={<IconInbox />} label="Inbox" badge={unreadInboxCount} uxId="inbox" />
          <NavItem icon={<IconHome />} label="Home" active uxId="home" />
          <NavItem icon={<IconPayments />} label="Payments" uxId="payments" />
          <NavItem icon={<IconVote />} label="Elections" badge={1} uxId="elections" />
          <NavItem icon={<IconFeed />} label="Community Feed" uxId="community-feed" />
          <NavItem icon={<IconBellConcierge />} label="Reservations" uxId="reservations" />
          <NavItem icon={<IconRequests />} label="Requests" uxId="requests" />
          <NavItem icon={<IconOffers />} label="Offers" uxId="offers" />
          <NavItem icon={<IconDocuments />} label="Documents" uxId="documents" />
          <NavItem icon={<IconDirectory />} label="Directory" uxId="directory" />
          <NavItem icon={<IconCalendar />} label="Calendar" uxId="calendar" />

          {/* Divider */}
          <div className="w-full border-t border-[#d9e7f0] my-[9px]" />

          <NavItem icon={<IconProfile />} label="My Profile" uxId="profile" />
          <NavItem icon={<IconLogout />} label="Log Out" uxId="logout" />
        </div>
      </div>
    </div>
  );
}
