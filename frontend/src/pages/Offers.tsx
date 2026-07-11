import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, Offer, time } from "../lib/api";

export default function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setOffers(await api.offers()); } catch { setError("Offer activity could not be loaded."); } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Offer lifecycle</p>
          <h2 className="page-title">Every recovery opportunity, tracked</h2>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
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
        {!offers.length && !loading ? <div className="surface border-dashed p-8 text-center text-sm text-slate-500">No offers yet. Generate one in the optimizer.</div> : null}
        {loading ? <div className="surface p-8 text-center text-sm text-slate-500">Loading offer activity…</div> : null}
      </div>
    </div>
  );
}
