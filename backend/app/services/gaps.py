from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class BookingWindow:
    booking_id: int
    business_id: int
    staff_id: int
    service_id: int
    customer_id: int
    customer_name: str
    service_name: str
    start_at: datetime
    end_at: datetime
    buffer_after_minutes: int
    service_messages: bool
    marketing_messages: bool
    base_price: float


@dataclass(frozen=True)
class GapResult:
    business_id: int
    staff_id: int
    start_at: datetime
    end_at: datetime
    idle_minutes: int
    estimated_idle_cost: float
    previous_booking_id: int
    next_booking_id: int


def detect_schedule_gaps(
    bookings: list[BookingWindow],
    staff_hourly_costs: dict[int, float],
    min_gap_minutes: int,
) -> list[GapResult]:
    gaps: list[GapResult] = []
    by_staff: dict[int, list[BookingWindow]] = {}
    for booking in bookings:
        by_staff.setdefault(booking.staff_id, []).append(booking)

    for staff_id, staff_bookings in by_staff.items():
        ordered = sorted(staff_bookings, key=lambda item: item.start_at)
        for previous, next_booking in zip(ordered, ordered[1:]):
            gap_start = previous.end_at + timedelta(minutes=previous.buffer_after_minutes)
            gap_end = next_booking.start_at
            idle_minutes = int((gap_end - gap_start).total_seconds() // 60)
            if idle_minutes < min_gap_minutes:
                continue
            hourly_cost = staff_hourly_costs.get(staff_id, 0)
            gaps.append(
                GapResult(
                    business_id=previous.business_id,
                    staff_id=staff_id,
                    start_at=gap_start,
                    end_at=gap_end,
                    idle_minutes=idle_minutes,
                    estimated_idle_cost=round((idle_minutes / 60) * hourly_cost, 2),
                    previous_booking_id=previous.booking_id,
                    next_booking_id=next_booking.booking_id,
                )
            )
    return gaps


def has_availability(
    bookings: list[BookingWindow],
    staff_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: int | None = None,
) -> bool:
    for booking in bookings:
        if booking.staff_id != staff_id or booking.booking_id == exclude_booking_id:
            continue
        if start_at < booking.end_at and end_at > booking.start_at:
            return False
    return True

