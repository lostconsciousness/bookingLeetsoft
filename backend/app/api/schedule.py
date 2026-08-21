from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.serializers import booking_out, candidate_out
from app.db.session import get_session
from app.models import Booking, Business, Customer, OfferStatus, RescheduleOffer, Service, StaffMember
from app.schemas import BusinessOut, ScheduleOut, ServiceOut, StaffOut
from app.services.scheduling import compute_candidates, get_business_or_404, load_bookings

router = APIRouter(prefix="/api")


@router.get("/businesses", response_model=list[BusinessOut])
async def businesses(session: AsyncSession = Depends(get_session)) -> list[Business]:
    rows = list((await session.scalars(select(Business).order_by(Business.id.desc()))).all())
    unique: dict[tuple[str, str], Business] = {}
    for row in rows:
        unique.setdefault((row.name, row.type), row)
    return sorted(unique.values(), key=lambda row: row.id)


@router.get("/businesses/{business_id}", response_model=BusinessOut)
async def business_detail(business_id: int, session: AsyncSession = Depends(get_session)) -> Business:
    return await get_business_or_404(session, business_id)


def build_daily_savings(selected_day: str) -> dict[str, float]:
    return {
        (date.fromisoformat(selected_day) - timedelta(days=index)).isoformat(): 0
        for index in range(6, -1, -1)
    }


@router.get("/schedule", response_model=ScheduleOut)
async def schedule(
    businessId: int = Query(...),
    date: str = Query(...),
    staffId: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> ScheduleOut:
    business = await get_business_or_404(session, businessId)
    staff = list((await session.scalars(select(StaffMember).where(StaffMember.business_id == businessId).order_by(StaffMember.id))).all())
    services = list((await session.scalars(select(Service).where(Service.business_id == businessId).order_by(Service.id))).all())
    customers = list((await session.scalars(select(Customer).options(selectinload(Customer.consent)).where(Customer.business_id == businessId).order_by(Customer.id))).all())
    bookings = await load_bookings(session, businessId, date, staffId)
    _, candidates, gaps = await compute_candidates(session, businessId, date, staffId)
    offers = list(
        (
            await session.scalars(
                select(RescheduleOffer)
                .options(selectinload(RescheduleOffer.booking).selectinload(Booking.staff_member))
                .where(RescheduleOffer.business_id == businessId)
            )
        ).all()
    )

    total_minutes = sum(int((booking.end_at - booking.start_at).total_seconds() // 60) for booking in bookings)
    idle_minutes = sum(gap.idle_minutes for gap in gaps)
    utilization = round((total_minutes / (total_minutes + idle_minutes)) * 100, 1) if total_minutes + idle_minutes else 0
    daily_savings = build_daily_savings(date)
    for offer in offers:
        if offer.status != OfferStatus.accepted.value or not offer.booking or not offer.booking.staff_member:
            continue
        day_key = offer.suggested_start.date().isoformat()
        if day_key not in daily_savings:
            continue
        moved_minutes = max(0, int((offer.old_start - offer.suggested_start).total_seconds() // 60))
        daily_savings[day_key] += round((moved_minutes / 60) * offer.booking.staff_member.hourly_cost, 2)

    eligible_gap_values = {
        (candidate.gap.staff_id, candidate.gap.start_at): candidate.estimated_saved_cost
        for candidate in candidates
    }
    metrics = {
        "totalBookingsToday": len(bookings),
        "detectedIdleMinutes": idle_minutes,
        "estimatedSavedCost": round(sum(eligible_gap_values.values()), 2),
        "actualSavedCost": round(sum(daily_savings.values()), 2),
        "staffUtilizationPercent": utilization,
        "generatedOffers": len(offers),
        "acceptedOffers": len([offer for offer in offers if offer.status == OfferStatus.accepted.value]),
        "declinedOffers": len([offer for offer in offers if offer.status == OfferStatus.declined.value]),
        "sentOffers": len([offer for offer in offers if offer.status == OfferStatus.sent.value]),
        "expiredOffers": len([offer for offer in offers if offer.status == OfferStatus.expired.value]),
        "dailySavings": [{"date": day, "amount": round(amount, 2)} for day, amount in daily_savings.items()],
    }
    return ScheduleOut(
        business=BusinessOut.model_validate(business),
        staff=[StaffOut.model_validate(row) for row in staff],
        services=[ServiceOut.model_validate(row) for row in services],
        customers=[
            {
                "id": row.id,
                "name": row.name,
                "prefers_earlier_slots": row.prefers_earlier_slots,
                "flexible_dropoff": row.flexible_dropoff,
                "service_messages": row.consent.service_messages,
                "marketing_messages": row.consent.marketing_messages,
            }
            for row in customers
        ],
        bookings=[booking_out(row) for row in bookings],
        gaps=gaps,
        candidates=[candidate_out(row) for row in candidates],
        metrics=metrics,
    )
