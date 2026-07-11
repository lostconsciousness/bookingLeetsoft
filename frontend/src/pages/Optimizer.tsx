import { ArrowDown, Check, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPreview } from "../components/ChannelPreview";
import { Toolbar } from "../components/Toolbar";
import { api, Booking, Candidate, Gap, Staff, money, time } from "../lib/api";
import { useDemo } from "./useDemo";

const START_HOUR = 8;
const END_HOUR = 18;
const MINUTE_HEIGHT = 1.25;
const TIMELINE_MINUTES = (END_HOUR - START_HOUR) * 60;
const TIMELINE_HEIGHT = TIMELINE_MINUTES * MINUTE_HEIGHT;

function minutesFromStart(value: string) {
  const date = new Date(value);
  return Math.max(0, (date.getHours() - START_HOUR) * 60 + date.getMinutes());
}

function blockStyle(start: string, end: string) {
  const top = minutesFromStart(start) * MINUTE_HEIGHT;
  const rawHeight = ((new Date(end).getTime() - new Date(start).getTime()) / 60000) * MINUTE_HEIGHT;
  return { top, height: Math.max(34, rawHeight) };
}

function BookingCard({ booking }: { booking: Booking }) {
  const minutes = (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000;
  const compact = minutes < 45;
  return (
    <div
      className="absolute left-3 right-3 z-20 overflow-hidden rounded-md border border-accent-200 bg-white px-3 py-2 shadow-soft"
      style={blockStyle(booking.start_at, booking.end_at)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5 text-slate-950">{booking.customer_name}</p>
          {!compact ? <p className="truncate text-xs leading-4 text-slate-500">{booking.service_name}</p> : null}
        </div>
        <p className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500">
          {time(booking.start_at)}-{time(booking.end_at)}
        </p>
      </div>
    </div>
  );
}

function GapBlock({ gap }: { gap: Gap }) {
  return (
    <div
      className="absolute left-3 right-3 z-10 rounded-md border border-dashed border-amber-300 bg-amber-50/85 px-3 py-2 text-xs font-semibold text-amber-800"
      style={blockStyle(gap.start_at, gap.end_at)}
    >
      <span className="block truncate">
        Idle gap {gap.idle_minutes} min / idle cost {money(gap.estimated_idle_cost)}
      </span>
    </div>
  );
}

function CandidateMarker({ candidate }: { candidate: Candidate }) {
  return (
    <div
      className="absolute right-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-soft"
      style={{ top: minutesFromStart(candidate.gap.start_at) * MINUTE_HEIGHT + 10 }}
    >
      <ArrowDown className="h-4 w-4 shrink-0" />
      <span className="truncate">Move {candidate.customer_name} here</span>
    </div>
  );
}

function TimeLabels() {
  return (
    <div className="relative border-r border-slate-200 bg-white" style={{ height: TIMELINE_HEIGHT }}>
      {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => (
        <div key={index} className="absolute left-0 right-0 border-t border-slate-200" style={{ top: index * 60 * MINUTE_HEIGHT }}>
          <span className="absolute -top-2 right-3 bg-white px-1 text-xs font-medium text-slate-400">
            {String(START_HOUR + index).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

function StaffLane({
  staff,
  bookings,
  gaps,
  candidate,
}: {
  staff: Staff;
  bookings: Booking[];
  gaps: Gap[];
  candidate?: Candidate;
}) {
  return (
    <div className="relative border-r border-slate-200 bg-slate-50/70" style={{ height: TIMELINE_HEIGHT }}>
      {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => (
        <div key={index} className="absolute left-0 right-0 border-t border-slate-200" style={{ top: index * 60 * MINUTE_HEIGHT }} />
      ))}
      {gaps.filter((gap) => gap.staff_id === staff.id).map((gap) => (
        <GapBlock key={`${gap.staff_id}-${gap.start_at}`} gap={gap} />
      ))}
      {bookings.filter((booking) => booking.staff_member_id === staff.id).map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
      {candidate?.gap.staff_id === staff.id ? <CandidateMarker candidate={candidate} /> : null}
    </div>
  );
}

export default function Optimizer() {
  const demo = useDemo();
  const [channel, setChannel] = useState("whatsapp");
  const [offerMessage, setOfferMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const candidates = useMemo(() => demo.schedule?.candidates ?? [], [demo.schedule?.candidates]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const candidate = candidates.find((item) => `${item.booking_id}-${item.suggested_start}` === selectedCandidateKey) ?? candidates[0];
  const visibleStaff = demo.schedule?.staff.filter((member) => !demo.staffId || member.id === demo.staffId) ?? [];
  const gridColumns = `64px repeat(${Math.max(visibleStaff.length, 1)}, minmax(260px, 1fr))`;

  useEffect(() => {
    if (!candidates.length) {
      setSelectedCandidateKey("");
      return;
    }
    const stillExists = candidates.some((item) => `${item.booking_id}-${item.suggested_start}` === selectedCandidateKey);
    if (!stillExists) setSelectedCandidateKey(`${candidates[0].booking_id}-${candidates[0].suggested_start}`);
  }, [candidates, selectedCandidateKey]);

  async function generateOffer() {
    if (!demo.schedule || !candidate) return;
    setActionMessage("");
    try {
      const offer = await api.generateOffer(demo.businessId, demo.date, demo.staffId, candidate.booking_id, channel);
      setOfferMessage(offer.message_text);
      setActionMessage("Offer generated. This booking is now removed from suggested moves until the customer accepts, declines, or it expires.");
      await demo.refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not generate offer.");
      await demo.refresh();
    }
  }

  async function simulate(action: "accept" | "decline") {
    setActionMessage("");
    const offers = await api.offers();
    const offer = offers.find((item) => item.status === "sent" && item.booking_id === candidate?.booking_id) ?? offers.find((item) => item.status === "sent");
    if (!offer) return;
    if (action === "accept") await api.acceptOffer(offer.token);
    if (action === "decline") await api.declineOffer(offer.token);
    setActionMessage(action === "accept" ? "Offer accepted. Booking moved and competing offers expired." : "Offer declined. Booking kept its original time.");
    await demo.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Optimization workspace</p>
          <h2 className="page-title">Recover today&apos;s hidden capacity</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Review the highest-impact move, choose a simulated channel, and watch the schedule improve.</p>
        </div>
        <span className="rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700">Live recommendation engine</span>
      </div>
      <div className="surface grid overflow-hidden sm:grid-cols-4">
        {["Detect gap", "Match customer", "Send offer", "Recover value"].map((step, index) => <div key={step} className={`flex items-center gap-3 border-slate-200 px-4 py-4 sm:border-r ${index <= 1 ? "bg-accent-50/50" : ""}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index <= 1 ? "bg-accent-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span className="text-sm font-semibold text-slate-700">{step}</span></div>)}
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{demo.schedule?.business.name ?? "Loading schedule"}</h3>
              <p className="text-sm text-slate-500">Timeline from 08:00 to 18:00, split by staff member</p>
            </div>
            <div className="rounded-md bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700">
              {demo.schedule?.metrics.detectedIdleMinutes ?? 0} idle minutes
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-[720px]">
              <div className="grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: gridColumns }}>
                <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Time</div>
                {visibleStaff.map((member) => (
                  <div key={member.id} className="border-l border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-950">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
                <TimeLabels />
                {visibleStaff.map((member) => (
                  <StaffLane
                    key={member.id}
                    staff={member}
                    bookings={demo.schedule?.bookings ?? []}
                    gaps={demo.schedule?.gaps ?? []}
                    candidate={candidate}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <section className="surface p-5">
            <p className="eyebrow">Recommended action</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Suggested move</h3>
            {candidates.length > 1 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Available moves</p>
                {candidates.map((item) => {
                  const key = `${item.booking_id}-${item.suggested_start}`;
                  const staffName = demo.schedule?.staff.find((member) => member.id === item.gap.staff_id)?.name ?? "Staff";
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCandidateKey(key)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        key === selectedCandidateKey ? "border-accent-300 bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block font-semibold">{staffName}: {item.customer_name}</span>
                      <span className="text-xs">{time(item.old_start)} to {time(item.suggested_start)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {candidate ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-accent-50 p-4">
                  <p className="text-sm font-semibold text-accent-700">
                    {candidate.customer_name} / {candidate.service_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {time(candidate.old_start)} to {time(candidate.suggested_start)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{candidate.reason}</p>
                </div>
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  Preview channel
                  <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="telegram">Telegram</option>
                    <option value="voice">Voice Call Preview</option>
                  </select>
                </label>
                <div className="grid gap-2">
                  <button onClick={generateOffer} className="primary-button">
                    <Send className="h-4 w-4" />
                    Generate offer
                  </button>
                  <button onClick={() => simulate("accept")} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <Check className="h-4 w-4" />
                    Simulate accepted
                  </button>
                  <button onClick={() => simulate("decline")} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <X className="h-4 w-4" />
                    Simulate declined
                  </button>
                </div>
                {actionMessage ? <div className="rounded-md border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{actionMessage}</div> : null}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-500">No eligible candidate found for this filter.</p>
                <div className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">This schedule has no eligible moves. Reset the investor demo to replay the optimization journey.</div>
              </div>
            )}
          </section>
          {offerMessage ? <ChannelPreview channel={channel} message={offerMessage} /> : null}
        </aside>
      </div>
    </div>
  );
}
