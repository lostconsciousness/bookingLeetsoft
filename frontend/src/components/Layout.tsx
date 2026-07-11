import { CalendarClock, Gauge, Inbox, MessagesSquare, Settings, Sparkles, Zap } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/optimizer", label: "Optimize", icon: CalendarClock },
  { to: "/offers", label: "Offers", icon: MessagesSquare },
  { to: "/inbox", label: "Customer view", icon: Inbox },
  { to: "/smart-booking", label: "Smart booking", icon: Sparkles },
  { to: "/settings", label: "Policy", icon: Settings },
];

export function Layout() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-accent-900 px-5 py-6 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-accent-700 shadow-lg"><Zap className="h-5 w-5" /></div>
          <div><p className="text-base font-semibold tracking-tight">Leetsoft Booking</p><p className="text-xs text-emerald-100/70">Schedule intelligence</p></div>
        </div>
        <nav className="mt-10 space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-white text-accent-900 shadow-sm" : "text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{item.label}</NavLink>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Investor demo</div>
          <p className="mt-2 text-xs leading-5 text-emerald-50/60">All provider actions are safely simulated.</p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mb-3 flex items-center gap-2 font-semibold text-accent-900"><Zap className="h-5 w-5" /> Leetsoft Booking</div>
          <div className="flex gap-2 overflow-x-auto pb-1">{nav.map((item) => <NavLink key={item.to} to={item.to} className={({isActive}) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-accent-900 text-white" : "bg-slate-100 text-slate-600"}`}>{item.label}</NavLink>)}</div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><Outlet /></main>
      </div>
    </div>
  );
}
