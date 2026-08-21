from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import Service, SmartSlotPrice
from app.providers.booking import booking_to_window
from app.schemas import SettingsOut, SettingsPatch, SmartPricingIn, SmartPricingOut
from app.services.pricing import quote_smart_price
from app.services.scheduling import get_business_or_404, get_policy, load_bookings, staff_costs

router = APIRouter(prefix="/api")


@router.post("/smart-pricing/quote", response_model=SmartPricingOut)
async def smart_pricing(
    payload: SmartPricingIn,
    session: AsyncSession = Depends(get_session),
) -> SmartPricingOut:
    policy = await get_policy(session, payload.business_id)
    service = await session.get(Service, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    business = await get_business_or_404(session, payload.business_id)
    day_text = payload.requested_start.date().isoformat()
    bookings = [
        booking_to_window(row)
        for row in await load_bookings(session, payload.business_id, day_text, payload.staff_id)
    ]
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
    return SmartPricingOut(
        basePrice=quote.base_price,
        adjustedPrice=quote.adjusted_price,
        discountPercent=quote.discount_percent,
        reason=quote.reason,
        pricingTags=quote.pricing_tags,
    )


@router.get("/settings/{business_id}", response_model=SettingsOut)
async def get_settings(
    business_id: int,
    session: AsyncSession = Depends(get_session),
) -> SettingsOut:
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


@router.patch("/settings/{business_id}", response_model=SettingsOut)
async def patch_settings(
    business_id: int,
    payload: SettingsPatch,
    session: AsyncSession = Depends(get_session),
) -> SettingsOut:
    policy = await get_policy(session, business_id)
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    for key, value in data.items():
        if value is not None:
            setattr(policy, key, value)
    await session.commit()
    return await get_settings(business_id, session)
