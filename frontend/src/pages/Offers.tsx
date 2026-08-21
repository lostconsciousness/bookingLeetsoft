import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { offerStatusKey, useTranslation } from "../i18n/I18nContext";
import { api, channelLabel, formatIncentive, Offer, time } from "../lib/api";

export default function Offers() {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setOffers(await api.offers()); } catch { setError(t("offers.loadError")); } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t("offers.kicker")}</p>
          <h2 className="page-title">{t("offers.title")}</h2>
        </div>
        <button onClick={load} className="secondary-button">
          <RefreshCw className="h-4 w-4" />
          {t("common.refresh")}
        </button>
      </div>
      {error ? <div className="surface border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-4">
        {offers.map((offer) => (
          <article key={offer.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">{offer.customer_name}</p>
                <p className="text-sm text-slate-500">
                  {offer.service_name} · {time(offer.old_start)} → {time(offer.suggested_start)}
                </p>
              </div>
              <span className="rounded-md bg-accent-50 px-3 py-1 text-sm font-semibold capitalize text-accent-700">{t(offerStatusKey(offer.status))}</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[180px_180px_1fr_auto]">
              <div className="text-sm">
                <p className="font-semibold text-slate-700">{t("offers.incentive")}</p>
                <p className="text-slate-500">{formatIncentive(offer.incentive_type, offer.incentive_value, t)}</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-700">{t("offers.channel")}</p>
                <p className="text-slate-500">{channelLabel(t, offer.channel)}</p>
              </div>
              <p className="break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{offer.message_text}</p>
              <a href={offer.public_url} target="_blank" rel="noreferrer" className="secondary-button h-10">
                <ExternalLink className="h-4 w-4" />
                {t("common.open")}
              </a>
            </div>
          </article>
        ))}
        {!offers.length && !loading ? <div className="surface border-dashed p-8 text-center text-sm text-slate-500">{t("offers.empty")}</div> : null}
        {loading ? <div className="surface p-8 text-center text-sm text-slate-500">{t("offers.loading")}</div> : null}
      </div>
    </div>
  );
}
