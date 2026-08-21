import { Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CandidatePicker } from "../components/CandidatePicker";
import { ChannelPreview } from "../components/ChannelPreview";
import { OptimizerTimeline } from "../components/OptimizerTimeline";
import { Toolbar } from "../components/Toolbar";
import { offerStatusKey, useTranslation } from "../i18n/I18nContext";
import { TKey } from "../i18n/I18nContext";
import { api, Offer, time } from "../lib/api";
import { candidateKey, findActiveOffer, localDateKey } from "./offerSelection";
import { useDemo } from "./useDemo";
import { useOfferPolling } from "./useOfferPolling";

export default function Optimizer() {
  const { lang, t } = useTranslation();
  const demo = useDemo();
  const [channel, setChannel] = useState("whatsapp");
  const [actionMessage, setActionMessage] = useState("");
  const [activeOffer, setActiveOffer] = useState<Offer>();
  const [generating, setGenerating] = useState(false);
  const [responding, setResponding] = useState<"accept" | "decline">();
  const candidates = useMemo(() => demo.schedule?.candidates ?? [], [demo.schedule?.candidates]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const candidate = candidates.find((item) => candidateKey(item) === selectedCandidateKey) ?? candidates[0];
  const locale = lang === "ru" ? "ru-RU" : lang === "uk" ? "uk-UA" : "en-GB";
  const formatDay = (value: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(value));
  const visibleStaff = demo.schedule?.staff.filter((member) => !demo.staffId || member.id === demo.staffId) ?? [];
  const workflowStep = activeOffer?.status === "accepted"
    ? 4
    : activeOffer
      ? 3
      : candidates.length
        ? 2
        : demo.schedule
          ? 1
          : 0;
  const steps: TKey[] = ["optimizer.stepDetect", "optimizer.stepMatch", "optimizer.stepSend", "optimizer.stepRecover"];

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
        localDateKey(current.suggested_start) === demo.date &&
        (!demo.staffId || current.staff_member_id === demo.staffId)
      ) return current;
      return undefined;
    });
    api.offers()
      .then((rows) => {
        if (!cancelled) setActiveOffer((current) => current ?? findActiveOffer(rows, demo.businessId, demo.date, demo.staffId));
      })
      .catch((error) => {
        if (!cancelled) setActionMessage(error instanceof Error ? error.message : t("optimizer.msgRestoreFailed"));
      });
    return () => { cancelled = true; };
  }, [demo.businessId, demo.date, demo.staffId]);

  useOfferPolling(
    activeOffer,
    (next) => {
      const changedToFinal = activeOffer?.status === "sent" && next.status !== "sent";
      setActiveOffer(next);
      if (changedToFinal) {
        setActionMessage(next.status === "accepted" ? t("optimizer.msgCustomerAccepted") : next.status === "declined" ? t("optimizer.msgCustomerDeclined") : t("optimizer.msgOfferExpired"));
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
      setActionMessage(t("optimizer.msgOfferSent", { name: offer.customer_name ?? "" }));
      await demo.refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t("optimizer.msgOfferGenerateFailed"));
      await demo.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function simulate(action: "accept" | "decline") {
    setActionMessage("");
    if (!activeOffer || activeOffer.status !== "sent") {
      setActionMessage(t("optimizer.msgSendBeforeSimulate"));
      return;
    }
    setResponding(action);
    try {
      if (action === "accept") await api.acceptOffer(activeOffer.token);
      if (action === "decline") await api.declineOffer(activeOffer.token);
      const refreshed = await api.offer(activeOffer.id);
      setActiveOffer(refreshed);
      setActionMessage(action === "accept" ? t("optimizer.msgOfferAccepted") : t("optimizer.msgOfferDeclined"));
      await demo.refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t("optimizer.msgSimulateFailed"));
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
          <p className="eyebrow">{t("optimizer.kicker")}</p>
          <h2 className="page-title">{t("optimizer.title")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t("optimizer.subtitle")}</p>
        </div>
        <span className="rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700">{t("optimizer.liveEngine")}</span>
      </div>
      <div className="surface grid overflow-hidden sm:grid-cols-4">
        {steps.map((step, index) => <div key={step} className={`flex items-center gap-3 border-slate-200 px-4 py-4 sm:border-r ${index < workflowStep ? "bg-accent-50/50" : ""}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index < workflowStep ? "bg-accent-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span className="text-sm font-semibold text-slate-700">{t(step)}</span></div>)}
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
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <OptimizerTimeline
          businessName={demo.schedule?.business.name}
          staff={visibleStaff}
          bookings={demo.schedule?.bookings ?? []}
          gaps={demo.schedule?.gaps ?? []}
          candidate={activeOffer?.status === "sent" ? undefined : candidate}
          idleMinutes={demo.schedule?.metrics.detectedIdleMinutes ?? 0}
        />
        <aside className="order-1 space-y-4 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <section className="surface p-5">
            <p className="eyebrow">{activeOffer?.status === "sent" ? t("optimizer.offerInProgress") : t("optimizer.chooseRecipient")}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">{activeOffer?.status === "sent" ? t("optimizer.waitingFor", { name: activeOffer.customer_name ?? "" }) : t("optimizer.whoShouldReceive")}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{activeOffer?.status === "sent" ? t("optimizer.resolveCurrentOffer") : t("optimizer.everyOptionEligible")}</p>
            {candidates.length && activeOffer?.status !== "sent" ? (
              <CandidatePicker
                candidates={candidates}
                date={demo.date}
                staff={demo.schedule?.staff ?? []}
                selectedCandidate={candidate}
                onSelect={setSelectedCandidateKey}
              />
            ) : null}
            {activeOffer?.status === "sent" ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {t("optimizer.offerStillActive", { name: activeOffer.customer_name ?? "" })}
              </div>
            ) : candidate ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-accent-50 p-4">
                  <p className="text-sm font-semibold text-accent-700">
                    {candidate.customer_name} · {candidate.service_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDay(candidate.old_start)}, {time(candidate.old_start)} → {formatDay(candidate.suggested_start)}, {time(candidate.suggested_start)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{localDateKey(candidate.old_start) === demo.date ? t("optimizer.sameDayMoveHint") : t("optimizer.crossDayMoveHint")}</p>
                </div>
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  {t("optimizer.previewChannel")}
                  <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
                    <option value="whatsapp">{t("channel.whatsapp")}</option>
                    <option value="sms">{t("channel.sms")}</option>
                    <option value="email">{t("channel.email")}</option>
                    <option value="telegram">{t("channel.telegram")}</option>
                    <option value="voice">{t("optimizer.channelVoicePreview")}</option>
                  </select>
                </label>
                <button disabled={generating} onClick={generateOffer} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {generating ? t("optimizer.sendingOffer") : t("optimizer.sendOfferTo", { name: candidate.customer_name })}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-500">{t("optimizer.noEligibleCandidate")}</p>
                {!activeOffer ? <div className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{t("optimizer.noEligibleMoves")}</div> : null}
              </div>
            )}
            <div aria-live="polite">{actionMessage ? <div className="mt-4 rounded-md border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{actionMessage}</div> : null}</div>
          </section>
          {activeOffer ? (
            <section className="surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{t("optimizer.offerLifecycle")}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{activeOffer.customer_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{activeOffer.service_name} · {formatDay(activeOffer.old_start)}, {time(activeOffer.old_start)} → {formatDay(activeOffer.suggested_start)}, {time(activeOffer.suggested_start)}</p>
                </div>
                <span aria-live="polite" className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${activeOffer.status === "accepted" ? "bg-emerald-100 text-emerald-700" : activeOffer.status === "declined" || activeOffer.status === "expired" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{t(offerStatusKey(activeOffer.status))}</span>
              </div>
              {activeOffer.status === "sent" ? <p className="mt-4 text-sm text-slate-500">{t("optimizer.listeningForResponse")}</p> : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button disabled={activeOffer.status !== "sent" || Boolean(responding)} onClick={() => simulate("accept")} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
                  {responding === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("optimizer.simulateAccept")}
                </button>
                <button disabled={activeOffer.status !== "sent" || Boolean(responding)} onClick={() => simulate("decline")} className="secondary-button disabled:cursor-not-allowed disabled:opacity-50">
                  {responding === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  {t("optimizer.simulateDecline")}
                </button>
              </div>
              {activeOffer.public_url ? <a href={activeOffer.public_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><ExternalLink className="h-4 w-4" />{t("optimizer.openCustomerLink")}</a> : null}
            </section>
          ) : null}
          {activeOffer ? <ChannelPreview channel={activeOffer.channel} message={activeOffer.message_text} /> : null}
        </aside>
      </div>
    </div>
  );
}
