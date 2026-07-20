import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPreview } from "../components/ChannelPreview";
import { offerStatusKey, useTranslation } from "../i18n/I18nContext";
import { api, channelLabel, Message, Offer, time } from "../lib/api";
import { customersFromActivity } from "./offerSelection";
import { useOfferPolling } from "./useOfferPolling";

const channels = ["whatsapp", "sms", "email", "telegram", "voice"];

export default function Inbox() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customerId, setCustomerId] = useState<number>();
  const [offerId, setOfferId] = useState<number>();
  const [channel, setChannel] = useState("whatsapp");
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<"accept" | "decline">();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [messageRows, offerRows] = await Promise.all([api.messages(), api.offers()]);
      setMessages(messageRows);
      setOffers(offerRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inbox.loadError"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const customers = useMemo(() => customersFromActivity(messages, offers), [messages, offers]);

  useEffect(() => {
    if (!customers.length) {
      setCustomerId(undefined);
      return;
    }
    if (!customerId || !customers.some((customer) => customer.id === customerId)) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  const customerOffers = useMemo(
    () => offers.filter((offer) => offer.customer_id === customerId),
    [offers, customerId],
  );

  useEffect(() => {
    const selected = customerOffers.find((offer) => offer.id === offerId);
    if (!selected) {
      const preferred = customerOffers.find((offer) => offer.status === "sent") ?? customerOffers[0];
      setOfferId(preferred?.id);
      if (preferred) setChannel(preferred.channel);
    }
  }, [customerOffers, offerId]);

  const selectedOffer = customerOffers.find((offer) => offer.id === offerId);
  const customerMessages = messages.filter(
    (message) => message.customer_id === customerId && (!selectedOffer || message.offer_id === selectedOffer.id),
  );
  const previewText = selectedOffer?.message_text ?? customerMessages[0]?.body ?? t("inbox.noPreviewYet");

  useOfferPolling(
    selectedOffer,
    (next) => {
      const previous = selectedOffer?.status;
      setOffers((rows) => rows.map((row) => row.id === next.id ? next : row));
      if (previous === "sent" && next.status !== "sent") {
        setNotice(next.status === "accepted" ? t("inbox.msgCustomerAccepted") : next.status === "declined" ? t("inbox.msgCustomerDeclined") : t("inbox.msgOfferExpired"));
        void load(false);
      }
    },
    (pollError) => setError(pollError.message),
  );

  async function action(kind: "accept" | "decline") {
    if (!selectedOffer || selectedOffer.status !== "sent") {
      setError(t("inbox.selectActiveOfferFirst"));
      return;
    }
    setResponding(kind);
    setError("");
    setNotice("");
    try {
      if (kind === "accept") await api.acceptOffer(selectedOffer.token);
      if (kind === "decline") await api.declineOffer(selectedOffer.token);
      const refreshed = await api.offer(selectedOffer.id);
      setOffers((rows) => rows.map((row) => row.id === refreshed.id ? refreshed : row));
      setNotice(kind === "accept" ? t("inbox.msgAccepted") : t("inbox.msgDeclined"));
      await load(false);
    } catch (err) {
      const responseError = err instanceof Error ? err.message : t("inbox.msgSaveFailed");
      await load(false);
      setError(responseError);
    } finally {
      setResponding(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t("inbox.kicker")}</p>
          <h2 className="page-title">{t("inbox.title")}</h2>
          <p className="mt-3 text-sm text-slate-500">{t("inbox.subtitle")}</p>
        </div>
        <button onClick={() => load()} className="secondary-button">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </button>
      </div>
      <div aria-live="polite">
        {error ? <div className="surface border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="surface border-accent-200 bg-accent-50 p-4 text-sm font-semibold text-accent-700">{notice}</div> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="surface p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("inbox.customersWithActivity")}</p>
          <div className="space-y-1">
            {customers.map((customer) => {
              const latest = offers.find((offer) => offer.customer_id === customer.id);
              return (
                <button
                  key={customer.id}
                  onClick={() => { setCustomerId(customer.id); setOfferId(undefined); setNotice(""); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${customerId === customer.id ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span className="font-semibold">{customer.name}</span>
                  {latest ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">{t(offerStatusKey(latest.status))}</span> : null}
                </button>
              );
            })}
            {!customers.length && !loading ? <p className="px-3 py-6 text-center text-sm text-slate-500">{t("inbox.noActivity")}</p> : null}
          </div>
        </aside>
        <section className="space-y-4">
          {customerOffers.length ? (
            <div className="surface p-4">
              <label className="grid gap-1 text-sm font-medium text-slate-600">
                {t("inbox.offerToPreview")}
                <select
                  value={offerId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    const nextOffer = customerOffers.find((offer) => offer.id === nextId);
                    setOfferId(nextId);
                    if (nextOffer) setChannel(nextOffer.channel);
                    setNotice("");
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2"
                >
                  {customerOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.service_name} · {time(offer.old_start)} → {time(offer.suggested_start)} · {t(offerStatusKey(offer.status))}</option>)}
                </select>
              </label>
              {selectedOffer ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">{t("inbox.sentVia", { channel: channelLabel(t, selectedOffer.channel) })}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${selectedOffer.status === "accepted" ? "bg-emerald-100 text-emerald-700" : selectedOffer.status === "sent" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{t(offerStatusKey(selectedOffer.status))}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("inbox.previewAs")}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("optimizer.previewChannel")}>
              {channels.map((item) => (
                <button
                  key={item}
                  role="radio"
                  aria-checked={channel === item}
                  onClick={() => setChannel(item)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${channel === item ? "bg-accent-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
                >
                  {channelLabel(t, item)}
                </button>
              ))}
            </div>
          </div>
          <ChannelPreview channel={channel} message={previewText} />
          <div className="flex flex-wrap gap-2">
            <button disabled={loading || selectedOffer?.status !== "sent" || Boolean(responding)} onClick={() => action("accept")} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {responding === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("inbox.acceptInSimulator")}
            </button>
            <button disabled={loading || selectedOffer?.status !== "sent" || Boolean(responding)} onClick={() => action("decline")} className="secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              {responding === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("inbox.declineInSimulator")}
            </button>
            {selectedOffer?.public_url ? (
              <a href={selectedOffer.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                <ExternalLink className="h-4 w-4" />
                {t("inbox.publicOfferPage")}
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
