from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Booking,
    Business,
    CommunicationMessage,
    Customer,
    CustomerConsent,
    Location,
    OptimizationPolicy,
    RescheduleOffer,
    ScheduleGap,
    Service,
    SmartSlotPrice,
    StaffMember,
    WorkingHours,
)


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=ZoneInfo("Europe/Vienna"))


async def reset_demo_data(session: AsyncSession) -> None:
    for model in [
        CommunicationMessage,
        RescheduleOffer,
        SmartSlotPrice,
        ScheduleGap,
        Booking,
        WorkingHours,
        CustomerConsent,
        Customer,
        Service,
        StaffMember,
        Location,
        OptimizationPolicy,
        Business,
    ]:
        await session.execute(delete(model))
    await session.commit()


async def seed_demo_data(session: AsyncSession) -> None:
    await reset_demo_data(session)
    today = datetime.now(ZoneInfo("Europe/Vienna")).date()

    salon = Business(name="Urban Cut Studio", type="hair_salon", timezone="Europe/Vienna", currency="EUR")
    auto = Business(name="FastFix Auto", type="auto_service", timezone="Europe/Vienna", currency="EUR")
    session.add_all([salon, auto])
    await session.flush()

    session.add_all(
        [
            Location(business_id=salon.id, name="Urban Cut Studio Main", address="Demo Street 12"),
            Location(business_id=auto.id, name="FastFix Auto Garage", address="Workshop Lane 4"),
            OptimizationPolicy(
                business_id=salon.id,
                min_gap_minutes_to_optimize=30,
                default_discount_percent=10,
                max_discount_percent=20,
                max_messages_per_customer_per_14_days=3,
                timezone=salon.timezone,
                currency=salon.currency,
            ),
            OptimizationPolicy(
                business_id=auto.id,
                min_gap_minutes_to_optimize=30,
                default_discount_percent=8,
                max_discount_percent=15,
                max_messages_per_customer_per_14_days=3,
                timezone=auto.timezone,
                currency=auto.currency,
            ),
        ]
    )

    anna = StaffMember(business_id=salon.id, name="Anna", role="Senior hair stylist", hourly_cost=24)
    max_barber = StaffMember(business_id=salon.id, name="Max", role="Barber", hourly_cost=22)
    markus = StaffMember(business_id=auto.id, name="Markus", role="Mechanic", hourly_cost=32)
    session.add_all([anna, max_barber, markus])
    await session.flush()

    haircut = Service(business_id=salon.id, name="Haircut", duration_minutes=60, base_price=45, buffer_after_minutes=10)
    coloring = Service(business_id=salon.id, name="Coloring", duration_minutes=120, base_price=120, buffer_after_minutes=15)
    beard = Service(business_id=salon.id, name="Beard trim", duration_minutes=30, base_price=25, buffer_after_minutes=5)
    oil = Service(business_id=auto.id, name="Oil change", duration_minutes=45, base_price=85, buffer_after_minutes=0)
    diagnostics = Service(business_id=auto.id, name="Diagnostics", duration_minutes=60, base_price=95, buffer_after_minutes=0)
    brakes = Service(business_id=auto.id, name="Brake inspection", duration_minutes=90, base_price=140, buffer_after_minutes=0)
    session.add_all([haircut, coloring, beard, oil, diagnostics, brakes])
    await session.flush()

    maria = Customer(business_id=salon.id, name="Maria", phone="+431000001", email="maria@example.com", prefers_earlier_slots=True)
    lukas = Customer(business_id=salon.id, name="Lukas", phone="+431000002", email="lukas@example.com")
    sofia = Customer(business_id=salon.id, name="Sofia", phone="+431000003", email="sofia@example.com")
    emma = Customer(business_id=salon.id, name="Emma", phone="+431000004", email="emma@example.com")
    peter = Customer(business_id=auto.id, name="Peter", phone="+431000005", email="peter@example.com", flexible_dropoff=True)
    daniel = Customer(business_id=auto.id, name="Daniel", phone="+431000006", email="daniel@example.com")
    session.add_all([maria, lukas, sofia, emma, peter, daniel])
    await session.flush()

    session.add_all(
        [
            CustomerConsent(customer_id=maria.id, service_messages=True, marketing_messages=True),
            CustomerConsent(customer_id=lukas.id, service_messages=True, marketing_messages=False),
            CustomerConsent(customer_id=sofia.id, service_messages=True, marketing_messages=True),
            CustomerConsent(customer_id=emma.id, service_messages=True, marketing_messages=False),
            CustomerConsent(customer_id=peter.id, service_messages=True, marketing_messages=True),
            CustomerConsent(customer_id=daniel.id, service_messages=True, marketing_messages=False),
        ]
    )

    for staff in [anna, max_barber, markus]:
        for weekday in range(7):
            session.add(WorkingHours(business_id=staff.business_id, staff_member_id=staff.id, weekday=weekday, start_time="08:00", end_time="18:00"))

    current_bookings = [
            Booking(business_id=salon.id, staff_member_id=anna.id, service_id=haircut.id, customer_id=lukas.id, start_at=at(today, 12), end_at=at(today, 13)),
            Booking(business_id=salon.id, staff_member_id=anna.id, service_id=haircut.id, customer_id=maria.id, start_at=at(today, 15), end_at=at(today, 16)),
            Booking(business_id=salon.id, staff_member_id=max_barber.id, service_id=haircut.id, customer_id=sofia.id, start_at=at(today, 10), end_at=at(today, 11)),
            Booking(business_id=salon.id, staff_member_id=max_barber.id, service_id=haircut.id, customer_id=emma.id, start_at=at(today, 14), end_at=at(today, 15)),
            Booking(business_id=auto.id, staff_member_id=markus.id, service_id=diagnostics.id, customer_id=daniel.id, start_at=at(today, 8, 30), end_at=at(today, 9, 30)),
            Booking(business_id=auto.id, staff_member_id=markus.id, service_id=oil.id, customer_id=peter.id, start_at=at(today, 13), end_at=at(today, 13, 45)),
            Booking(business_id=auto.id, staff_member_id=markus.id, service_id=brakes.id, customer_id=daniel.id, start_at=at(today, 15, 30), end_at=at(today, 17)),
    ]
    session.add_all(current_bookings)
    await session.flush()

    # A small, deterministic history makes the value story visible immediately
    # without affecting today's optimization candidates.
    historical_bookings = []
    for days_ago, customer, start_hour in [(2, maria, 13), (4, lukas, 14), (6, sofia, 15)]:
        day = today - timedelta(days=days_ago)
        historical_bookings.append(
            Booking(business_id=salon.id, staff_member_id=anna.id, service_id=haircut.id, customer_id=customer.id, start_at=at(day, start_hour - 1), end_at=at(day, start_hour))
        )
    session.add_all(historical_bookings)
    await session.flush()
    for index, booking in enumerate(historical_bookings):
        session.add(
            RescheduleOffer(
                token=f"demo-history-{index}", booking_id=booking.id, customer_id=booking.customer_id, business_id=salon.id,
                old_start=booking.start_at + timedelta(hours=1), old_end=booking.end_at + timedelta(hours=1),
                suggested_start=booking.start_at, suggested_end=booking.end_at,
                incentive_type="discount", incentive_value="10", message_text="Demo history: earlier appointment accepted.",
                status="accepted" if index < 2 else "declined", channel="whatsapp",
                expires_at=booking.start_at + timedelta(hours=8), created_at=booking.start_at - timedelta(days=1),
            )
        )
    await session.commit()
