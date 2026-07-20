import { ArrowRight, Clock3, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "../components/StatCard";
import { Toolbar } from "../components/Toolbar";
import { useTranslation } from "../i18n/I18nContext";
import { money, time } from "../lib/api";
import { useDemo } from "./useDemo";

function ImpactChart({ data }: { data: { date: string; amount: number }[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((item) => item.amount));
  return <section className="surface p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">{t("dashboard.proofOfImpact")}</p><h2 className="mt-2 text-xl font-semibold text-slate-950">{t("dashboard.recoveredValue")}</h2></div><span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">{t("dashboard.acceptedMoves")}</span></div><div className="mt-8 flex h-48 items-end gap-3">{data.map((item) => <div key={item.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><span className="text-center text-xs font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{money(item.amount)}</span><div className="mx-auto w-full max-w-14 rounded-t-lg bg-gradient-to-t from-accent-700 to-accent-300" style={{height:`${Math.max(8,(item.amount/max)*145)}px`}}/><span className="truncate text-center text-[11px] text-slate-500">{new Intl.DateTimeFormat(undefined,{weekday:"short"}).format(new Date(`${item.date}T12:00:00`))}</span></div>)}</div></section>;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const demo = useDemo();
  const m = demo.schedule?.metrics;
  const candidate = demo.schedule?.candidates[0];
  const accepted = m?.acceptedOffers ?? 0;
  const totalDecided = accepted + (m?.declinedOffers ?? 0);
  const acceptance = totalDecided ? Math.round((accepted / totalDecided) * 100) : 0;
  const utilization = m?.staffUtilizationPercent ?? 0;
  const uplift = m?.detectedIdleMinutes ? Math.min(18, Math.round((m.detectedIdleMinutes / 480) * 100)) : 0;

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl bg-accent-900 text-white shadow-lift"><div className="grid gap-8 px-6 py-8 sm:px-9 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-10"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">{t("dashboard.heroKicker")}</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{t("dashboard.heroTitleLine1")}<br/><span className="text-emerald-300">{t("dashboard.heroTitleLine2")}</span></h1><p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/70">{t("dashboard.heroBody")}</p></div><Link to="/optimizer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-accent-900 shadow-lg hover:-translate-y-0.5">{t("dashboard.heroCta")} <ArrowRight className="h-4 w-4"/></Link></div></section>

    <Toolbar businesses={demo.businesses} staff={demo.schedule?.staff ?? []} businessId={demo.businessId} staffId={demo.staffId} date={demo.date} onBusiness={(v)=>demo.refresh(v,demo.date,undefined)} onStaff={(v)=>demo.refresh(demo.businessId,demo.date,v)} onDate={(v)=>demo.refresh(demo.businessId,v,demo.staffId)} onSeed={demo.seed}/>
    {demo.error ? <div className="surface border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><strong>{t("dashboard.loadError")}</strong> {demo.error} <button onClick={()=>demo.refresh()} className="ml-2 underline">{t("dashboard.tryAgain")}</button></div> : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("dashboard.statUtilization")} value={`${utilization}%`} hint={t("dashboard.statUtilizationHint", { uplift })} tone="positive"/>
      <StatCard label={t("dashboard.statIdle")} value={`${m?.detectedIdleMinutes ?? 0} min`} hint={t("dashboard.statIdleHint")} tone="warning"/>
      <StatCard label={t("dashboard.statProjected")} value={money(m?.estimatedSavedCost)} hint={t("dashboard.statProjectedHint")}/>
      <StatCard label={t("dashboard.statAcceptance")} value={`${acceptance}%`} hint={t("dashboard.statAcceptanceHint", { accepted, total: totalDecided })}/>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <ImpactChart data={m?.dailySavings ?? []}/>
      <section className="surface p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">{t("dashboard.bestNextAction")}</p><h2 className="mt-2 text-xl font-semibold">{t("dashboard.bestNextActionTitle")}</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-700"><Sparkles className="h-5 w-5"/></div></div>{candidate ? <><div className="mt-6 rounded-2xl border border-accent-100 bg-accent-50/70 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-slate-950">{candidate.customer_name}</p><p className="mt-1 text-sm text-slate-500">{candidate.service_name}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent-700">{money(candidate.estimated_saved_cost)} {t("dashboard.impact")}</span></div><div className="mt-5 flex items-center gap-3 text-sm"><span className="rounded-lg bg-white px-3 py-2 text-slate-500">{time(candidate.old_start)}</span><ArrowRight className="h-4 w-4 text-accent-600"/><span className="rounded-lg bg-accent-600 px-3 py-2 font-semibold text-white">{time(candidate.suggested_start)}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{candidate.reason}</p></div><Link to="/optimizer" className="primary-button mt-4 w-full">{t("dashboard.reviewRecommendation")} <ArrowRight className="h-4 w-4"/></Link></> : <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><Clock3 className="mx-auto h-6 w-6 text-slate-400"/><p className="mt-3 font-semibold">{t("dashboard.scheduleOptimized")}</p><p className="mt-1 text-sm text-slate-500">{t("dashboard.scheduleOptimizedHint")}</p></div>}</section>
    </div>
    <section className="grid gap-4 md:grid-cols-3"><div className="surface p-5"><TrendingUp className="h-5 w-5 text-accent-600"/><p className="mt-4 font-semibold">{t("dashboard.featureDetectTitle")}</p><p className="mt-1 text-sm leading-6 text-slate-500">{t("dashboard.featureDetectBody")}</p></div><div className="surface p-5"><Sparkles className="h-5 w-5 text-accent-600"/><p className="mt-4 font-semibold">{t("dashboard.featureRecommendTitle")}</p><p className="mt-1 text-sm leading-6 text-slate-500">{t("dashboard.featureRecommendBody")}</p></div><div className="surface p-5"><RefreshCw className="h-5 w-5 text-accent-600"/><p className="mt-4 font-semibold">{t("dashboard.featureRecoverTitle")}</p><p className="mt-1 text-sm leading-6 text-slate-500">{t("dashboard.featureRecoverBody")}</p></div></section>
  </div>;
}
