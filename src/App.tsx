import { useState } from "react";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./dashboard/DashboardPage";
import AskHoaiPanel from "./chat/AskHoaiPanel";

/* ─── Resident portal: sidebar | dashboard | Ask HOAi panel ─── */
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div data-ux-id="app-shell" className="bg-gradient-to-b from-[#edf9f2] to-[#ddf2ff] flex h-full w-full overflow-hidden relative">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          data-ux-id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar — desktop always visible, mobile opens as an overlay */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex min-w-0">
        <DashboardPage onOpenSidebar={() => setSidebarOpen(true)} />
      </div>
      <AskHoaiPanel />
    </div>
  );
}
