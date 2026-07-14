import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("generateOffer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the local calendar date for the demo schedule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 0, 30));

    expect(api.today()).toBe("2026-07-15");
  });

  it("sends the exact selected booking and suggested time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.generateOffer(1, "2026-07-15", 2, 30, "2026-07-15T13:10:00+03:00", "sms");

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      businessId: 1,
      date: "2026-07-15",
      staffId: 2,
      bookingId: 30,
      suggestedStart: "2026-07-15T13:10:00+03:00",
      channel: "sms",
    });
  });

  it("surfaces FastAPI detail messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Conflict",
      text: async () => JSON.stringify({ detail: "Offer is already accepted" }),
    }));

    await expect(api.offer(1)).rejects.toThrow("Offer is already accepted");
  });
});
