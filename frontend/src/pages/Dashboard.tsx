import { RefreshCw } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Toolbar } from "../components/Toolbar";
import { money, time } from "../lib/api";
import { useDemo } from "./useDemo";

function shortDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function SavingsChart({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.amount));
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Saved money by day</h3>
          <p className="text-sm text-slate-500">Accepted moves only</p>
        </div>
      </div>
      <div className="mt-6 flex h-56 items-end gap-3 border-b border-l border-slate-200 px-3 pb-3">
        {data.map((item) => (
          <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
            <div className="text-center text-xs font-semibold text-slate-500">{money(item.amount)}</div>
            <div className="mx-auto w-full max-w-12 rounded-t-md bg-accent-600" style={{ height: `${Math.max(6, (item.amount / max) * 150)}px` }} />
            <div className="truncate text-center text-xs text-slate-400">{shortDay(item.date)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfferPie({ accepted, declined, sent, expired }: { accepted: number; declined: number; sent: number; expired: number }) {
  const total = Math.max(1, accepted + declined + sent + expired);
  const acceptedEnd = (accepted / total) * 100;
  const declinedEnd = acceptedEnd + (declined / total) * 100;
  const sentEnd = declinedEnd + (sent / total) * 100;
  const background = `conic-gradient(#24958c 0 ${acceptedEnd}%, #f59e0b ${acceptedEnd}% ${declinedEnd}%, #64748b ${declinedEnd}% ${sentEnd}%, #cbd5e1 ${sentEnd}% 100%)`;
  const rows = [
    { label: "Accepted", value: accepted, color: "bg-accent-600" },
    { label: "Declined", value: declined, color: "bg-amber-500" },
    { label: "Sent", value: sent, color: "bg-slate-500" },
    { label: "Expired", value: expired, color: "bg-slate-300" },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="text-lg font-semibold text-slate-950">Offer outcome mix</h3>
      <p className="text-sm text-slate-500">How generated offers are converting</p>
      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background }}>
          <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center">
            <span className="text-2xl font-semibold text-slate-950">{accepted + declined + sent + expired}</span>
            <span className="text-xs text-slate-500">offers</span>
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-600">
                <span className={`h-3 w-3 rounded-sm ${row.color}`} />
                {row.label}
              </span>
              <span className="font-semibold text-slate-950">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const demo = useDemo();
  const metrics = demo.schedule?.metrics;
  const dailySavings = metrics?.dailySavings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Demo overview</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-950">Today&apos;s schedule health</h2>
        </div>
        <button onClick={() => demo.refresh()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <Toolbar
        businesses={demo.businesses}
        staff={demo.schedule?.staff ?? []}
        businessId={demo.businessId}
        staffId={demo.staffId}
        date={demo.date}
        onBusiness={(value) => {
          demo.setBusinessId(value);
          demo.refresh(value, demo.date, undefined);
        }}
        onStaff={(value) => {
          demo.setStaffId(value);
          demo.refresh(demo.businessId, demo.date, value);
        }}
        onDate={(value) => {
          demo.setDate(value);
          demo.refresh(demo.businessId, value, demo.staffId);
        }}
        onSeed={demo.seed}
      />
      {demo.error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{demo.error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bookings today" value={metrics?.totalBookingsToday ?? 0} />
        <StatCard label="Idle minutes detected" value={metrics?.detectedIdleMinutes ?? 0} />
        <StatCard label="Potential saved cost" value={money(metrics?.estimatedSavedCost)} hint="If all current suggestions are accepted" />
        <StatCard label="Actual saved cost" value={money(metrics?.actualSavedCost)} hint="Accepted offers only" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SavingsChart data={dailySavings} />
        <OfferPie
          accepted={metrics?.acceptedOffers ?? 0}
          declined={metrics?.declinedOffers ?? 0}
          sent={metrics?.sentOffers ?? 0}
          expired={metrics?.expiredOffers ?? 0}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-950">Generated offers</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="All" value={metrics?.generatedOffers ?? 0} />
            <StatCard label="Accepted" value={metrics?.acceptedOffers ?? 0} />
            <StatCard label="Declined" value={metrics?.declinedOffers ?? 0} />
            <StatCard label="Sent" value={metrics?.sentOffers ?? 0} />
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-950">Next suggested move</h3>
          {demo.schedule?.candidates[0] ? (
            <div className="mt-4 rounded-lg bg-accent-50 p-4">
              <p className="text-sm font-semibold text-accent-700">
                {demo.schedule.candidates[0].customer_name} from {time(demo.schedule.candidates[0].old_start)} to {time(demo.schedule.candidates[0].suggested_start)}
              </p>
              <p className="mt-2 text-sm text-slate-600">{demo.schedule.candidates[0].reason}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{demo.loading ? "Loading..." : "No eligible move right now."}</p>
          )}
        </section>
      </div>
    </div>
  );
}

