from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Booking,
    Business,
    CommunicationMessage,
    Customer,
    OfferStatus,
    OptimizationPolicy,
    RescheduleOffer,
    StaffMember,
)
from app.providers.booking import booking_to_window
from app.schemas import GapOut
from app.services.candidates import CandidateResult, generate_candidates
from app.services.gaps import BookingWindow, detect_schedule_gaps

CANDIDATE_LOOKAHEAD_DAYS = 7


def day_bounds(day_text: str, tz_name: str = "Europe/Vienna") -> tuple[datetime, datetime]:
    parsed = date.fromisoformat(day_text)
    tz = ZoneInfo(tz_name)
    start = datetime.combine(parsed, time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


async def get_business_or_404(session: AsyncSession, business_id: int) -> Business:
    business = await session.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


async def get_policy(session: AsyncSession, business_id: int) -> OptimizationPolicy:
    policy = await session.scalar(select(OptimizationPolicy).where(OptimizationPolicy.business_id == business_id))
    if not policy:
        raise HTTPException(status_code=404, detail="Optimization policy not found")
    return policy


def booking_query(business_id: int):
    return (
        select(Booking)
        .options(
            selectinload(Booking.staff_member),
            selectinload(Booking.service),
            selectinload(Booking.customer).selectinload(Customer.consent),
        )
        .where(Booking.business_id == business_id)
        .order_by(Booking.start_at)
    )


async def load_bookings(
    session: AsyncSession,
    business_id: int,
    day: str,
    staff_id: int | None = None,
) -> list[Booking]:
    business = await get_business_or_404(session, business_id)
    start, end = day_bounds(day, business.timezone)
    stmt = booking_query(business_id).where(Booking.start_at >= start, Booking.start_at < end)
    if staff_id:
        stmt = stmt.where(Booking.staff_member_id == staff_id)
    return list((await session.scalars(stmt)).all())


async def load_candidate_bookings(
    session: AsyncSession,
    business_id: int,
    day: str,
    staff_id: int | None = None,
) -> list[Booking]:
    business = await get_business_or_404(session, business_id)
    start, _ = day_bounds(day, business.timezone)
    end = start + timedelta(days=CANDIDATE_LOOKAHEAD_DAYS + 1)
    stmt = booking_query(business_id).where(Booking.start_at >= start, Booking.start_at < end)
    if staff_id:
        stmt = stmt.where(Booking.staff_member_id == staff_id)
    return list((await session.scalars(stmt)).all())


async def staff_costs(session: AsyncSession, business_id: int) -> dict[int, float]:
    rows = (await session.scalars(select(StaffMember).where(StaffMember.business_id == business_id))).all()
    return {row.id: row.hourly_cost for row in rows}


async def message_counts(session: AsyncSession, business_id: int) -> dict[int, int]:
    since = datetime.utcnow() - timedelta(days=14)
    rows = await session.execute(
        select(CommunicationMessage.customer_id, func.count())
        .where(
            CommunicationMessage.business_id == business_id,
            CommunicationMessage.direction == "outbound",
            CommunicationMessage.created_at >= since,
        )
        .group_by(CommunicationMessage.customer_id)
    )
    return {customer_id: count for customer_id, count in rows.all()}


async def blocked_offer_booking_ids(
    session: AsyncSession,
    business_id: int,
    days: int = 14,
) -> set[int]:
    """Bookings that must not receive another offer during the frequency-cap window."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = await session.scalars(
        select(RescheduleOffer.booking_id).where(
            RescheduleOffer.business_id == business_id,
            RescheduleOffer.created_at >= since,
            RescheduleOffer.status.in_(
                [
                    OfferStatus.draft.value,
                    OfferStatus.sent.value,
                    OfferStatus.accepted.value,
                    OfferStatus.declined.value,
                ]
            ),
        )
    )
    return set(rows.all())


async def compute_candidates(
    session: AsyncSession,
    business_id: int,
    day: str,
    staff_id: int | None = None,
) -> tuple[list[BookingWindow], list[CandidateResult], list[GapOut]]:
    policy = await get_policy(session, business_id)
    bookings = await load_bookings(session, business_id, day, staff_id)
    windows = [booking_to_window(row) for row in bookings]
    candidate_windows = [
        booking_to_window(row)
        for row in await load_candidate_bookings(session, business_id, day, staff_id)
    ]
    gaps = detect_schedule_gaps(
        windows,
        await staff_costs(session, business_id),
        policy.min_gap_minutes_to_optimize,
    )
    candidates = generate_candidates(
        gaps,
        windows,
        await message_counts(session, business_id),
        policy.max_messages_per_customer_per_14_days,
        policy.default_discount_percent,
        policy.max_discount_percent,
        candidate_bookings=candidate_windows,
    )
    blocked_booking_ids = await blocked_offer_booking_ids(session, business_id)
    candidates = [candidate for candidate in candidates if candidate.booking.booking_id not in blocked_booking_ids]
    return windows, candidates, [GapOut(**gap.__dict__) for gap in gaps]
