import asyncio
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import engine, get_session
from app.models import (
    Base,
    Booking,
    Business,
    CommunicationMessage,
    Customer,
    OfferStatus,
    OptimizationPolicy,
    RescheduleOffer,
    Service,
    SmartSlotPrice,
    StaffMember,
)
from app.providers.booking import MockBookingProviderAdapter, booking_to_window
from app.providers.communication import MockCommunicationProvider
from app.schemas import (
    BookingOut,
    BusinessOut,
    CandidateOut,
    GapOut,
    GenerateOfferIn,
    MessageOut,
    OfferOut,
    PublicOfferOut,
    ScheduleOut,
    ServiceOut,
    SettingsOut,
    SettingsPatch,
    SmartPricingIn,
    SmartPricingOut,
    StaffOut,
)
from app.services.candidates import CandidateResult, generate_candidates
from app.services.demo_seed import seed_demo_data
from app.services.gaps import BookingWindow, detect_schedule_gaps
from app.services.pricing import quote_smart_price
from app.services.templates import render_offer_message


app = FastAPI(title=settings.app_name)
seed_lock = asyncio.Lock()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def day_bounds(day_text: str, tz_name: str = "Europe/Vienna") -> tuple[datetime, datetime]:
    parsed = date.fromisoformat(day_text)
    tz = ZoneInfo(tz_name)
    start = datetime.combine(parsed, time.min, tzinfo=tz)
    end = start + timedelta(days=1)
    return start, end


def date_from_iso(day_text: str) -> date:
    return date.fromisoformat(day_text)


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


async def load_bookings(session: AsyncSession, business_id: int, day: str, staff_id: int | None = None) -> list[Booking]:
    business = await get_business_or_404(session, business_id)
    start, end = day_bounds(day, business.timezone)
    stmt = (
        select(Booking)
        .options(
            selectinload(Booking.staff_member),
            selectinload(Booking.service),
            selectinload(Booking.customer).selectinload(Customer.consent),
        )
        .where(Booking.business_id == business_id, Booking.start_at >= start, Booking.start_at < end)
        .order_by(Booking.start_at)
    )
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
        .where(CommunicationMessage.business_id == business_id, CommunicationMessage.created_at >= since)
        .group_by(CommunicationMessage.customer_id)
    )
    return {customer_id: count for customer_id, count in rows.all()}


async def active_offer_booking_ids(session: AsyncSession, business_id: int) -> set[int]:
    rows = await session.scalars(
        select(RescheduleOffer.booking_id).where(
            RescheduleOffer.business_id == business_id,
            RescheduleOffer.status.in_([OfferStatus.draft.value, OfferStatus.sent.value]),
        )
    )
    return set(rows.all())


def booking_out(booking: Booking) -> BookingOut:
    return BookingOut(
        id=booking.id,
        business_id=booking.business_id,
        staff_member_id=booking.staff_member_id,
        service_id=booking.service_id,
        customer_id=booking.customer_id,
        start_at=booking.start_at,
        end_at=booking.end_at,
        status=booking.status,
        staff_name=booking.staff_member.name,
        service_name=booking.service.name,
        customer_name=booking.customer.name,
        buffer_after_minutes=booking.service.buffer_after_minutes,
    )


def candidate_out(candidate: CandidateResult) -> CandidateOut:
    return CandidateOut(
        booking_id=candidate.booking.booking_id,
        customer_id=candidate.booking.customer_id,
        customer_name=candidate.booking.customer_name,
        service_name=candidate.booking.service_name,
        old_start=candidate.booking.start_at,
        old_end=candidate.booking.end_at,
        suggested_start=candidate.suggested_start,
        suggested_end=candidate.suggested_end,
        incentive_type=candidate.incentive_type,
        incentive_value=candidate.incentive_value,
        estimated_saved_cost=candidate.estimated_saved_cost,
        reason=candidate.reason,
        gap=GapOut(**candidate.gap.__dict__),
    )


async def compute_candidates(session: AsyncSession, business_id: int, day: str, staff_id: int | None = None) -> tuple[list[BookingWindow], list[CandidateResult], list[GapOut]]:
    policy = await get_policy(session, business_id)
    bookings = await load_bookings(session, business_id, day, staff_id)
    windows = [booking_to_window(row) for row in bookings]
    gaps = detect_schedule_gaps(windows, await staff_costs(session, business_id), policy.min_gap_minutes_to_optimize)
    candidates = generate_candidates(
        gaps,
        windows,
        await message_counts(session, business_id),
        policy.max_messages_per_customer_per_14_days,
        policy.default_discount_percent,
        policy.max_discount_percent,
    )
    active_booking_ids = await active_offer_booking_ids(session, business_id)
    candidates = [candidate for candidate in candidates if candidate.booking.booking_id not in active_booking_ids]
    return windows, candidates, [GapOut(**gap.__dict__) for gap in gaps]


def offer_out(offer: RescheduleOffer) -> OfferOut:
    service_name = offer.booking.service.name if offer.booking and offer.booking.service else None
    return OfferOut(
        id=offer.id,
        token=offer.token,
        booking_id=offer.booking_id,
        staff_member_id=offer.booking.staff_member_id,
        customer_id=offer.customer_id,
        business_id=offer.business_id,
        old_start=offer.old_start,
        old_end=offer.old_end,
        suggested_start=offer.suggested_start,
        suggested_end=offer.suggested_end,
        incentive_type=offer.incentive_type,
        incentive_value=offer.incentive_value,
        message_text=offer.message_text,
        status=offer.status,
        channel=offer.channel,
        expires_at=offer.expires_at,
        created_at=offer.created_at,
        customer_name=offer.customer.name if offer.customer else None,
        business_name=offer.business.name if offer.business else None,
        service_name=service_name,
        public_url=f"{settings.frontend_url}/offer/{offer.token}",
    )


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/demo/reset")
async def reset_demo(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    async with seed_lock:
        await seed_demo_data(session)
    return {"status": "reset"}


@app.post("/api/demo/seed")
async def seed_demo(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    async with seed_lock:
        await seed_demo_data(session)
    return {"status": "seeded"}


@app.get("/api/businesses", response_model=list[BusinessOut])
async def businesses(session: AsyncSession = Depends(get_session)) -> list[Business]:
    rows = list((await session.scalars(select(Business).order_by(Business.id.desc()))).all())
    unique: dict[tuple[str, str], Business] = {}
    for row in rows:
        unique.setdefault((row.name, row.type), row)
    return sorted(unique.values(), key=lambda row: row.id)


@app.get("/api/businesses/{business_id}", response_model=BusinessOut)
async def business_detail(business_id: int, session: AsyncSession = Depends(get_session)) -> Business:
    return await get_business_or_404(session, business_id)


@app.get("/api/schedule", response_model=ScheduleOut)
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
    selected_day = date
    daily_savings: dict[str, float] = {}
    for index in range(6, -1, -1):
        day_key = (date_from_iso(selected_day) - timedelta(days=index)).isoformat()
        daily_savings[day_key] = 0
    for offer in offers:
        if offer.status != OfferStatus.accepted.value or not offer.booking or not offer.booking.staff_member:
            continue
        day_key = offer.suggested_start.date().isoformat()
        if day_key not in daily_savings:
            continue
        moved_minutes = max(0, int((offer.old_start - offer.suggested_start).total_seconds() // 60))
        daily_savings[day_key] += round((moved_minutes / 60) * offer.booking.staff_member.hourly_cost, 2)
    metrics = {
        "totalBookingsToday": len(bookings),
        "detectedIdleMinutes": idle_minutes,
        "estimatedSavedCost": round(sum(candidate.estimated_saved_cost for candidate in candidates), 2),
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


@app.get("/api/gaps", response_model=list[GapOut])
async def gaps(businessId: int = Query(...), date: str = Query(...), staffId: int | None = Query(default=None), session: AsyncSession = Depends(get_session)) -> list[GapOut]:
    _, _, gap_rows = await compute_candidates(session, businessId, date, staffId)
    return gap_rows


@app.post("/api/optimization/detect-gaps", response_model=list[GapOut])
async def detect_gaps(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> list[GapOut]:
    _, _, gap_rows = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    return gap_rows


@app.post("/api/optimization/generate-candidates", response_model=list[CandidateOut])
async def candidates(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> list[CandidateOut]:
    _, rows, _ = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    return [candidate_out(row) for row in rows]


@app.post("/api/optimization/generate-offer", response_model=OfferOut)
async def generate_offer(payload: GenerateOfferIn, session: AsyncSession = Depends(get_session)) -> OfferOut:
    business = await get_business_or_404(session, payload.business_id)
    if payload.booking_id and payload.booking_id in await active_offer_booking_ids(session, payload.business_id):
        raise HTTPException(status_code=409, detail="An active offer already exists for this booking")
    _, candidates_rows, _ = await compute_candidates(session, payload.business_id, payload.date, payload.staff_id)
    if payload.booking_id:
        candidates_rows = [row for row in candidates_rows if row.booking.booking_id == payload.booking_id]
    if payload.suggested_start:
        candidates_rows = [row for row in candidates_rows if row.suggested_start == payload.suggested_start]
    if not candidates_rows:
        raise HTTPException(status_code=400, detail="No eligible rescheduling candidate found")
    candidate = candidates_rows[0]
    booking = await session.scalar(
        select(Booking)
        .options(selectinload(Booking.customer), selectinload(Booking.service), selectinload(Booking.staff_member))
        .where(Booking.id == candidate.booking.booking_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    token = uuid4().hex
    accept_url = f"{settings.frontend_url}/offer/{token}"
    if business.type == "auto_service":
        template_key = "auto_dropoff"
    elif candidate.incentive_type == "discount":
        template_key = "earlier_discount"
    elif candidate.incentive_type == "bonus":
        template_key = "earlier_bonus"
    else:
        template_key = "earlier_none"
    incentive = f"{candidate.incentive_value}% discount" if candidate.incentive_type == "discount" else candidate.incentive_value or "no incentive"
    message = render_offer_message(
        template_key,
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
        .options(selectinload(RescheduleOffer.booking).selectinload(Booking.service), selectinload(RescheduleOffer.customer), selectinload(RescheduleOffer.business))
        .where(RescheduleOffer.id == offer.id)
    )
    return offer_out(refreshed)


@app.get("/api/offers", response_model=list[OfferOut])
async def offers(session: AsyncSession = Depends(get_session)) -> list[OfferOut]:
    rows = (
        await session.scalars(
            select(RescheduleOffer)
            .options(selectinload(RescheduleOffer.booking).selectinload(Booking.service), selectinload(RescheduleOffer.customer), selectinload(RescheduleOffer.business))
            .order_by(RescheduleOffer.created_at.desc())
        )
    ).all()
    expired = False
    for row in rows:
        if expire_if_needed(row):
            expired = True
    if expired:
        await session.commit()
    return [offer_out(row) for row in rows]


@app.get("/api/offers/{offer_id}", response_model=OfferOut)
async def offer_detail(offer_id: int, session: AsyncSession = Depends(get_session)) -> OfferOut:
    offer = await session.scalar(
        select(RescheduleOffer)
        .options(selectinload(RescheduleOffer.booking).selectinload(Booking.service), selectinload(RescheduleOffer.customer), selectinload(RescheduleOffer.business))
        .where(RescheduleOffer.id == offer_id)
    )
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if expire_if_needed(offer):
        await session.commit()
    return offer_out(offer)


async def public_offer_by_token(session: AsyncSession, token: str, *, for_update: bool = False) -> RescheduleOffer:
    stmt = (
        select(RescheduleOffer)
        .options(selectinload(RescheduleOffer.booking).selectinload(Booking.service), selectinload(RescheduleOffer.customer), selectinload(RescheduleOffer.business))
        .where(RescheduleOffer.token == token)
    )
    if for_update:
        stmt = stmt.with_for_update()
    offer = await session.scalar(stmt)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


def expires_at_utc(offer: RescheduleOffer) -> datetime:
    value = offer.expires_at
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def expire_if_needed(offer: RescheduleOffer) -> bool:
    if offer.status == OfferStatus.sent.value and expires_at_utc(offer) <= datetime.now(timezone.utc):
        offer.status = OfferStatus.expired.value
        return True
    return False


def public_offer_out(offer: RescheduleOffer) -> PublicOfferOut:
    return PublicOfferOut(
        id=offer.id,
        token=offer.token,
        business_name=offer.business.name,
        service_name=offer.booking.service.name,
        customer_name=offer.customer.name,
        current_start=offer.old_start,
        current_end=offer.old_end,
        suggested_start=offer.suggested_start,
        suggested_end=offer.suggested_end,
        incentive_type=offer.incentive_type,
        incentive_value=offer.incentive_value,
        status=offer.status,
        message_text=offer.message_text,
    )


@app.get("/api/public/offers/{token}", response_model=PublicOfferOut)
async def public_offer(token: str, session: AsyncSession = Depends(get_session)) -> PublicOfferOut:
    offer = await public_offer_by_token(session, token)
    if expire_if_needed(offer):
        await session.commit()
    return public_offer_out(offer)


@app.post("/api/public/offers/{token}/accept", response_model=PublicOfferOut)
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
    available = await provider.check_availability(offer.booking.staff_member_id, offer.suggested_start, offer.suggested_end, offer.booking_id)
    if not available:
        offer.status = OfferStatus.expired.value
        await session.commit()
        raise HTTPException(status_code=409, detail="Suggested slot is no longer available")
    await provider.update_booking_time(offer.booking_id, offer.suggested_start, offer.suggested_end)
    offer.status = OfferStatus.accepted.value
    await session.execute(
        update(RescheduleOffer)
        .where(RescheduleOffer.booking_id == offer.booking_id, RescheduleOffer.id != offer.id, RescheduleOffer.status == OfferStatus.sent.value)
        .values(status=OfferStatus.expired.value)
    )
    await session.commit()
    return public_offer_out(offer)


@app.post("/api/public/offers/{token}/decline", response_model=PublicOfferOut)
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
    ack = render_offer_message(
        "decline_ack",
        customer_name=offer.customer.name,
        business_name=offer.business.name,
        service_name=offer.booking.service.name,
        old_start=offer.booking.start_at,
        new_start=offer.suggested_start,
        accept_url="",
    )
    await MockCommunicationProvider(session).send_message(offer.channel, offer.customer, ack, offer.business_id, offer.id)
    await session.commit()
    return public_offer_out(offer)


@app.get("/api/messages", response_model=list[MessageOut])
async def messages(customerId: int | None = Query(default=None), session: AsyncSession = Depends(get_session)) -> list[MessageOut]:
    stmt = select(CommunicationMessage).options(selectinload(CommunicationMessage.customer)).order_by(CommunicationMessage.created_at.desc())
    if customerId:
        stmt = stmt.where(CommunicationMessage.customer_id == customerId)
    rows = (await session.scalars(stmt)).all()
    return [MessageOut.model_validate({**row.__dict__, "customer_name": row.customer.name}) for row in rows]


@app.post("/api/messages/mock-send", response_model=MessageOut)
async def mock_send(offer_id: int, channel: str = "whatsapp", session: AsyncSession = Depends(get_session)) -> MessageOut:
    offer = await public_offer_by_token(session, str(offer_id)) if False else await offer_detail(offer_id, session)
    row_offer = await session.get(RescheduleOffer, offer.id)
    customer = await session.get(Customer, row_offer.customer_id)
    message = await MockCommunicationProvider(session).send_message(channel, customer, row_offer.message_text, row_offer.business_id, row_offer.id)
    await session.commit()
    return MessageOut.model_validate({**message.__dict__, "customer_name": customer.name})


@app.post("/api/smart-pricing/quote", response_model=SmartPricingOut)
async def smart_pricing(payload: SmartPricingIn, session: AsyncSession = Depends(get_session)) -> SmartPricingOut:
    policy = await get_policy(session, payload.business_id)
    service = await session.get(Service, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    business = await get_business_or_404(session, payload.business_id)
    day_text = payload.requested_start.date().isoformat()
    bookings = [booking_to_window(row) for row in await load_bookings(session, payload.business_id, day_text, payload.staff_id)]
    quote = quote_smart_price(
        service.base_price,
        payload.requested_start,
        policy.max_discount_percent,
        policy.default_discount_percent,
        bookings,
        await staff_costs(session, payload.business_id),
        policy.min_gap_minutes_to_optimize,
        payload.staff_id,
    )
    session.add(
        SmartSlotPrice(
            business_id=business.id,
            service_id=service.id,
            staff_member_id=payload.staff_id,
            requested_start=payload.requested_start,
            base_price=quote.base_price,
            adjusted_price=quote.adjusted_price,
            discount_percent=quote.discount_percent,
            reason=quote.reason,
            pricing_tags=",".join(quote.pricing_tags),
        )
    )
    await session.commit()
    return SmartPricingOut(basePrice=quote.base_price, adjustedPrice=quote.adjusted_price, discountPercent=quote.discount_percent, reason=quote.reason, pricingTags=quote.pricing_tags)


@app.get("/api/settings/{business_id}", response_model=SettingsOut)
async def get_settings(business_id: int, session: AsyncSession = Depends(get_session)) -> SettingsOut:
    policy = await get_policy(session, business_id)
    return SettingsOut(
        businessId=policy.business_id,
        minGapMinutesToOptimize=policy.min_gap_minutes_to_optimize,
        defaultDiscountPercent=policy.default_discount_percent,
        maxDiscountPercent=policy.max_discount_percent,
        maxMessagesPerCustomerPer14Days=policy.max_messages_per_customer_per_14_days,
        enabledChannels=policy.enabled_channels,
        timezone=policy.timezone,
        currency=policy.currency,
    )


@app.patch("/api/settings/{business_id}", response_model=SettingsOut)
async def patch_settings(business_id: int, payload: SettingsPatch, session: AsyncSession = Depends(get_session)) -> SettingsOut:
    policy = await get_policy(session, business_id)
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    for key, value in data.items():
        if value is not None:
            setattr(policy, key, value)
    await session.commit()
    return await get_settings(business_id, session)
