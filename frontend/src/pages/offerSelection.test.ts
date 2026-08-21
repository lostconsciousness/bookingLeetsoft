import { describe, expect, it } from "vitest";
import { Message, Offer } from "../lib/api";
import { customersFromActivity, findLatestOffer } from "./offerSelection";

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
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
    customer_name: "Maria",
    service_name: "Haircut",
    ...overrides,
  };
}

describe("offer selection", () => {
  it("restores only the active offer matching business, date, and staff", () => {
    const rows = [
      offer({ id: 1, business_id: 99 }),
      offer({ id: 2, staff_member_id: 22 }),
      offer({ id: 3 }),
    ];

    expect(findLatestOffer(rows, 41, "2026-07-15", 21)?.id).toBe(3);
  });

  it("restores a cross-day offer on the day of its proposed slot", () => {
    const row = offer({
      id: 4,
      old_start: "2026-07-16T15:00:00+03:00",
      old_end: "2026-07-16T16:00:00+03:00",
      suggested_start: "2026-07-15T13:00:00+03:00",
      suggested_end: "2026-07-15T14:00:00+03:00",
    });

    expect(findLatestOffer([row], 41, "2026-07-15", 21)?.id).toBe(4);
  });

  it("restores a final customer response after navigation or reload", () => {
    const row = offer({ id: 5, status: "declined" });

    expect(findLatestOffer([row], 41, "2026-07-15", 21)?.status).toBe("declined");
  });

  it("keeps the customer list stable and prioritizes active offers", () => {
    const messages: Message[] = [{
      id: 1,
      business_id: 41,
      customer_id: 32,
      channel: "sms",
      direction: "outbound",
      body: "Hello",
      delivery_status: "mock_delivered",
      created_at: "2026-07-15T12:00:00+03:00",
      customer_name: "Lukas",
    }];
    const rows = [offer({ customer_id: 31, customer_name: "Maria" })];

    expect(customersFromActivity(messages, rows).map((customer) => customer.name)).toEqual(["Maria", "Lukas"]);
  });
});
