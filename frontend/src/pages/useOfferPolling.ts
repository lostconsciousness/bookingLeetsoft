import { useEffect, useRef } from "react";
import { api, Offer } from "../lib/api";

export function useOfferPolling(
  offer: Offer | undefined,
  onUpdate: (next: Offer) => void,
  onError?: (error: Error) => void,
) {
  const updateRef = useRef(onUpdate);
  const errorRef = useRef(onError);
  const checking = useRef(false);

  useEffect(() => {
    updateRef.current = onUpdate;
    errorRef.current = onError;
  }, [onUpdate, onError]);

  useEffect(() => {
    if (!offer || offer.status !== "sent") return;
    const offerId = offer.id;
    let cancelled = false;

    async function check() {
      if (checking.current) return;
      checking.current = true;
      try {
        const next = await api.offer(offerId);
        if (!cancelled) updateRef.current(next);
      } catch (error) {
        if (!cancelled) errorRef.current?.(error instanceof Error ? error : new Error("Could not refresh offer status."));
      } finally {
        checking.current = false;
      }
    }

    const interval = window.setInterval(check, 2000);
    const onFocus = () => void check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [offer?.id, offer?.status]);
}
