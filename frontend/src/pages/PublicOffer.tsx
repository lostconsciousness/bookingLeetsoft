import { CalendarCheck, CalendarX } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { offerStatusKey, useTranslation } from "../i18n/I18nContext";
import { api, formatIncentive, PublicOffer as PublicOfferType, time } from "../lib/api";

export default function PublicOffer() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const [offer, setOffer] = useState<PublicOfferType | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"accept" | "decline">();

  async function load() {
    setError("");
    try { setOffer(await api.publicOffer(token)); } catch { setError(t("publicOffer.loadError")); }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    if (submitting || offer?.status !== "sent") return;
    setSubmitting(action);
    setError("");
    try {
      const row = action === "accept" ? await api.acceptOffer(token) : await api.declineOffer(token);
      setOffer(row);
      setMessage(action === "accept" ? t("publicOffer.confirmedMoved") : t("publicOffer.declinedUnchanged"));
    } catch (err) {
      const responseMessage = err instanceof Error ? err.message : t("publicOffer.responseFailed");
      try {
        setOffer(await api.publicOffer(token));
      } catch {
        // Keep the currently displayed offer if status refresh also fails.
      }
      setError(responseMessage);
    } finally {
      setSubmitting(undefined);
    }
  }

  if (!offer) {
    return (
      <div className="grid min-h-screen place-items-center bg-accent-900 px-6 text-center text-emerald-50">
        <div className="space-y-6">
          <LanguageSwitcher className="mx-auto w-fit" />
          <p>{error || t("publicOffer.loading")}</p>
        </div>
      </div>
    );
  }

  const isFinal = ["accepted", "declined", "expired"].includes(offer.status);
  const finalMessage =
    offer.status === "accepted"
      ? t("publicOffer.confirmedMoved")
      : offer.status === "declined"
        ? t("publicOffer.declinedUnchanged")
        : offer.status === "expired"
          ? t("publicOffer.expired")
          : "";

  return (
    <div className="grid min-h-screen place-items-center bg-accent-900 px-4 py-10">
      <main className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-lift sm:p-9">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher variant="light" />
        </div>
        <p className="eyebrow">{offer.business_name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("publicOffer.heading")}</h1>
        <p className="mt-4 text-slate-600">
          {t("publicOffer.body")}
        </p>
        <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-950">{offer.service_name}</p>
          <p className="text-sm text-slate-600">{t("publicOffer.currentTime", { range: `${time(offer.current_start)}-${time(offer.current_end)}` })}</p>
          <p className="text-sm text-slate-600">{t("publicOffer.proposedTime", { range: `${time(offer.suggested_start)}-${time(offer.suggested_end)}` })}</p>
          {offer.incentive_type !== "none" ? <p className="text-sm font-semibold text-accent-700">{formatIncentive(offer.incentive_type, offer.incentive_value, t)}</p> : null}
        </div>
        <div aria-live="polite">
          {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
          {message || finalMessage ? <div className="mt-5 rounded-md bg-accent-50 p-4 text-sm font-semibold text-accent-700">{message || finalMessage}</div> : null}
        </div>
        {!isFinal ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button disabled={Boolean(submitting)} onClick={() => respond("accept")} className="primary-button py-3 disabled:cursor-not-allowed disabled:opacity-60">
              <CalendarCheck className="h-4 w-4" />
              {submitting === "accept" ? t("publicOffer.confirming") : t("publicOffer.acceptNewTime")}
            </button>
            <button disabled={Boolean(submitting)} onClick={() => respond("decline")} className="secondary-button py-3 disabled:cursor-not-allowed disabled:opacity-60">
              <CalendarX className="h-4 w-4" />
              {submitting === "decline" ? t("publicOffer.saving") : t("publicOffer.keepCurrentTime")}
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold capitalize text-slate-700">
            {t("publicOffer.statusLabel", { status: t(offerStatusKey(offer.status)) })}
          </div>
        )}
      </main>
    </div>
  );
}
