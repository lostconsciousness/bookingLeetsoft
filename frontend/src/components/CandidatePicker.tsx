import { CalendarDays, Check, UserRound } from "lucide-react";
import { useTranslation } from "../i18n/I18nContext";
import { Candidate, formatIncentive, money, Staff, time } from "../lib/api";
import { candidateKey, localDateKey } from "../pages/offerSelection";

type Props = {
  candidates: Candidate[];
  date: string;
  staff: Staff[];
  selectedCandidate?: Candidate;
  onSelect: (key: string) => void;
};

export function CandidatePicker({ candidates, date, staff, selectedCandidate, onSelect }: Props) {
  const { lang, t } = useTranslation();
  const sameDay = candidates.filter((item) => localDateKey(item.old_start) === date);
  const laterDays = candidates.filter((item) => localDateKey(item.old_start) !== date);
  const locale = lang === "ru" ? "ru-RU" : lang === "uk" ? "uk-UA" : "en-GB";
  const formatDay = (value: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(value));

  return (
    <div className="mt-4 space-y-3">
      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
        {t("optimizer.recipientSelect")}
        <select
          value={selectedCandidate ? candidateKey(selectedCandidate) : ""}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
        >
          {sameDay.length ? <optgroup label={t("optimizer.todayCandidates")}>
            {sameDay.map((item) => <option key={candidateKey(item)} value={candidateKey(item)}>{item.customer_name} · {time(item.old_start)} → {time(item.suggested_start)}</option>)}
          </optgroup> : null}
          {laterDays.length ? <optgroup label={t("optimizer.nextDaysCandidates")}>
            {laterDays.map((item) => <option key={candidateKey(item)} value={candidateKey(item)}>{item.customer_name} · {formatDay(item.old_start)} → {formatDay(item.suggested_start)}, {time(item.suggested_start)}</option>)}
          </optgroup> : null}
        </select>
      </label>
      <details className="rounded-lg border border-slate-200 bg-slate-50/60">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">{t("optimizer.compareCandidates", { count: candidates.length })}</summary>
        <div className="max-h-72 space-y-4 overflow-y-auto border-t border-slate-200 bg-white p-3" role="radiogroup" aria-label={t("common.eligibleCandidates")}>
          {[
            { label: t("optimizer.todayCandidates"), rows: sameDay },
            { label: t("optimizer.nextDaysCandidates"), rows: laterDays },
          ].filter((group) => group.rows.length).map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="sticky top-0 z-10 flex items-center justify-between bg-white py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{group.rows.length}</span>
              </div>
              {group.rows.map((item) => {
                const key = candidateKey(item);
                const selected = key === (selectedCandidate ? candidateKey(selectedCandidate) : "");
                const staffName = staff.find((member) => member.id === item.gap.staff_id)?.name ?? "";
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelect(key)}
                    className={`w-full overflow-hidden rounded-xl border p-3 text-left text-sm transition ${selected ? "border-accent-400 bg-accent-50 ring-2 ring-accent-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-accent-600 bg-accent-600" : "border-slate-300 bg-white"}`}>{selected ? <Check className="h-3 w-3 text-white" /> : null}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold text-slate-950">{item.customer_name} · {item.service_name}</span>
                          <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-accent-700">{money(item.estimated_saved_cost)}</span>
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><UserRound className="h-3.5 w-3.5 shrink-0" />{staffName}</span>
                        <span className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs text-slate-600">
                          <CalendarDays className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                          <span><span className="mr-1 text-slate-400">{t("optimizer.currentSlot")}:</span><span className="line-through opacity-70">{formatDay(item.old_start)}, {time(item.old_start)}</span></span>
                          <span />
                          <span><span className="mr-1 text-slate-400">{t("optimizer.proposedSlot")}:</span><strong>{formatDay(item.suggested_start)}, {time(item.suggested_start)}</strong></span>
                        </span>
                        <span className="mt-2 block text-xs font-medium text-accent-700">{formatIncentive(item.incentive_type, item.incentive_value, t)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
