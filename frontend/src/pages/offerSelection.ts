import { Candidate, Message, Offer } from "../lib/api";

export function candidateKey(candidate: Candidate) {
  return `${candidate.booking_id}-${candidate.suggested_start}`;
}

export function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function findActiveOffer(
  offers: Offer[],
  businessId: number,
  date: string,
  staffId?: number,
) {
  return offers.find(
    (offer) =>
      offer.status === "sent" &&
      offer.business_id === businessId &&
      localDateKey(offer.old_start) === date &&
      (!staffId || offer.staff_member_id === staffId),
  );
}

export function customersFromActivity(messages: Message[], offers: Offer[]) {
  const activity = new Map<number, { id: number; name: string; timestamp: number; hasSentOffer: boolean }>();

  for (const offer of offers) {
    const current = activity.get(offer.customer_id);
    const timestamp = new Date(offer.created_at).getTime();
    activity.set(offer.customer_id, {
      id: offer.customer_id,
      name: offer.customer_name ?? `Customer ${offer.customer_id}`,
      timestamp: Math.max(timestamp, current?.timestamp ?? 0),
      hasSentOffer: offer.status === "sent" || Boolean(current?.hasSentOffer),
    });
  }

  for (const message of messages) {
    const current = activity.get(message.customer_id);
    const timestamp = new Date(message.created_at).getTime();
    activity.set(message.customer_id, {
      id: message.customer_id,
      name: message.customer_name ?? current?.name ?? `Customer ${message.customer_id}`,
      timestamp: Math.max(timestamp, current?.timestamp ?? 0),
      hasSentOffer: Boolean(current?.hasSentOffer),
    });
  }

  return Array.from(activity.values()).sort(
    (a, b) => Number(b.hasSentOffer) - Number(a.hasSentOffer) || b.timestamp - a.timestamp || a.name.localeCompare(b.name),
  );
}
