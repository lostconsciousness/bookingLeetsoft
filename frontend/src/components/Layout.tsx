import { CalendarClock, Gauge, Inbox, LayoutGrid, MessagesSquare, Settings, Sparkles, Zap } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "../i18n/I18nContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

const nav = [
  { to: "/", labelKey: "nav.overview" as const, icon: Gauge },
  { to: "/optimizer", labelKey: "nav.optimize" as const, icon: CalendarClock },
  { to: "/offers", labelKey: "nav.offers" as const, icon: MessagesSquare },
  { to: "/inbox", labelKey: "nav.inbox" as const, icon: Inbox },
  { to: "/smart-booking", labelKey: "nav.smartBooking" as const, icon: Sparkles },
  { to: "/settings", labelKey: "nav.settings" as const, icon: Settings },
  { to: "/widget-demo", labelKey: "nav.widgetDemo" as const, icon: LayoutGrid },
];

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-accent-900 px-5 py-6 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-accent-700 shadow-lg"><Zap className="h-5 w-5" /></div>
          <div><p className="text-base font-semibold tracking-tight">Leetsoft Booking</p><p className="text-xs text-emerald-100/70">{t("layout.tagline")}</p></div>
        </div>
        <nav aria-label={t("layout.primaryNav")} className="mt-10 space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-white text-accent-900 shadow-sm" : "text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{t(item.labelKey)}</NavLink>;
          })}
        </nav>
        <LanguageSwitcher className="mt-6" />
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" /> {t("layout.investorDemo")}</div>
          <p className="mt-2 text-xs leading-5 text-emerald-50/60">{t("layout.investorNote")}</p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-accent-900"><Zap className="h-5 w-5" /> Leetsoft Booking</div>
            <LanguageSwitcher variant="light" />
          </div>
          <div className="relative -mx-4">
            <nav aria-label={t("layout.primaryNav")} className="flex gap-2 overflow-x-auto px-4 pb-1">
              {nav.map((item) => <NavLink key={item.to} to={item.to} className={({isActive}) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-accent-900 text-white" : "bg-slate-100 text-slate-600"}`}>{t(item.labelKey)}</NavLink>)}
            </nav>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/95 to-transparent" aria-hidden="true" />
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><Outlet /></main>
      </div>
    </div>
  );
}
