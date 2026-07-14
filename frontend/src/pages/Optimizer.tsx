import { ArrowDown, Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPreview } from "../components/ChannelPreview";
import { Toolbar } from "../components/Toolbar";
import { api, Booking, Candidate, Gap, Offer, Staff, money, time } from "../lib/api";
import { candidateKey, findActiveOffer, localDateKey } from "./offerSelection";
import { useDemo } from "./useDemo";
import { useOfferPolling } from "./useOfferPolling";

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
  const [actionMessage, setActionMessage] = useState("");
  const [activeOffer, setActiveOffer] = useState<Offer>();
  const [generating, setGenerating] = useState(false);
  const [responding, setResponding] = useState<"accept" | "decline">();
  const candidates = useMemo(() => demo.schedule?.candidates ?? [], [demo.schedule?.candidates]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const candidate = candidates.find((item) => candidateKey(item) === selectedCandidateKey) ?? candidates[0];
  const visibleStaff = demo.schedule?.staff.filter((member) => !demo.staffId || member.id === demo.staffId) ?? [];
  const gridColumns = `64px repeat(${Math.max(visibleStaff.length, 1)}, minmax(260px, 1fr))`;
  const workflowStep = activeOffer?.status === "accepted" ? 4 : activeOffer ? 3 : 2;

  useEffect(() => {
    if (!candidates.length) {
      setSelectedCandidateKey("");
      return;
    }
    const stillExists = candidates.some((item) => candidateKey(item) === selectedCandidateKey);
    if (!stillExists) setSelectedCandidateKey(candidateKey(candidates[0]));
  }, [candidates, selectedCandidateKey]);

  useEffect(() => {
    let cancelled = false;
    setActiveOffer((current) => {
      if (
        current?.status === "sent" &&
        current.business_id === demo.businessId &&
        localDateKey(current.old_start) === demo.date &&
        (!demo.staffId || current.staff_member_id === demo.staffId)
      ) return current;
      return undefined;
    });
    api.offers()
      .then((rows) => {
        if (!cancelled) setActiveOffer((current) => current ?? findActiveOffer(rows, demo.businessId, demo.date, demo.staffId));
      })
      .catch((error) => {
        if (!cancelled) setActionMessage(error instanceof Error ? error.message : "Could not restore the active offer.");
      });
    return () => { cancelled = true; };
  }, [demo.businessId, demo.date, demo.staffId]);

  useOfferPolling(
    activeOffer,
    (next) => {
      const changedToFinal = activeOffer?.status === "sent" && next.status !== "sent";
      setActiveOffer(next);
      if (changedToFinal) {
        setActionMessage(next.status === "accepted" ? "Customer accepted. The booking has moved." : next.status === "declined" ? "Customer declined. The original booking is unchanged." : "This offer is no longer available.");
        void demo.refresh();
      }
    },
    (error) => setActionMessage(error.message),
  );

  async function generateOffer() {
    if (!demo.schedule || !candidate) return;
    setActionMessage("");
    setGenerating(true);
    try {
      const offer = await api.generateOffer(demo.businessId, demo.date, demo.staffId, candidate.booking_id, candidate.suggested_start, channel);
      setActiveOffer(offer);
      setActionMessage(`Offer sent to ${offer.customer_name}. Waiting for a response.`);
      await demo.refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not generate offer.");
      await demo.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function simulate(action: "accept" | "decline") {
    setActionMessage("");
    if (!activeOffer || activeOffer.status !== "sent") {
      setActionMessage("Send an offer before simulating the customer response.");
      return;
    }
    setResponding(action);
    try {
      if (action === "accept") await api.acceptOffer(activeOffer.token);
      if (action === "decline") await api.declineOffer(activeOffer.token);
      const refreshed = await api.offer(activeOffer.id);
      setActiveOffer(refreshed);
      setActionMessage(action === "accept" ? "Offer accepted. The selected booking has moved." : "Offer declined. The selected booking kept its original time.");
      await demo.refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "The simulated response could not be saved.");
      const refreshed = await api.offer(activeOffer.id).catch(() => undefined);
      if (refreshed) {
        setActiveOffer(refreshed);
        if (refreshed.status !== "sent") await demo.refresh();
      }
    } finally {
      setResponding(undefined);
    }
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
        {["Detect gap", "Match customer", "Send offer", "Recover value"].map((step, index) => <div key={step} className={`flex items-center gap-3 border-slate-200 px-4 py-4 sm:border-r ${index < workflowStep ? "bg-accent-50/50" : ""}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index < workflowStep ? "bg-accent-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span className="text-sm font-semibold text-slate-700">{step}</span></div>)}
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
                    candidate={activeOffer?.status === "sent" ? undefined : candidate}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <section className="surface p-5">
            <p className="eyebrow">{activeOffer?.status === "sent" ? "Offer in progress" : "Choose recipient"}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">{activeOffer?.status === "sent" ? `Waiting for ${activeOffer.customer_name}` : "Who should receive the offer?"}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{activeOffer?.status === "sent" ? "Resolve the current offer before selecting the next eligible customer." : "Every option below is eligible for the selected gap and messaging policy."}</p>
            {candidates.length && activeOffer?.status !== "sent" ? (
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {candidates.map((item) => {
                  const key = candidateKey(item);
                  const staffName = demo.schedule?.staff.find((member) => member.id === item.gap.staff_id)?.name ?? "Staff";
                  const incentive = item.incentive_type === "discount" ? `${item.incentive_value}% discount` : item.incentive_type === "bonus" ? item.incentive_value : "No incentive";
                  return (
                    <button
                      key={key}
                      disabled={activeOffer?.status === "sent"}
                      onClick={() => setSelectedCandidateKey(key)}
                      className={`w-full rounded-lg border px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                        key === selectedCandidateKey ? "border-accent-300 bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block font-semibold">{item.customer_name} · {item.service_name}</span>
                          <span className="mt-1 block text-xs opacity-75">{staffName} · {time(item.old_start)} → {time(item.suggested_start)}</span>
                          <span className="mt-1 block text-xs opacity-75">{incentive}</span>
                        </span>
                        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-accent-700">{money(item.estimated_saved_cost)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {activeOffer?.status === "sent" ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                The offer to {activeOffer.customer_name} is still active. Use the lifecycle controls below or answer through the customer link.
              </div>
            ) : candidate ? (
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
                <button disabled={generating} onClick={generateOffer} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {generating ? "Sending offer…" : `Send offer to ${candidate.customer_name}`}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-500">No eligible candidate found for this filter.</p>
                {!activeOffer ? <div className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">This schedule has no eligible moves. Reset the investor demo to replay the optimization journey.</div> : null}
              </div>
            )}
            {actionMessage ? <div className="mt-4 rounded-md border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{actionMessage}</div> : null}
          </section>
          {activeOffer ? (
            <section className="surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Offer lifecycle</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{activeOffer.customer_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{activeOffer.service_name} · {time(activeOffer.old_start)} → {time(activeOffer.suggested_start)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${activeOffer.status === "accepted" ? "bg-emerald-100 text-emerald-700" : activeOffer.status === "declined" || activeOffer.status === "expired" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{activeOffer.status}</span>
              </div>
              {activeOffer.status === "sent" ? <p className="mt-4 text-sm text-slate-500">Listening for a response. This page updates automatically.</p> : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button disabled={activeOffer.status !== "sent" || Boolean(responding)} onClick={() => simulate("accept")} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
                  {responding === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Simulate accept
                </button>
                <button disabled={activeOffer.status !== "sent" || Boolean(responding)} onClick={() => simulate("decline")} className="secondary-button disabled:cursor-not-allowed disabled:opacity-50">
                  {responding === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Simulate decline
                </button>
              </div>
              {activeOffer.public_url ? <a href={activeOffer.public_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><ExternalLink className="h-4 w-4" />Open customer link</a> : null}
            </section>
          ) : null}
          {activeOffer ? <ChannelPreview channel={activeOffer.channel} message={activeOffer.message_text} /> : null}
        </aside>
      </div>
    </div>
  );
}
