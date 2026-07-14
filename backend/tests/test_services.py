from datetime import datetime, timedelta, timezone

from app.services.candidates import generate_candidates
from app.services.gaps import BookingWindow, detect_schedule_gaps, has_availability
from app.services.pricing import quote_smart_price
from app.services.templates import render_offer_message


def dt(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 5, 30, hour, minute, tzinfo=timezone.utc)


def booking(
    booking_id: int,
    start: datetime,
    end: datetime,
    *,
    customer_id: int = 1,
    service_messages: bool = True,
    marketing_messages: bool = True,
    price: float = 45,
) -> BookingWindow:
    return BookingWindow(
        booking_id=booking_id,
        business_id=1,
        staff_id=1,
        service_id=1,
        customer_id=customer_id,
        customer_name=f"Customer {customer_id}",
        service_name="Haircut",
        start_at=start,
        end_at=end,
        buffer_after_minutes=10,
        service_messages=service_messages,
        marketing_messages=marketing_messages,
        base_price=price,
    )


def test_gap_detection_uses_buffer_and_cost() -> None:
    windows = [booking(1, dt(12), dt(13)), booking(2, dt(15), dt(16))]

    gaps = detect_schedule_gaps(windows, {1: 24}, min_gap_minutes=30)

    assert len(gaps) == 1
    assert gaps[0].start_at == dt(13, 10)
    assert gaps[0].end_at == dt(15)
    assert gaps[0].idle_minutes == 110
    assert gaps[0].estimated_idle_cost == 44


def test_candidate_generation_skips_customer_without_service_consent() -> None:
    windows = [
        booking(1, dt(12), dt(13), customer_id=1),
        booking(2, dt(15), dt(16), customer_id=2, service_messages=False),
    ]
    gaps = detect_schedule_gaps(windows, {1: 24}, 30)

    candidates = generate_candidates(gaps, windows, {}, 3, 10, 20)

    assert candidates == []


def test_marketing_consent_blocks_discount_text() -> None:
    windows = [
        booking(1, dt(12), dt(13), customer_id=1),
        booking(2, dt(15), dt(16), customer_id=2, marketing_messages=False),
    ]
    gaps = detect_schedule_gaps(windows, {1: 24}, 30)

    candidates = generate_candidates(gaps, windows, {}, 3, 10, 20)

    assert candidates[0].incentive_type == "none"
    assert candidates[0].incentive_value == ""


def test_discount_is_capped() -> None:
    windows = [booking(1, dt(8), dt(9), price=100), booking(2, dt(12), dt(13), price=100)]
    gaps = detect_schedule_gaps(windows, {1: 100}, 30)

    candidates = generate_candidates(gaps, windows, {}, 3, default_discount_percent=30, max_discount_percent=15)

    assert candidates[0].incentive_type == "discount"
    assert candidates[0].incentive_value == "15"


def test_offer_generation_template_includes_decline_safety() -> None:
    message = render_offer_message(
        "earlier_discount",
        customer_name="Maria",
        business_name="Urban Cut Studio",
        service_name="Haircut",
        old_start=dt(15),
        new_start=dt(13, 10),
        accept_url="http://demo/offer/token",
        discount_percent="10",
    )

    assert "10% off" in message
    assert "current time stays unchanged" in message


def test_accept_flow_requires_availability_before_booking_update() -> None:
    windows = [booking(1, dt(12), dt(13)), booking(2, dt(15), dt(16)), booking(3, dt(13, 30), dt(14))]

    assert not has_availability(windows, 1, dt(13, 20), dt(14, 20), exclude_booking_id=2)
    assert has_availability(windows, 1, dt(14), dt(15), exclude_booking_id=2)


def test_decline_flow_keeps_original_booking_time() -> None:
    original = booking(2, dt(15), dt(16))
    declined_status = "declined"

    assert declined_status == "declined"
    assert original.start_at == dt(15)
    assert original.end_at == dt(16)


def test_smart_pricing_quote_caps_gap_discount() -> None:
    windows = [booking(1, dt(12), dt(13), price=100), booking(2, dt(15), dt(16), price=100)]

    quote = quote_smart_price(100, dt(13, 15), max_discount_percent=12, default_discount_percent=10, bookings=windows, staff_hourly_costs={1: 24}, min_gap_minutes=30, staff_id=1)

    assert quote.discount_percent == 12
    assert quote.adjusted_price == 88
    assert "fills-schedule-gap" in quote.pricing_tags


def test_frequency_cap_blocks_candidate() -> None:
    windows = [booking(1, dt(12), dt(13)), booking(2, dt(15), dt(16), customer_id=2)]
    gaps = detect_schedule_gaps(windows, {1: 24}, 30)

    candidates = generate_candidates(gaps, windows, {2: 3}, message_cap=3, default_discount_percent=10, max_discount_percent=20)

    assert candidates == []


def test_candidate_generation_returns_every_eligible_customer_in_ranked_order() -> None:
    windows = [
        booking(1, dt(12), dt(13), customer_id=1),
        booking(2, dt(15), dt(16), customer_id=2),
        booking(3, dt(17), dt(18), customer_id=3),
    ]
    gaps = detect_schedule_gaps(windows, {1: 24}, 30)

    candidates = generate_candidates(gaps, windows, {}, 3, 10, 20)

    assert [candidate.booking.booking_id for candidate in candidates] == [2, 3]
    assert all(candidate.suggested_start == dt(13, 10) for candidate in candidates)
