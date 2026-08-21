from dataclasses import dataclass
from datetime import timedelta

from app.services.gaps import BookingWindow, GapResult, has_availability


@dataclass(frozen=True)
class CandidateResult:
    gap: GapResult
    booking: BookingWindow
    suggested_start: object
    suggested_end: object
    incentive_type: str
    incentive_value: str
    estimated_saved_cost: float
    reason: str


def generate_candidates(
    gaps: list[GapResult],
    bookings: list[BookingWindow],
    max_messages_by_customer: dict[int, int],
    message_cap: int,
    default_discount_percent: int,
    max_discount_percent: int,
    candidate_bookings: list[BookingWindow] | None = None,
) -> list[CandidateResult]:
    candidates: list[CandidateResult] = []
    candidate_pool = candidate_bookings if candidate_bookings is not None else bookings
    for gap in gaps:
        future_bookings = [
            booking
            for booking in candidate_pool
            if booking.staff_id == gap.staff_id and booking.start_at >= gap.end_at
        ]
        for booking in sorted(future_bookings, key=lambda item: item.start_at):
            duration = booking.end_at - booking.start_at
            suggested_start = gap.start_at
            suggested_end = suggested_start + duration
            if suggested_end > gap.end_at:
                continue
            if not booking.service_messages:
                continue
            if max_messages_by_customer.get(booking.customer_id, 0) >= message_cap:
                continue
            if not has_availability(bookings, gap.staff_id, suggested_start, suggested_end, booking.booking_id):
                continue

            discount = min(default_discount_percent, max_discount_percent)
            discount_cost = booking.base_price * (discount / 100)
            if booking.marketing_messages and gap.estimated_idle_cost > discount_cost:
                incentive_type = "discount"
                incentive_value = str(discount)
                reason = "Discount is below the estimated idle cost and customer allows marketing text."
            elif booking.marketing_messages:
                incentive_type = "bonus"
                incentive_value = "free style refresh"
                reason = "Bonus incentive keeps the offer useful without exceeding discount value."
            else:
                incentive_type = "none"
                incentive_value = ""
                reason = "Customer allows service messages but not promotional content."

            candidates.append(
                CandidateResult(
                    gap=gap,
                    booking=booking,
                    suggested_start=suggested_start,
                    suggested_end=suggested_end,
                    incentive_type=incentive_type,
                    incentive_value=incentive_value,
                    estimated_saved_cost=gap.estimated_idle_cost,
                    reason=reason,
                )
            )
    return sorted(
        candidates,
        key=lambda candidate: (
            -candidate.estimated_saved_cost,
            candidate.suggested_start,
            candidate.booking.start_at,
            candidate.booking.booking_id,
        ),
    )
