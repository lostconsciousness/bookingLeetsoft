import { ArrowDown } from "lucide-react";
import { useTranslation } from "../i18n/I18nContext";
import { Booking, Candidate, Gap, money, Staff, time } from "../lib/api";

const START_HOUR = 8;
const END_HOUR = 18;
const MINUTE_HEIGHT = 1.25;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * 60 * MINUTE_HEIGHT;
const MARKER_HEIGHT = 36;

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
    <div className="absolute left-3 right-3 z-20 overflow-hidden rounded-md border border-accent-200 bg-white px-3 py-2 shadow-soft" style={blockStyle(booking.start_at, booking.end_at)}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5 text-slate-950" title={booking.customer_name}>{booking.customer_name}</p>
          {!compact ? <p className="truncate text-xs leading-4 text-slate-500" title={booking.service_name}>{booking.service_name}</p> : null}
        </div>
        <p className="min-w-0 shrink truncate whitespace-nowrap text-[11px] font-medium text-slate-500" title={`${time(booking.start_at)}-${time(booking.end_at)}`}>
          {time(booking.start_at)}-{time(booking.end_at)}
        </p>
      </div>
    </div>
  );
}

function GapBlock({ gap }: { gap: Gap }) {
  const { t } = useTranslation();
  const label = t("optimizer.gapLabel", { minutes: gap.idle_minutes, cost: money(gap.estimated_idle_cost) });
  return (
    <div className="absolute left-3 right-3 z-10 rounded-md border border-dashed border-amber-300 bg-amber-50/85 px-3 py-2 text-xs font-semibold text-amber-800" style={blockStyle(gap.start_at, gap.end_at)}>
      <span className="block truncate" title={label}>{label}</span>
    </div>
  );
}

function CandidateMarker({ candidate }: { candidate: Candidate }) {
  const { t } = useTranslation();
  const label = t("optimizer.moveCandidateHere", { name: candidate.customer_name });
  const gapBottom = minutesFromStart(candidate.gap.end_at) * MINUTE_HEIGHT;
  const gapTop = minutesFromStart(candidate.gap.start_at) * MINUTE_HEIGHT;
  const top = Math.max(gapTop + 8, gapBottom - MARKER_HEIGHT);
  return (
    <div className="absolute left-3 right-3 z-30 flex min-w-0 items-center gap-2 overflow-hidden rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-soft" style={{ top }} title={label}>
      <ArrowDown className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{candidate.customer_name}</span>
      <span className="shrink-0 text-white/70">→ {time(candidate.suggested_start)}</span>
    </div>
  );
}

function TimeLabels() {
  return (
    <div className="relative border-r border-slate-200 bg-white" style={{ height: TIMELINE_HEIGHT }}>
      {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => (
        <div key={index} className="absolute left-0 right-0 border-t border-slate-200" style={{ top: index * 60 * MINUTE_HEIGHT }}>
          <span className="absolute -top-2 right-3 bg-white px-1 text-xs font-medium text-slate-500">{String(START_HOUR + index).padStart(2, "0")}:00</span>
        </div>
      ))}
    </div>
  );
}

function StaffLane({ staff, bookings, gaps, candidate }: { staff: Staff; bookings: Booking[]; gaps: Gap[]; candidate?: Candidate }) {
  return (
    <div className="relative overflow-hidden border-r border-slate-200 bg-slate-50/70" style={{ height: TIMELINE_HEIGHT }}>
      {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => <div key={index} className="absolute left-0 right-0 border-t border-slate-200" style={{ top: index * 60 * MINUTE_HEIGHT }} />)}
      {gaps.filter((gap) => gap.staff_id === staff.id).map((gap) => <GapBlock key={`${gap.staff_id}-${gap.start_at}`} gap={gap} />)}
      {bookings.filter((booking) => booking.staff_member_id === staff.id).map((booking) => <BookingCard key={booking.id} booking={booking} />)}
      {candidate?.gap.staff_id === staff.id ? <CandidateMarker candidate={candidate} /> : null}
    </div>
  );
}

type Props = {
  businessName?: string;
  staff: Staff[];
  bookings: Booking[];
  gaps: Gap[];
  candidate?: Candidate;
  idleMinutes: number;
};

export function OptimizerTimeline({ businessName, staff, bookings, gaps, candidate, idleMinutes }: Props) {
  const { t } = useTranslation();
  const gridColumns = `64px repeat(${Math.max(staff.length, 1)}, minmax(220px, 1fr))`;
  return (
    <section className="surface order-2 p-5 lg:order-1">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{businessName ?? t("common.loading")}</h3>
          <p className="text-sm text-slate-500">{t("optimizer.timelineSubtitle")}</p>
        </div>
        <div className="rounded-md bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700">{t("optimizer.idleMinutes", { count: idleMinutes })}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <div className="min-w-[504px]">
          <div className="grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: gridColumns }}>
            <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("optimizer.timeColumn")}</div>
            {staff.map((member) => <div key={member.id} className="border-l border-slate-200 px-4 py-3"><p className="text-sm font-semibold text-slate-950">{member.name}</p><p className="text-xs text-slate-500">{member.role}</p></div>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
            <TimeLabels />
            {staff.map((member) => <StaffLane key={member.id} staff={member} bookings={bookings} gaps={gaps} candidate={candidate} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
