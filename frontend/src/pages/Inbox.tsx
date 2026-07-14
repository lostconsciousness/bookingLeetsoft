import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPreview } from "../components/ChannelPreview";
import { api, Message, Offer, time } from "../lib/api";
import { customersFromActivity } from "./offerSelection";
import { useOfferPolling } from "./useOfferPolling";

const channels = ["whatsapp", "sms", "email", "telegram", "voice"];

export default function Inbox() {
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
      setError(err instanceof Error ? err.message : "Customer simulation is temporarily unavailable.");
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
  const previewText = selectedOffer?.message_text ?? customerMessages[0]?.body ?? "Generate an offer to see the customer preview.";

  useOfferPolling(
    selectedOffer,
    (next) => {
      const previous = selectedOffer?.status;
      setOffers((rows) => rows.map((row) => row.id === next.id ? next : row));
      if (previous === "sent" && next.status !== "sent") {
        setNotice(next.status === "accepted" ? "Customer accepted. The booking has moved." : next.status === "declined" ? "Customer declined. The original time is unchanged." : "The offer expired.");
        void load(false);
      }
    },
    (pollError) => setError(pollError.message),
  );

  async function action(kind: "accept" | "decline") {
    if (!selectedOffer || selectedOffer.status !== "sent") {
      setError("Select an active offer before simulating a response.");
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
      setNotice(kind === "accept" ? "Accepted in simulator. The selected booking has moved." : "Declined in simulator. The original booking is unchanged.");
      await load(false);
    } catch (err) {
      const responseError = err instanceof Error ? err.message : "The simulated response could not be saved.";
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
          <p className="eyebrow">Customer experience</p>
          <h2 className="page-title">See the offer through their eyes</h2>
          <p className="mt-3 text-sm text-slate-500">Choose a customer and a specific offer. Active responses update automatically.</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {error ? <div className="surface border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="surface border-accent-200 bg-accent-50 p-4 text-sm font-semibold text-accent-700">{notice}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="surface p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Customers with activity</p>
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
                  {latest ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">{latest.status}</span> : null}
                </button>
              );
            })}
            {!customers.length && !loading ? <p className="px-3 py-6 text-center text-sm text-slate-500">No customer activity yet.</p> : null}
          </div>
        </aside>
        <section className="space-y-4">
          {customerOffers.length ? (
            <div className="surface p-4">
              <label className="grid gap-1 text-sm font-medium text-slate-600">
                Offer to preview
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
                  {customerOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.service_name} · {time(offer.old_start)} → {time(offer.suggested_start)} · {offer.status}</option>)}
                </select>
              </label>
              {selectedOffer ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Sent via <strong className="capitalize text-slate-700">{selectedOffer.channel}</strong></span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${selectedOffer.status === "accepted" ? "bg-emerald-100 text-emerald-700" : selectedOffer.status === "sent" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{selectedOffer.status}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview as</p>
            <div className="flex flex-wrap gap-2">
              {channels.map((item) => (
                <button key={item} onClick={() => setChannel(item)} className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${channel === item ? "bg-accent-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                  {item === "voice" ? "Voice call" : item}
                </button>
              ))}
            </div>
          </div>
          <ChannelPreview channel={channel} message={previewText} />
          <div className="flex flex-wrap gap-2">
            <button disabled={loading || selectedOffer?.status !== "sent" || Boolean(responding)} onClick={() => action("accept")} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {responding === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Accept in simulator
            </button>
            <button disabled={loading || selectedOffer?.status !== "sent" || Boolean(responding)} onClick={() => action("decline")} className="secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              {responding === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Decline in simulator
            </button>
            {selectedOffer?.public_url ? (
              <a href={selectedOffer.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                <ExternalLink className="h-4 w-4" />
                Public offer page
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
