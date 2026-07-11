import { CalendarClock, Gauge, Inbox, MessagesSquare, Settings, Sparkles } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/optimizer", label: "Optimizer", icon: CalendarClock },
  { to: "/offers", label: "Offers", icon: MessagesSquare },
  { to: "/inbox", label: "Customer Inbox", icon: Inbox },
  { to: "/smart-booking", label: "Smart Booking", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">SlotLift</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Schedule Optimizer</h1>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex gap-2 overflow-auto">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600">
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

