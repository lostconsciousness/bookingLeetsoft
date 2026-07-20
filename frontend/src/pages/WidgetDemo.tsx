import {
  Check,
  Coins,
  DollarSign,
  Eye,
  LucideIcon,
  Percent,
  PieChart,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Ticket,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TKey, useTranslation } from "../i18n/I18nContext";
import { Translate } from "../lib/api";

type VariantId =
  | "asIs"
  | "accountCredit"
  | "fitBucks"
  | "fitStars"
  | "classPercent"
  | "fractionalClasses"
  | "classCredits"
  | "fineCredits";

type Variant = {
  id: VariantId;
  icon: LucideIcon;
  labelKey: TKey;
  descriptionKey: TKey;
  hintKey?: TKey;
  balanceKey?: TKey;
  /** Per-class reward badge, or null when this variant shows no badge. */
  formatReward: (units: number, t: Translate) => string | null;
};

const VARIANTS: Variant[] = [
  {
    id: "asIs",
    icon: Eye,
    labelKey: "widgetDemo.labels.asIs",
    descriptionKey: "widgetDemo.descriptions.asIs",
    formatReward: () => null,
  },
  {
    id: "accountCredit",
    icon: DollarSign,
    labelKey: "widgetDemo.labels.accountCredit",
    descriptionKey: "widgetDemo.descriptions.accountCredit",
    hintKey: "widgetDemo.hints.accountCredit",
    balanceKey: "widgetDemo.balances.accountCredit",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardCredit", { amount: (units * 7.5).toFixed(2) }) : null),
  },
  {
    id: "fitBucks",
    icon: Coins,
    labelKey: "widgetDemo.labels.fitBucks",
    descriptionKey: "widgetDemo.descriptions.fitBucks",
    hintKey: "widgetDemo.hints.fitBucks",
    balanceKey: "widgetDemo.balances.fitBucks",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardFitBucks", { amount: Math.round(units * 750) }) : null),
  },
  {
    id: "fitStars",
    icon: Star,
    labelKey: "widgetDemo.labels.fitStars",
    descriptionKey: "widgetDemo.descriptions.fitStars",
    hintKey: "widgetDemo.hints.fitStars",
    balanceKey: "widgetDemo.balances.fitStars",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardFitStars", { amount: Math.round(units * 10) }) : null),
  },
  {
    id: "classPercent",
    icon: Percent,
    labelKey: "widgetDemo.labels.classPercent",
    descriptionKey: "widgetDemo.descriptions.classPercent",
    hintKey: "widgetDemo.hints.classPercent",
    balanceKey: "widgetDemo.balances.classPercent",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardPercent", { amount: Math.round(units * 25) }) : null),
  },
  {
    id: "fractionalClasses",
    icon: PieChart,
    labelKey: "widgetDemo.labels.fractionalClasses",
    descriptionKey: "widgetDemo.descriptions.fractionalClasses",
    hintKey: "widgetDemo.hints.fractionalClasses",
    balanceKey: "widgetDemo.balances.fractionalClasses",
    formatReward: (units, t) => {
      if (!units) return null;
      const fraction = units >= 2 ? "1/2" : units >= 1.5 ? "3/8" : "1/4";
      return t("widgetDemo.rewardFraction", { fraction });
    },
  },
  {
    id: "classCredits",
    icon: Ticket,
    labelKey: "widgetDemo.labels.classCredits",
    descriptionKey: "widgetDemo.descriptions.classCredits",
    hintKey: "widgetDemo.hints.classCredits",
    balanceKey: "widgetDemo.balances.classCredits",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardClassCredits", { amount: Math.round(units * 3) }) : null),
  },
  {
    id: "fineCredits",
    icon: SlidersHorizontal,
    labelKey: "widgetDemo.labels.fineCredits",
    descriptionKey: "widgetDemo.descriptions.fineCredits",
    hintKey: "widgetDemo.hints.fineCredits",
    balanceKey: "widgetDemo.balances.fineCredits",
    formatReward: (units, t) => (units ? t("widgetDemo.rewardFineCredits", { amount: Math.round(units * 30) }) : null),
  },
];

type MockClass = {
  time: string;
  name: string;
  instructor: string;
  filled: number;
  total: number;
  /** 0 = peak time, no reward. Higher = bigger off-peak reward. */
  rewardUnits: number;
};

const CLASSES: MockClass[] = [
  { time: "6:00 AM - 6:50 AM", name: "Power Ride", instructor: "Sarah M.", filled: 25, total: 25, rewardUnits: 2 },
  { time: "7:00 AM - 7:50 AM", name: "Full Body Burn", instructor: "Chris T.", filled: 22, total: 25, rewardUnits: 1.5 },
  { time: "8:00 AM - 8:45 AM", name: "Strength & Sculpt", instructor: "Bri W.", filled: 20, total: 25, rewardUnits: 1 },
  { time: "9:00 AM - 9:50 AM", name: "Reformer Flow", instructor: "Amanda L.", filled: 17, total: 25, rewardUnits: 0 },
  { time: "10:15 AM - 11:00 AM", name: "Barre Sculpt", instructor: "Taylor K.", filled: 13, total: 25, rewardUnits: 0 },
];

const ANCHOR_DATE = new Date(2026, 1, 22);

const PROMO = {
  green: { bg: "bg-accent-50", text: "text-accent-700", border: "border-accent-100" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
};

type BookingState = "open" | "booked" | "waitlisted";

export default function WidgetDemo() {
  const { t, lang } = useTranslation();
  const [variantId, setVariantId] = useState<VariantId>("accountCredit");
  const [promoColor, setPromoColor] = useState<"blue" | "green">("green");
  const [selectedDay, setSelectedDay] = useState(0);
  const [bookings, setBookings] = useState<Record<string, BookingState>>({});
  const [toast, setToast] = useState("");
  const variant = useMemo(() => VARIANTS.find((item) => item.id === variantId) ?? VARIANTS[0], [variantId]);
  const promo = PROMO[promoColor];

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(ANCHOR_DATE);
        date.setDate(ANCHOR_DATE.getDate() + index);
        return date;
      }),
    [],
  );

  function bookClass(item: MockClass, isFull: boolean) {
    if (isFull) {
      setBookings((prev) => ({ ...prev, [item.name]: "waitlisted" }));
      setToast(t("widgetDemo.waitlistJoined", { name: item.name }));
      return;
    }
    setBookings((prev) => ({ ...prev, [item.name]: "booked" }));
    const reward = variant.formatReward(item.rewardUnits, t);
    setToast(reward ? t("widgetDemo.rewardEarned", { reward, name: item.name }) : "");
  }

  function resetDemo() {
    setBookings({});
    setToast("");
    setSelectedDay(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t("widgetDemo.kicker")}</p>
        <h2 className="page-title">{t("widgetDemo.title")}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t("widgetDemo.subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <p className="text-lg font-semibold text-slate-950">{t("widgetDemo.classSchedule")}</p>
            <button onClick={resetDemo} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
              <RefreshCw className="h-4 w-4" />
              {t("widgetDemo.resetDemo")}
            </button>
          </div>

          {variant.balanceKey ? (
            <div className="flex justify-center border-b border-slate-200 bg-slate-50/60 p-4">
              <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${promo.bg} ${promo.text} ${promo.border}`}>
                <DollarSign className="h-4 w-4" />
                {t(variant.balanceKey)}
                {variant.hintKey ? <span className="font-normal opacity-70">({t(variant.hintKey)})</span> : null}
              </span>
            </div>
          ) : null}

          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-5">
            {days.map((date, index) => {
              const label = new Intl.DateTimeFormat(lang, { weekday: "short" }).format(date).toUpperCase();
              const selected = index === selectedDay;
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDay(index)}
                  aria-pressed={selected}
                  className={`grid h-16 w-14 shrink-0 place-items-center rounded-xl text-xs font-semibold transition ${
                    selected ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-center leading-tight">
                    {label}
                    <span className="mt-1 block text-base">{date.getDate()}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {variant.id !== "asIs" ? (
            <div className="flex justify-center border-b border-slate-200 bg-accent-50/40 p-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${promo.bg} ${promo.text}`}>
                {t("widgetDemo.promoLine", { scheme: t(variant.labelKey) })}
              </span>
            </div>
          ) : (
            <div className="flex justify-center border-b border-slate-200 bg-slate-50 p-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{t("widgetDemo.promoLineAsIs")}</span>
            </div>
          )}

          <div aria-live="polite">
            {toast ? (
              <div className="border-b border-slate-200 bg-accent-50 p-3 text-center text-sm font-semibold text-accent-700">{toast}</div>
            ) : null}
          </div>

          <div className="divide-y divide-slate-100">
            {CLASSES.map((item) => {
              const reward = variant.formatReward(item.rewardUnits, t);
              const state = bookings[item.name] ?? "open";
              const isFull = item.filled >= item.total && state !== "booked";
              const displayFilled = state === "booked" ? Math.min(item.filled + 1, item.total) : item.filled;
              return (
                <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="w-32 shrink-0 text-sm text-slate-500">{item.time}</div>
                  <div className="min-w-[180px] flex-1">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <p className="text-sm text-slate-500">{t("widgetDemo.withInstructor", { name: item.instructor })}</p>
                  </div>
                  {reward ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${promo.bg} ${promo.text}`}>
                      {reward}
                    </span>
                  ) : item.rewardUnits > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      {t("widgetDemo.fillsGap")}
                    </span>
                  ) : null}
                  <div className="w-24 shrink-0 text-right text-xs text-slate-400">
                    {t("widgetDemo.filled", { filled: displayFilled, total: item.total })}
                  </div>
                  {state === "booked" ? (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                      <Check className="h-4 w-4" />
                      {t("widgetDemo.booked")}
                    </span>
                  ) : state === "waitlisted" ? (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                      <Check className="h-4 w-4" />
                      {t("widgetDemo.onWaitlist")}
                    </span>
                  ) : isFull ? (
                    <button onClick={() => bookClass(item, true)} className="secondary-button">{t("widgetDemo.waitlist")}</button>
                  ) : (
                    <button onClick={() => bookClass(item, false)} className="primary-button">{t("widgetDemo.book")}</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface p-4">
            <p className="eyebrow px-1">{t("widgetDemo.demoVariants")}</p>
            <div className="mt-3 space-y-1">
              {VARIANTS.map((item) => {
                const Icon = item.icon;
                const selected = item.id === variantId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setVariantId(item.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                      selected ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(item.labelKey)}</span>
                      <span className="block truncate text-xs opacity-70">{t(item.descriptionKey)}</span>
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-accent-600" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </section>
          <section className="surface p-4">
            <p className="eyebrow px-1">{t("widgetDemo.promoColor")}</p>
            <div className="mt-3 flex gap-2 px-1">
              {(["blue", "green"] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setPromoColor(color)}
                  aria-pressed={promoColor === color}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    promoColor === color ? `${PROMO[color].border} ${PROMO[color].bg} ${PROMO[color].text}` : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {t(color === "blue" ? "widgetDemo.colorBlue" : "widgetDemo.colorGreen")}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
