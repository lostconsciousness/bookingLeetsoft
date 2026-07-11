from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class BusinessType(str, Enum):
    hair_salon = "hair_salon"
    auto_service = "auto_service"


class OfferStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    accepted = "accepted"
    declined = "declined"
    expired = "expired"


class IncentiveType(str, Enum):
    discount = "discount"
    bonus = "bonus"
    none = "none"


class CommunicationChannel(str, Enum):
    whatsapp = "whatsapp"
    sms = "sms"
    email = "email"
    telegram = "telegram"
    voice = "voice"


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(40))
    timezone: Mapped[str] = mapped_column(String(80), default="Europe/Vienna")
    currency: Mapped[str] = mapped_column(String(8), default="EUR")

    locations: Mapped[list["Location"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    staff_members: Mapped[list["StaffMember"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    services: Mapped[list["Service"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    policy: Mapped["OptimizationPolicy"] = relationship(back_populates="business", cascade="all, delete-orphan")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(String(240), default="")

    business: Mapped[Business] = relationship(back_populates="locations")


class StaffMember(Base):
    __tablename__ = "staff_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120))
    hourly_cost: Mapped[float] = mapped_column(Float)

    business: Mapped[Business] = relationship(back_populates="staff_members")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="staff_member")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(160))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    base_price: Mapped[float] = mapped_column(Float)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, default=0)

    business: Mapped[Business] = relationship(back_populates="services")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(80), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    prefers_earlier_slots: Mapped[bool] = mapped_column(Boolean, default=False)
    flexible_dropoff: Mapped[bool] = mapped_column(Boolean, default=False)

    consent: Mapped["CustomerConsent"] = relationship(back_populates="customer", cascade="all, delete-orphan")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="customer")


class CustomerConsent(Base):
    __tablename__ = "customer_consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), unique=True)
    service_messages: Mapped[bool] = mapped_column(Boolean, default=True)
    marketing_messages: Mapped[bool] = mapped_column(Boolean, default=False)

    customer: Mapped[Customer] = relationship(back_populates="consent")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    staff_member_id: Mapped[int] = mapped_column(ForeignKey("staff_members.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), default="booked")

    staff_member: Mapped[StaffMember] = relationship(back_populates="bookings")
    service: Mapped[Service] = relationship()
    customer: Mapped[Customer] = relationship(back_populates="bookings")


class WorkingHours(Base):
    __tablename__ = "working_hours"
    __table_args__ = (UniqueConstraint("staff_member_id", "weekday", name="uq_working_hours_staff_weekday"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    staff_member_id: Mapped[int] = mapped_column(ForeignKey("staff_members.id"))
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[str] = mapped_column(String(5), default="09:00")
    end_time: Mapped[str] = mapped_column(String(5), default="17:00")


class ScheduleGap(Base):
    __tablename__ = "schedule_gaps"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    staff_member_id: Mapped[int] = mapped_column(ForeignKey("staff_members.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_minutes: Mapped[int] = mapped_column(Integer)
    estimated_idle_cost: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RescheduleOffer(Base):
    __tablename__ = "reschedule_offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    old_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    old_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    suggested_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    suggested_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    incentive_type: Mapped[str] = mapped_column(String(40), default=IncentiveType.none.value)
    incentive_value: Mapped[str] = mapped_column(String(120), default="")
    message_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default=OfferStatus.draft.value)
    channel: Mapped[str] = mapped_column(String(40), default=CommunicationChannel.whatsapp.value)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    booking: Mapped[Booking] = relationship()
    customer: Mapped[Customer] = relationship()
    business: Mapped[Business] = relationship()


class CommunicationMessage(Base):
    __tablename__ = "communication_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("reschedule_offers.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(40))
    direction: Mapped[str] = mapped_column(String(20), default="outbound")
    body: Mapped[str] = mapped_column(Text)
    delivery_status: Mapped[str] = mapped_column(String(40), default="mock_delivered")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer: Mapped[Customer] = relationship()
    offer: Mapped[RescheduleOffer] = relationship()


class OptimizationPolicy(Base):
    __tablename__ = "optimization_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), unique=True)
    min_gap_minutes_to_optimize: Mapped[int] = mapped_column(Integer, default=30)
    default_discount_percent: Mapped[int] = mapped_column(Integer, default=10)
    max_discount_percent: Mapped[int] = mapped_column(Integer, default=20)
    max_messages_per_customer_per_14_days: Mapped[int] = mapped_column(Integer, default=3)
    enabled_channels: Mapped[str] = mapped_column(String(240), default="whatsapp,sms,email,telegram,voice")
    timezone: Mapped[str] = mapped_column(String(80), default="Europe/Vienna")
    currency: Mapped[str] = mapped_column(String(8), default="EUR")

    business: Mapped[Business] = relationship(back_populates="policy")


class SmartSlotPrice(Base):
    __tablename__ = "smart_slot_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    staff_member_id: Mapped[int | None] = mapped_column(ForeignKey("staff_members.id"), nullable=True)
    requested_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    base_price: Mapped[float] = mapped_column(Float)
    adjusted_price: Mapped[float] = mapped_column(Float)
    discount_percent: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    pricing_tags: Mapped[str] = mapped_column(String(240), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

