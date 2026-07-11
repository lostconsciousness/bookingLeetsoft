const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Business = {
  id: number;
  name: string;
  type: string;
  timezone: string;
  currency: string;
};

export type Staff = { id: number; name: string; role: string; hourly_cost: number };
export type Service = { id: number; name: string; duration_minutes: number; base_price: number; buffer_after_minutes: number };
export type Customer = {
  id: number;
  name: string;
  prefers_earlier_slots: boolean;
  flexible_dropoff: boolean;
  service_messages: boolean;
  marketing_messages: boolean;
};

export type Booking = {
  id: number;
  business_id: number;
  staff_member_id: number;
  service_id: number;
  customer_id: number;
  start_at: string;
  end_at: string;
  status: string;
  staff_name: string;
  service_name: string;
  customer_name: string;
  buffer_after_minutes: number;
};

export type Gap = {
  business_id: number;
  staff_id: number;
  start_at: string;
  end_at: string;
  idle_minutes: number;
  estimated_idle_cost: number;
  previous_booking_id: number;
  next_booking_id: number;
};

export type Candidate = {
  booking_id: number;
  customer_name: string;
  service_name: string;
  old_start: string;
  old_end: string;
  suggested_start: string;
  suggested_end: string;
  incentive_type: string;
  incentive_value: string;
  estimated_saved_cost: number;
  reason: string;
  gap: Gap;
};

export type Schedule = {
  business: Business;
  staff: Staff[];
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  gaps: Gap[];
  candidates: Candidate[];
  metrics: {
    totalBookingsToday: number;
    detectedIdleMinutes: number;
    estimatedSavedCost: number;
    actualSavedCost: number;
    staffUtilizationPercent: number;
    generatedOffers: number;
    acceptedOffers: number;
    declinedOffers: number;
    sentOffers: number;
    expiredOffers: number;
    dailySavings: { date: string; amount: number }[];
  };
};

export type Offer = {
  id: number;
  token: string;
  booking_id: number;
  customer_id: number;
  business_id: number;
  old_start: string;
  old_end: string;
  suggested_start: string;
  suggested_end: string;
  incentive_type: string;
  incentive_value: string;
  message_text: string;
  status: string;
  channel: string;
  expires_at: string;
  created_at: string;
  customer_name?: string;
  business_name?: string;
  service_name?: string;
  public_url?: string;
};

export type PublicOffer = {
  id: number;
  token: string;
  business_name: string;
  service_name: string;
  customer_name: string;
  current_start: string;
  current_end: string;
  suggested_start: string;
  suggested_end: string;
  incentive_type: string;
  incentive_value: string;
  status: "sent" | "accepted" | "declined" | "expired";
  message_text: string;
};

export type Message = {
  id: number;
  business_id: number;
  customer_id: number;
  offer_id?: number;
  channel: string;
  direction: string;
  body: string;
  delivery_status: string;
  created_at: string;
  customer_name?: string;
};

export type Settings = {
  businessId: number;
  minGapMinutesToOptimize: number;
  defaultDiscountPercent: number;
  maxDiscountPercent: number;
  maxMessagesPerCustomerPer14Days: number;
  enabledChannels: string;
  timezone: string;
  currency: string;
};

export type Quote = {
  basePrice: number;
  adjustedPrice: number;
  discountPercent: number;
  reason: string;
  pricingTags: string[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json();
}

export const api = {
  apiUrl: API_URL,
  today: () => new Date().toISOString().slice(0, 10),
  seed: () => request<{ status: string }>("/api/demo/seed", { method: "POST" }),
  businesses: () => request<Business[]>("/api/businesses"),
  schedule: (businessId: number, date: string, staffId?: number) =>
    request<Schedule>(`/api/schedule?businessId=${businessId}&date=${date}${staffId ? `&staffId=${staffId}` : ""}`),
  offers: () => request<Offer[]>("/api/offers"),
  generateOffer: (businessId: number, date: string, staffId?: number, bookingId?: number, channel = "whatsapp") =>
    request<Offer>("/api/optimization/generate-offer", {
      method: "POST",
      body: JSON.stringify({ businessId, date, staffId, bookingId, channel }),
    }),
  messages: (customerId?: number) => request<Message[]>(`/api/messages${customerId ? `?customerId=${customerId}` : ""}`),
  publicOffer: (token: string) => request<PublicOffer>(`/api/public/offers/${token}`),
  acceptOffer: (token: string) => request<PublicOffer>(`/api/public/offers/${token}/accept`, { method: "POST" }),
  declineOffer: (token: string) => request<PublicOffer>(`/api/public/offers/${token}/decline`, { method: "POST" }),
  quote: (payload: { businessId: number; serviceId: number; staffId?: number; requestedStart: string }) =>
    request<Quote>("/api/smart-pricing/quote", { method: "POST", body: JSON.stringify(payload) }),
  settings: (businessId: number) => request<Settings>(`/api/settings/${businessId}`),
  patchSettings: (businessId: number, payload: Partial<Settings>) =>
    request<Settings>(`/api/settings/${businessId}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

export function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function money(value: number | undefined | null) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0);
}

export function dateTimeLocal(day: string, hour = "09:00") {
  return `${day}T${hour}`;
}
