from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import accept_offer, decline_offer, generate_offer
from app.models import Base, Booking, Business, CommunicationMessage, Customer, CustomerConsent, OptimizationPolicy, RescheduleOffer, Service, StaffMember
from app.schemas import GenerateOfferIn


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as value:
        yield value
    await engine.dispose()


async def create_offer(session: AsyncSession, *, expires_at: datetime | None = None) -> tuple[RescheduleOffer, Booking]:
    business = Business(name="Demo Salon", type="hair_salon", timezone="Europe/Vienna", currency="EUR")
    session.add(business)
    await session.flush()
    staff = StaffMember(business_id=business.id, name="Anna", role="Stylist", hourly_cost=24)
    service = Service(business_id=business.id, name="Haircut", duration_minutes=60, base_price=45, buffer_after_minutes=10)
    customer = Customer(business_id=business.id, name="Maria", phone="", email="")
    session.add_all([staff, service, customer])
    await session.flush()
    session.add(CustomerConsent(customer_id=customer.id, service_messages=True, marketing_messages=True))
    # SQLite does not preserve timezone offsets; use naive booking times in this isolated DB fixture.
    old_start = datetime(2026, 7, 15, 15)
    booking = Booking(
        business_id=business.id,
        staff_member_id=staff.id,
        service_id=service.id,
        customer_id=customer.id,
        start_at=old_start,
        end_at=old_start + timedelta(hours=1),
    )
    session.add(booking)
    await session.flush()
    offer = RescheduleOffer(
        token="offer-token",
        booking_id=booking.id,
        customer_id=customer.id,
        business_id=business.id,
        old_start=booking.start_at,
        old_end=booking.end_at,
        suggested_start=old_start - timedelta(hours=2),
        suggested_end=old_start - timedelta(hours=1),
        incentive_type="discount",
        incentive_value="10",
        message_text="Move earlier?",
        status="sent",
        channel="whatsapp",
        expires_at=expires_at or datetime.now(timezone.utc) + timedelta(hours=1),
    )
    session.add(offer)
    await session.commit()
    return offer, booking


@pytest.mark.asyncio
async def test_accept_is_idempotent_and_keeps_original_time_in_public_response(session: AsyncSession) -> None:
    offer, booking = await create_offer(session)

    first = await accept_offer(offer.token, session)
    second = await accept_offer(offer.token, session)

    assert first.status == "accepted"
    assert second.status == "accepted"
    assert first.current_start == offer.old_start
    assert booking.start_at == offer.suggested_start


@pytest.mark.asyncio
async def test_decline_is_idempotent_and_never_moves_booking(session: AsyncSession) -> None:
    offer, booking = await create_offer(session)
    original_start = booking.start_at

    first = await decline_offer(offer.token, session)
    second = await decline_offer(offer.token, session)

    assert first.status == "declined"
    assert second.status == "declined"
    assert booking.start_at == original_start
    message_count = await session.scalar(select(func.count()).select_from(CommunicationMessage))
    assert message_count == 1


@pytest.mark.asyncio
async def test_opposite_response_after_final_state_is_rejected(session: AsyncSession) -> None:
    offer, _ = await create_offer(session)
    await accept_offer(offer.token, session)

    with pytest.raises(HTTPException) as raised:
        await decline_offer(offer.token, session)

    assert raised.value.status_code == 409


@pytest.mark.asyncio
async def test_expired_offer_cannot_be_declined(session: AsyncSession) -> None:
    offer, _ = await create_offer(session, expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))

    with pytest.raises(HTTPException) as raised:
        await decline_offer(offer.token, session)

    assert raised.value.status_code == 409
    assert offer.status == "expired"


@pytest.mark.asyncio
async def test_busy_suggested_slot_expires_offer_without_moving_booking(session: AsyncSession) -> None:
    offer, booking = await create_offer(session)
    original_start = booking.start_at
    session.add(
        Booking(
            business_id=booking.business_id,
            staff_member_id=booking.staff_member_id,
            service_id=booking.service_id,
            customer_id=booking.customer_id,
            start_at=offer.suggested_start,
            end_at=offer.suggested_end,
        )
    )
    await session.commit()

    with pytest.raises(HTTPException) as raised:
        await accept_offer(offer.token, session)

    assert raised.value.status_code == 409
    assert offer.status == "expired"
    assert booking.start_at == original_start


@pytest.mark.asyncio
async def test_generate_offer_uses_exact_selected_customer_and_time(session: AsyncSession) -> None:
    business = Business(name="Demo Salon", type="hair_salon", timezone="Europe/Vienna", currency="EUR")
    session.add(business)
    await session.flush()
    staff = StaffMember(business_id=business.id, name="Anna", role="Stylist", hourly_cost=24)
    service = Service(business_id=business.id, name="Haircut", duration_minutes=60, base_price=45, buffer_after_minutes=10)
    policy = OptimizationPolicy(business_id=business.id, min_gap_minutes_to_optimize=30, default_discount_percent=10, max_discount_percent=20, max_messages_per_customer_per_14_days=3)
    session.add_all([staff, service, policy])
    await session.flush()
    customers = [Customer(business_id=business.id, name=name, phone="", email="") for name in ["First", "Second", "Third"]]
    session.add_all(customers)
    await session.flush()
    session.add_all([CustomerConsent(customer_id=customer.id, service_messages=True, marketing_messages=True) for customer in customers])
    starts = [datetime(2026, 7, 15, hour) for hour in [12, 15, 17]]
    bookings = [
        Booking(
            business_id=business.id,
            staff_member_id=staff.id,
            service_id=service.id,
            customer_id=customer.id,
            start_at=start,
            end_at=start + timedelta(hours=1),
        )
        for customer, start in zip(customers, starts)
    ]
    session.add_all(bookings)
    await session.commit()

    result = await generate_offer(
        GenerateOfferIn(
            businessId=business.id,
            date="2026-07-15",
            staffId=staff.id,
            bookingId=bookings[2].id,
            suggestedStart=datetime(2026, 7, 15, 13, 10),
            channel="sms",
        ),
        session,
    )

    assert result.booking_id == bookings[2].id
    assert result.customer_id == customers[2].id
    assert result.suggested_start == datetime(2026, 7, 15, 13, 10)
    assert result.channel == "sms"
