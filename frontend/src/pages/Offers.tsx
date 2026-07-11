import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, Offer, time } from "../lib/api";

export default function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);

  async function load() {
    setOffers(await api.offers());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Offers</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-950">Generated rescheduling offers</h2>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <div className="grid gap-4">
        {offers.map((offer) => (
          <article key={offer.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">{offer.customer_name}</p>
                <p className="text-sm text-slate-500">
                  {offer.service_name} · {time(offer.old_start)} → {time(offer.suggested_start)}
                </p>
              </div>
              <span className="rounded-md bg-accent-50 px-3 py-1 text-sm font-semibold capitalize text-accent-700">{offer.status}</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[180px_180px_1fr_auto]">
              <div className="text-sm">
                <p className="font-semibold text-slate-700">Incentive</p>
                <p className="capitalize text-slate-500">{offer.incentive_type} {offer.incentive_value}</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-700">Channel</p>
                <p className="capitalize text-slate-500">{offer.channel}</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">{offer.message_text}</p>
              <a href={offer.public_url} target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </div>
          </article>
        ))}
        {!offers.length ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No offers yet. Generate one in the optimizer.</div> : null}
      </div>
    </div>
  );
}

