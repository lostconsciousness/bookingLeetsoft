from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.serializers import candidate_out, offer_out
from app.core.config import settings
from app.db.session import get_session
from app.models import Booking, OfferStatus, RescheduleOffer
from app.providers.communication import MockCommunicationProvider
from app.schemas import CandidateOut, GapOut, GenerateOfferIn, OfferOut
from app.services.scheduling import active_offer_booking_ids, compute_candidates, get_business_or_404
from app.services.templates import render_offer_message

router = APIRouter(prefix="/api")


@router.get("/gaps", response_model=list[GapOut])
async def gaps(
    businessId: int = Query(...),
    date: str = Query(...),
    staffId: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[GapOut]:
    _, _, gap_rows = await compute_candidates(session, businessId, date, staffId)
    return gap_rows


@router.post("/optimization/detect-gaps", response_model=list[GapOut])
async def detect_gaps(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> list[GapOut]:
    _, _, gap_rows = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    return gap_rows


@router.post("/optimization/generate-candidates", response_model=list[CandidateOut])
async def candidates(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> list[CandidateOut]:
    _, rows, _ = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    return [candidate_out(row) for row in rows]


def offer_template_key(business_type: str, incentive_type: str) -> str:
    if business_type == "auto_service":
        return "auto_dropoff"
    if incentive_type == "discount":
        return "earlier_discount"
    if incentive_type == "bonus":
        return "earlier_bonus"
    return "earlier_none"


@router.post("/optimization/generate-offer", response_model=OfferOut)
async def generate_offer(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> OfferOut:
    business = await get_business_or_404(session, payload.business_id)
    if payload.booking_id and payload.booking_id in await active_offer_booking_ids(session, payload.business_id):
        raise HTTPException(status_code=409, detail="An active offer already exists for this booking")

    _, candidate_rows, _ = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    if payload.booking_id:
        candidate_rows = [row for row in candidate_rows if row.booking.booking_id == payload.booking_id]
    if payload.suggested_start:
        candidate_rows = [row for row in candidate_rows if row.suggested_start == payload.suggested_start]
    if not candidate_rows:
        raise HTTPException(status_code=400, detail="No eligible rescheduling candidate found")
    candidate = candidate_rows[0]

    booking = await session.scalar(
        select(Booking)
        .options(selectinload(Booking.customer), selectinload(Booking.service), selectinload(Booking.staff_member))
        .where(Booking.id == candidate.booking.booking_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    token = uuid4().hex
    accept_url = f"{settings.frontend_url}/offer/{token}"
    incentive = f"{candidate.incentive_value}% discount" if candidate.incentive_type == "discount" else candidate.incentive_value or "no incentive"
    message = render_offer_message(
        offer_template_key(business.type, candidate.incentive_type),
        customer_name=booking.customer.name,
        business_name=business.name,
        service_name=booking.service.name,
        old_start=booking.start_at,
        new_start=candidate.suggested_start,
        accept_url=accept_url,
        discount_percent=candidate.incentive_value,
        bonus_name=candidate.incentive_value,
        incentive=incentive,
    )
    offer = RescheduleOffer(
        token=token,
        booking_id=booking.id,
        customer_id=booking.customer_id,
        business_id=business.id,
        old_start=booking.start_at,
        old_end=booking.end_at,
        suggested_start=candidate.suggested_start,
        suggested_end=candidate.suggested_end,
        incentive_type=candidate.incentive_type,
        incentive_value=candidate.incentive_value,
        message_text=message,
        status=OfferStatus.sent.value,
        channel=payload.channel,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
    )
    session.add(offer)
    await session.flush()
    await MockCommunicationProvider(session).send_message(payload.channel, booking.customer, message, business.id, offer.id)
    await session.commit()
    refreshed = await session.scalar(
        select(RescheduleOffer)
        .options(
            selectinload(RescheduleOffer.booking).selectinload(Booking.service),
            selectinload(RescheduleOffer.customer),
            selectinload(RescheduleOffer.business),
        )
        .where(RescheduleOffer.id == offer.id)
    )
    return offer_out(refreshed)
