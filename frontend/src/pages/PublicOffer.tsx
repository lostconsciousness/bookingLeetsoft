import { CalendarCheck, CalendarX } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, time } from "../lib/api";

export default function PublicOffer() {
  const { token = "" } = useParams();
  const [offer, setOffer] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setOffer(await api.publicOffer(token));
  }

  useEffect(() => {
    load();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    if (submitting || offer?.status !== "sent") return;
    setSubmitting(true);
    try {
      const row = action === "accept" ? await api.acceptOffer(token) : await api.declineOffer(token);
      setOffer(row);
      setMessage(action === "accept" ? "Confirmed. Your appointment has been moved." : "No problem. Your current booking stays unchanged.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!offer) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Loading offer...</div>;
  }

  const isFinal = ["accepted", "declined", "expired"].includes(offer.status);
  const finalMessage =
    offer.status === "accepted"
      ? "Confirmed. Your appointment has been moved."
      : offer.status === "declined"
        ? "No problem. Your current booking stays unchanged."
        : offer.status === "expired"
          ? "This offer is no longer available. Your current booking stays unchanged."
          : "";

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <main className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">{offer.business_name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Earlier appointment available</h1>
        <p className="mt-4 text-slate-600">
          If this is convenient for you, confirm the change. Otherwise your current booking stays unchanged.
        </p>
        <div className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">{offer.service_name}</p>
          <p className="text-sm text-slate-600">Current time: {time(offer.current_start)}-{time(offer.current_end)}</p>
          <p className="text-sm text-slate-600">Proposed time: {time(offer.suggested_start)}-{time(offer.suggested_end)}</p>
          {offer.incentive_type !== "none" ? <p className="text-sm font-semibold capitalize text-accent-700">{offer.incentive_type}: {offer.incentive_value}</p> : null}
        </div>
        {message || finalMessage ? <div className="mt-5 rounded-md bg-accent-50 p-4 text-sm font-semibold text-accent-700">{message || finalMessage}</div> : null}
        {!isFinal ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button disabled={submitting} onClick={() => respond("accept")} className="inline-flex items-center justify-center gap-2 rounded-md bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <CalendarCheck className="h-4 w-4" />
              {submitting ? "Confirming..." : "Accept new time"}
            </button>
            <button disabled={submitting} onClick={() => respond("decline")} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              <CalendarX className="h-4 w-4" />
              {submitting ? "Saving..." : "Keep current time"}
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold capitalize text-slate-700">
            Offer status: {offer.status}
          </div>
        )}
      </main>
    </div>
  );
}

