from abc import ABC, abstractmethod
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Booking, Customer
from app.services.gaps import BookingWindow, has_availability


class BookingProviderAdapter(ABC):
    @abstractmethod
    async def list_bookings(self, business_id: int, day_start: datetime, day_end: datetime, staff_id: int | None = None) -> list[BookingWindow]:
        raise NotImplementedError

    @abstractmethod
    async def check_availability(self, staff_id: int, start_at: datetime, end_at: datetime, exclude_booking_id: int | None = None) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def update_booking_time(self, booking_id: int, start_at: datetime, end_at: datetime) -> Booking:
        raise NotImplementedError


class MockBookingProviderAdapter(BookingProviderAdapter):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_bookings(self, business_id: int, day_start: datetime, day_end: datetime, staff_id: int | None = None) -> list[BookingWindow]:
        stmt = (
            select(Booking)
            .options(
                selectinload(Booking.service),
                selectinload(Booking.customer).selectinload(Customer.consent),
            )
            .where(Booking.business_id == business_id, Booking.start_at >= day_start, Booking.start_at < day_end)
            .order_by(Booking.start_at)
        )
        if staff_id:
            stmt = stmt.where(Booking.staff_member_id == staff_id)
        rows = (await self.session.scalars(stmt)).all()
        return [booking_to_window(row) for row in rows]

    async def check_availability(self, staff_id: int, start_at: datetime, end_at: datetime, exclude_booking_id: int | None = None) -> bool:
        stmt = (
            select(Booking)
            .options(selectinload(Booking.service), selectinload(Booking.customer).selectinload(Customer.consent))
            .where(Booking.staff_member_id == staff_id, Booking.start_at < end_at, Booking.end_at > start_at)
        )
        rows = (await self.session.scalars(stmt)).all()
        windows = [booking_to_window(row) for row in rows]
        return has_availability(windows, staff_id, start_at, end_at, exclude_booking_id)

    async def update_booking_time(self, booking_id: int, start_at: datetime, end_at: datetime) -> Booking:
        booking = await self.session.get(Booking, booking_id)
        if booking is None:
            raise ValueError("Booking not found")
        booking.start_at = start_at
        booking.end_at = end_at
        await self.session.flush()
        return booking


def booking_to_window(booking: Booking) -> BookingWindow:
    return BookingWindow(
        booking_id=booking.id,
        business_id=booking.business_id,
        staff_id=booking.staff_member_id,
        service_id=booking.service_id,
        customer_id=booking.customer_id,
        customer_name=booking.customer.name,
        service_name=booking.service.name,
        start_at=booking.start_at,
        end_at=booking.end_at,
        buffer_after_minutes=booking.service.buffer_after_minutes,
        service_messages=booking.customer.consent.service_messages,
        marketing_messages=booking.customer.consent.marketing_messages,
        base_price=booking.service.base_price,
    )


class SquareBookingProviderAdapter(BookingProviderAdapter):
    # TODO: Add OAuth, location mapping, availability, and booking update calls to Square later.
    pass


class AcuityBookingProviderAdapter(BookingProviderAdapter):
    # TODO: Add Acuity API client, webhook sync, and appointment update support later.
    pass


class CalendlyBookingProviderAdapter(BookingProviderAdapter):
    # TODO: Add Calendly event type mapping, invitee sync, and reschedule links later.
    pass


class SimplyBookProviderAdapter(BookingProviderAdapter):
    # TODO: Add SimplyBook API credentials, provider sync, and booking mutation support later.
    pass


class PhorestBookingProviderAdapter(BookingProviderAdapter):
    # TODO: Add Phorest salon, staff, client, and appointment API integration later.
    pass


class ShopmonkeyBookingProviderAdapter(BookingProviderAdapter):
    # TODO: Add Shopmonkey repair order scheduling and customer notification hooks later.
    pass

