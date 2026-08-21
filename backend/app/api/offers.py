from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.serializers import expire_if_needed, offer_out, public_offer_out
from app.db.session import get_session
from app.models import Booking, CommunicationMessage, Customer, OfferStatus, RescheduleOffer
from app.providers.booking import MockBookingProviderAdapter
from app.providers.communication import MockCommunicationProvider
from app.schemas import MessageOut, OfferOut, PublicOfferOut
from app.services.templates import render_offer_message

router = APIRouter(prefix="/api")


def offer_query():
    return select(RescheduleOffer).options(
        selectinload(RescheduleOffer.booking).selectinload(Booking.service),
        selectinload(RescheduleOffer.customer),
        selectinload(RescheduleOffer.business),
    )


async def offer_by_id(session: AsyncSession, offer_id: int) -> RescheduleOffer:
    offer = await session.scalar(offer_query().where(RescheduleOffer.id == offer_id))
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


async def public_offer_by_token(
    session: AsyncSession,
    token: str,
    *,
    for_update: bool = False,
) -> RescheduleOffer:
    stmt = offer_query().where(RescheduleOffer.token == token)
    if for_update:
        stmt = stmt.with_for_update()
    offer = await session.scalar(stmt)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.get("/offers", response_model=list[OfferOut])
async def offers(session: AsyncSession = Depends(get_session)) -> list[OfferOut]:
    rows = (await session.scalars(offer_query().order_by(RescheduleOffer.created_at.desc()))).all()
    expired = False
    for row in rows:
        if expire_if_needed(row):
            expired = True
    if expired:
        await session.commit()
    return [offer_out(row) for row in rows]


@router.get("/offers/{offer_id}", response_model=OfferOut)
async def offer_detail(offer_id: int, session: AsyncSession = Depends(get_session)) -> OfferOut:
    offer = await offer_by_id(session, offer_id)
    if expire_if_needed(offer):
        await session.commit()
    return offer_out(offer)


@router.get("/public/offers/{token}", response_model=PublicOfferOut)
async def public_offer(token: str, session: AsyncSession = Depends(get_session)) -> PublicOfferOut:
    offer = await public_offer_by_token(session, token)
    if expire_if_needed(offer):
        await session.commit()
    return public_offer_out(offer)


@router.post("/public/offers/{token}/accept", response_model=PublicOfferOut)
async def accept_offer(token: str, session: AsyncSession = Depends(get_session)) -> PublicOfferOut:
    offer = await public_offer_by_token(session, token, for_update=True)
    if offer.status == OfferStatus.accepted.value:
        return public_offer_out(offer)
    if offer.status != OfferStatus.sent.value:
        raise HTTPException(status_code=409, detail=f"Offer is already {offer.status}")
    if expire_if_needed(offer):
        await session.commit()
        raise HTTPException(status_code=409, detail="Offer has expired")

    provider = MockBookingProviderAdapter(session)
    available = await provider.check_availability(
        offer.booking.staff_member_id,
        offer.suggested_start,
        offer.suggested_end,
        offer.booking_id,
    )
    if not available:
        offer.status = OfferStatus.expired.value
        await session.commit()
        raise HTTPException(status_code=409, detail="Suggested slot is no longer available")

    await provider.update_booking_time(offer.booking_id, offer.suggested_start, offer.suggested_end)
    offer.status = OfferStatus.accepted.value
    await MockCommunicationProvider(session).record_customer_reply(
        offer.channel,
        offer.customer,
        "Customer accepted the proposed appointment time.",
        offer.business_id,
        offer.id,
    )
    await session.execute(
        update(RescheduleOffer)
        .where(
            RescheduleOffer.booking_id == offer.booking_id,
            RescheduleOffer.id != offer.id,
            RescheduleOffer.status == OfferStatus.sent.value,
        )
        .values(status=OfferStatus.expired.value)
    )
    await session.commit()
    return public_offer_out(offer)


@router.post("/public/offers/{token}/decline", response_model=PublicOfferOut)
async def decline_offer(token: str, session: AsyncSession = Depends(get_session)) -> PublicOfferOut:
    offer = await public_offer_by_token(session, token, for_update=True)
    if offer.status == OfferStatus.declined.value:
        return public_offer_out(offer)
    if offer.status != OfferStatus.sent.value:
        raise HTTPException(status_code=409, detail=f"Offer is already {offer.status}")
    if expire_if_needed(offer):
        await session.commit()
        raise HTTPException(status_code=409, detail="Offer has expired")

    offer.status = OfferStatus.declined.value
    communication = MockCommunicationProvider(session)
    await communication.record_customer_reply(
        offer.channel,
        offer.customer,
        "Customer declined the proposed appointment time.",
        offer.business_id,
        offer.id,
    )
    acknowledgement = render_offer_message(
        "decline_ack",
        customer_name=offer.customer.name,
        business_name=offer.business.name,
        service_name=offer.booking.service.name,
        old_start=offer.booking.start_at,
        new_start=offer.suggested_start,
        accept_url="",
    )
    await communication.send_message(
        offer.channel,
        offer.customer,
        acknowledgement,
        offer.business_id,
        offer.id,
    )
    await session.commit()
    return public_offer_out(offer)


@router.get("/messages", response_model=list[MessageOut])
async def messages(
    customerId: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    stmt = select(CommunicationMessage).options(selectinload(CommunicationMessage.customer)).order_by(CommunicationMessage.created_at.desc())
    if customerId:
        stmt = stmt.where(CommunicationMessage.customer_id == customerId)
    rows = (await session.scalars(stmt)).all()
    return [MessageOut.model_validate({**row.__dict__, "customer_name": row.customer.name}) for row in rows]


@router.post("/messages/mock-send", response_model=MessageOut)
async def mock_send(
    offer_id: int,
    channel: str = "whatsapp",
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    offer = await offer_by_id(session, offer_id)
    customer = await session.get(Customer, offer.customer_id)
    message = await MockCommunicationProvider(session).send_message(
        channel,
        customer,
        offer.message_text,
        offer.business_id,
        offer.id,
    )
    await session.commit()
    return MessageOut.model_validate({**message.__dict__, "customer_name": customer.name})
