from datetime import datetime, timezone

from app.core.config import settings
from app.models import Booking, OfferStatus, RescheduleOffer
from app.schemas import BookingOut, CandidateOut, GapOut, OfferOut, PublicOfferOut
from app.services.candidates import CandidateResult


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


def expires_at_utc(offer: RescheduleOffer) -> datetime:
    value = offer.expires_at
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def expire_if_needed(offer: RescheduleOffer) -> bool:
    if offer.status == OfferStatus.sent.value and expires_at_utc(offer) <= datetime.now(timezone.utc):
        offer.status = OfferStatus.expired.value
        return True
    return False
