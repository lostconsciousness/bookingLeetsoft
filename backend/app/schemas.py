from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BusinessOut(BaseModel):
    id: int
    name: str
    type: str
    timezone: str
    currency: str

    model_config = ConfigDict(from_attributes=True)


class StaffOut(BaseModel):
    id: int
    name: str
    role: str
    hourly_cost: float

    model_config = ConfigDict(from_attributes=True)


class ServiceOut(BaseModel):
    id: int
    name: str
    duration_minutes: int
    base_price: float
    buffer_after_minutes: int

    model_config = ConfigDict(from_attributes=True)


class CustomerOut(BaseModel):
    id: int
    name: str
    prefers_earlier_slots: bool
    flexible_dropoff: bool
    service_messages: bool
    marketing_messages: bool


class BookingOut(BaseModel):
    id: int
    business_id: int
    staff_member_id: int
    service_id: int
    customer_id: int
    start_at: datetime
    end_at: datetime
    status: str
    staff_name: str
    service_name: str
    customer_name: str
    buffer_after_minutes: int


class GapOut(BaseModel):
    business_id: int
    staff_id: int
    start_at: datetime
    end_at: datetime
    idle_minutes: int
    estimated_idle_cost: float
    previous_booking_id: int
    next_booking_id: int


class CandidateOut(BaseModel):
    booking_id: int
    customer_name: str
    service_name: str
    old_start: datetime
    old_end: datetime
    suggested_start: datetime
    suggested_end: datetime
    incentive_type: str
    incentive_value: str
    estimated_saved_cost: float
    reason: str
    gap: GapOut


class GenerateOfferIn(BaseModel):
    business_id: int = Field(alias="businessId")
    date: str
    staff_id: int | None = Field(default=None, alias="staffId")
    booking_id: int | None = Field(default=None, alias="bookingId")
    channel: str = "whatsapp"


class OfferOut(BaseModel):
    id: int
    token: str
    booking_id: int
    customer_id: int
    business_id: int
    old_start: datetime
    old_end: datetime
    suggested_start: datetime
    suggested_end: datetime
    incentive_type: str
    incentive_value: str
    message_text: str
    status: str
    channel: str
    expires_at: datetime
    created_at: datetime
    customer_name: str | None = None
    business_name: str | None = None
    service_name: str | None = None
    public_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicOfferOut(BaseModel):
    id: int
    token: str
    business_name: str
    service_name: str
    customer_name: str
    current_start: datetime
    current_end: datetime
    suggested_start: datetime
    suggested_end: datetime
    incentive_type: str
    incentive_value: str
    status: str
    message_text: str


class MessageOut(BaseModel):
    id: int
    business_id: int
    customer_id: int
    offer_id: int | None
    channel: str
    direction: str
    body: str
    delivery_status: str
    created_at: datetime
    customer_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SmartPricingIn(BaseModel):
    business_id: int = Field(alias="businessId")
    service_id: int = Field(alias="serviceId")
    staff_id: int | None = Field(default=None, alias="staffId")
    requested_start: datetime = Field(alias="requestedStart")


class SmartPricingOut(BaseModel):
    base_price: float = Field(alias="basePrice")
    adjusted_price: float = Field(alias="adjustedPrice")
    discount_percent: int = Field(alias="discountPercent")
    reason: str
    pricing_tags: list[str] = Field(alias="pricingTags")


class SettingsPatch(BaseModel):
    min_gap_minutes_to_optimize: int | None = Field(default=None, alias="minGapMinutesToOptimize")
    default_discount_percent: int | None = Field(default=None, alias="defaultDiscountPercent")
    max_discount_percent: int | None = Field(default=None, alias="maxDiscountPercent")
    max_messages_per_customer_per_14_days: int | None = Field(default=None, alias="maxMessagesPerCustomerPer14Days")
    enabled_channels: str | None = Field(default=None, alias="enabledChannels")
    timezone: str | None = None
    currency: str | None = None


class SettingsOut(BaseModel):
    business_id: int = Field(alias="businessId")
    min_gap_minutes_to_optimize: int = Field(alias="minGapMinutesToOptimize")
    default_discount_percent: int = Field(alias="defaultDiscountPercent")
    max_discount_percent: int = Field(alias="maxDiscountPercent")
    max_messages_per_customer_per_14_days: int = Field(alias="maxMessagesPerCustomerPer14Days")
    enabled_channels: str = Field(alias="enabledChannels")
    timezone: str
    currency: str


class ScheduleOut(BaseModel):
    business: BusinessOut
    staff: list[StaffOut]
    services: list[ServiceOut]
    customers: list[CustomerOut]
    bookings: list[BookingOut]
    gaps: list[GapOut]
    candidates: list[CandidateOut]
    metrics: dict[str, Any]

