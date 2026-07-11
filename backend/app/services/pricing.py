from dataclasses import dataclass
from datetime import datetime

from app.services.gaps import BookingWindow, detect_schedule_gaps


@dataclass(frozen=True)
class PricingQuote:
    base_price: float
    adjusted_price: float
    discount_percent: int
    reason: str
    pricing_tags: list[str]


def quote_smart_price(
    base_price: float,
    requested_start: datetime,
    max_discount_percent: int,
    default_discount_percent: int,
    bookings: list[BookingWindow],
    staff_hourly_costs: dict[int, float],
    min_gap_minutes: int,
    staff_id: int | None = None,
) -> PricingQuote:
    tags: list[str] = []
    discount = 0
    hour = requested_start.hour

    if hour < 10:
        discount = max(discount, min(default_discount_percent, max_discount_percent))
        tags.append("early-low-demand")

    relevant_bookings = [booking for booking in bookings if staff_id is None or booking.staff_id == staff_id]
    gaps = detect_schedule_gaps(relevant_bookings, staff_hourly_costs, min_gap_minutes)
    if any(gap.start_at <= requested_start < gap.end_at for gap in gaps):
        discount = max(discount, min(default_discount_percent + 5, max_discount_percent))
        tags.append("fills-schedule-gap")

    if 16 <= hour <= 18 and discount == 0:
        tags.append("prime-time")
        reason = "Prime-time appointment slots usually keep standard pricing."
    elif "fills-schedule-gap" in tags:
        reason = "This slot helps close an idle gap, so a capped discount is available."
    elif "early-low-demand" in tags:
        reason = "Earlier low-demand slots can receive a modest discount."
    else:
        tags.append("standard")
        reason = "Standard slot with no optimization discount."

    adjusted_price = round(base_price * (1 - discount / 100), 2)
    return PricingQuote(base_price=base_price, adjusted_price=adjusted_price, discount_percent=discount, reason=reason, pricing_tags=tags)

