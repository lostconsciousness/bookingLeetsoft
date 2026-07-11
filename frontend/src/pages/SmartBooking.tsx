import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "../components/StatCard";
import { api, dateTimeLocal, money, Quote } from "../lib/api";
import { useDemo } from "./useDemo";

function inputTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function overlaps(start: Date, end: Date, bookingStart: string, bookingEnd: string) {
  return start < new Date(bookingEnd) && end > new Date(bookingStart);
}

export default function SmartBooking() {
  const demo = useDemo();
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [staffId, setStaffId] = useState<number | undefined>();
  const [requestedStart, setRequestedStart] = useState(dateTimeLocal(api.today(), "09:00"));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notice, setNotice] = useState("");

  const selectedService = useMemo(
    () => demo.schedule?.services.find((service) => service.id === serviceId) ?? demo.schedule?.services[0],
    [demo.schedule?.services, serviceId]
  );
  const selectedStaff = useMemo(
    () => demo.schedule?.staff.find((member) => member.id === staffId) ?? demo.schedule?.staff[0],
    [demo.schedule?.staff, staffId]
  );

  useEffect(() => {
    if (!serviceId && selectedService) setServiceId(selectedService.id);
    if (!staffId && selectedStaff) setStaffId(selectedStaff.id);
  }, [selectedService, selectedStaff, serviceId, staffId]);

  const serviceDuration = (selectedService?.duration_minutes ?? 60) + (selectedService?.buffer_after_minutes ?? 0);

  function isSlotAvailable(timeValue: string) {
    if (!selectedStaff || !demo.schedule) return false;
    const start = new Date(dateTimeLocal(demo.date, timeValue));
    const end = new Date(start.getTime() + serviceDuration * 60000);
    if (start.getHours() < 8 || end.getHours() > 18 || (end.getHours() === 18 && end.getMinutes() > 0)) return false;
    return !demo.schedule.bookings
      .filter((booking) => booking.staff_member_id === selectedStaff.id)
      .some((booking) => overlaps(start, end, booking.start_at, booking.end_at));
  }

  function firstAvailable(times: string[]) {
    return times.find((item) => isSlotAvailable(item));
  }

  const gapSlot = useMemo(() => {
    if (!selectedStaff || !demo.schedule) return undefined;
    return demo.schedule.gaps
      .filter((gap) => gap.staff_id === selectedStaff.id)
      .map((gap) => inputTime(gap.start_at))
      .find((slot) => isSlotAvailable(slot));
  }, [demo.schedule, selectedStaff, serviceDuration]);

  const cardSlots = useMemo(() => {
    const early = firstAvailable(["08:00", "08:15", "08:30", "09:00", "09:30"]);
    const prime = firstAvailable(["16:00", "16:30", "17:00"]);
    const gap = gapSlot;
    return [
      { label: "Best for business", time: gap ?? early, tag: gap ? "Fills a real schedule gap" : "Earliest available fit" },
      { label: "Cheapest", time: early, tag: "Early low-demand" },
      { label: "Prime time", time: prime, tag: "Standard price" },
      { label: "Fills schedule gap", time: gap, tag: gap ? "Optimizer-friendly" : "No current gap fit" },
    ];
  }, [demo.schedule, selectedStaff, serviceDuration, gapSlot]);

  async function getQuote(nextStart = requestedStart) {
    if (!selectedService || !selectedStaff) return;
    const slot = nextStart.slice(11, 16);
    setNotice("");
    setQuote(null);
    if (!isSlotAvailable(slot)) {
      setNotice("This slot is already occupied or does not fit the working window. Pick one of the available slot cards.");
      return;
    }
    setQuote(
      await api.quote({
        businessId: demo.businessId,
        serviceId: selectedService.id,
        staffId: selectedStaff.id,
        requestedStart: new Date(nextStart).toISOString(),
      })
    );
  }

  function chooseSlot(timeValue?: string) {
    if (!timeValue) {
      setNotice("No available slot found for this card with the current staff and service.");
      return;
    }
    const next = dateTimeLocal(demo.date, timeValue);
    setRequestedStart(next);
    getQuote(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Demand-aware booking</p>
          <h2 className="page-title">Price every slot with purpose</h2>
          <p className="mt-3 text-sm text-slate-500">Guide new demand toward the hours that improve utilization.</p>
        </div>
        <button onClick={() => demo.refresh(demo.businessId, demo.date, staffId)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh schedule
        </button>
      </div>
      <section className="surface p-5">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Business
            <select
              value={demo.businessId}
              onChange={(event) => {
                const nextBusiness = Number(event.target.value);
                setQuote(null);
                setNotice("");
                setServiceId(undefined);
                setStaffId(undefined);
                demo.refresh(nextBusiness, demo.date, undefined, true);
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {demo.businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Date
            <input
              type="date"
              value={demo.date}
              onChange={(event) => {
                const nextDate = event.target.value;
                setQuote(null);
                setNotice("");
                setRequestedStart(dateTimeLocal(nextDate, requestedStart.slice(11, 16)));
                demo.refresh(demo.businessId, nextDate, staffId);
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Service
            <select
              value={selectedService?.id ?? ""}
              onChange={(event) => {
                setQuote(null);
                setNotice("");
                setServiceId(Number(event.target.value));
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {demo.schedule?.services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Staff
            <select
              value={selectedStaff?.id ?? ""}
              onChange={(event) => {
                setQuote(null);
                setNotice("");
                setStaffId(Number(event.target.value));
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {demo.schedule?.staff.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Requested start
            <input type="datetime-local" value={requestedStart} onChange={(event) => setRequestedStart(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button onClick={() => getQuote()} className="primary-button mt-6">
            <Sparkles className="h-4 w-4" />
            Quote slot
          </button>
        </div>
      </section>
      {notice ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{notice}</div> : null}
      {quote ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Base price" value={money(quote.basePrice)} />
          <StatCard label="Adjusted price" value={money(quote.adjustedPrice)} />
          <StatCard label="Discount" value={`${quote.discountPercent}%`} hint={quote.reason} />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        {cardSlots.map((card) => (
          <button
            key={card.label}
            onClick={() => chooseSlot(card.time)}
            className={`rounded-2xl border p-5 text-left shadow-soft ${card.time ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-accent-300" : "border-slate-200 bg-slate-50 text-slate-400"}`}
          >
            <p className="font-semibold text-slate-950">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-accent-700">{card.time ?? "No fit"}</p>
            <p className="mt-2 text-sm text-slate-500">{card.tag}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
