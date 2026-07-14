import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, Offer } from "../lib/api";
import { useOfferPolling } from "./useOfferPolling";

const activeOffer: Offer = {
  id: 1,
  token: "token",
  booking_id: 11,
  staff_member_id: 21,
  customer_id: 31,
  business_id: 41,
  old_start: "2026-07-15T15:00:00+03:00",
  old_end: "2026-07-15T16:00:00+03:00",
  suggested_start: "2026-07-15T13:00:00+03:00",
  suggested_end: "2026-07-15T14:00:00+03:00",
  incentive_type: "discount",
  incentive_value: "10",
  message_text: "Move earlier?",
  status: "sent",
  channel: "whatsapp",
  expires_at: "2026-07-15T20:00:00+03:00",
  created_at: "2026-07-15T10:00:00+03:00",
};

describe("useOfferPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("checks an active offer every two seconds", async () => {
    vi.useFakeTimers();
    const updated = { ...activeOffer, status: "accepted" as const };
    vi.spyOn(api, "offer").mockResolvedValue(updated);
    const onUpdate = vi.fn();

    renderHook(() => useOfferPolling(activeOffer, onUpdate));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(api.offer).toHaveBeenCalledWith(activeOffer.id);
    expect(onUpdate).toHaveBeenCalledWith(updated);
  });
});
