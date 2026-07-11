import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPreview } from "../components/ChannelPreview";
import { api, Message, Offer } from "../lib/api";

const channels = ["whatsapp", "sms", "email", "telegram", "voice"];

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [channel, setChannel] = useState("whatsapp");

  async function load() {
    const [messageRows, offerRows] = await Promise.all([api.messages(customerId), api.offers()]);
    setMessages(messageRows);
    setOffers(offerRows);
  }

  useEffect(() => {
    load();
  }, [customerId]);

  const customers = useMemo(() => {
    const map = new Map<number, string>();
    messages.forEach((message) => map.set(message.customer_id, message.customer_name ?? `Customer ${message.customer_id}`));
    offers.forEach((offer) => map.set(offer.customer_id, offer.customer_name ?? `Customer ${offer.customer_id}`));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [messages, offers]);

  const latestOffer = offers.find((offer) => !customerId || offer.customer_id === customerId);
  const latestMessage = messages.find((message) => !customerId || message.customer_id === customerId);
  const previewText = latestOffer?.message_text ?? latestMessage?.body ?? "Generate an offer to see the customer preview.";

  async function action(kind: "accept" | "decline") {
    if (!latestOffer) return;
    if (kind === "accept") await api.acceptOffer(latestOffer.token);
    if (kind === "decline") await api.declineOffer(latestOffer.token);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Customer Inbox Simulator</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-950">Mock customer communication</h2>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <button onClick={() => setCustomerId(undefined)} className="mb-2 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
            All customers
          </button>
          {customers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => setCustomerId(customer.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${customerId === customer.id ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {customer.name}
            </button>
          ))}
        </aside>
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {channels.map((item) => (
              <button key={item} onClick={() => setChannel(item)} className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${channel === item ? "bg-accent-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                {item === "voice" ? "Voice call" : item}
              </button>
            ))}
          </div>
          <ChannelPreview channel={channel} message={previewText} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => action("accept")} className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white">Accept in simulator</button>
            <button onClick={() => action("decline")} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Decline in simulator</button>
            {latestOffer?.public_url ? (
              <a href={latestOffer.public_url} target="_blank" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
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

