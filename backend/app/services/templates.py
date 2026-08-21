from datetime import datetime


def fmt_time(value: datetime) -> str:
    return value.strftime("%H:%M")


def fmt_slot(value: datetime) -> str:
    return value.strftime("%a %d %b at %H:%M")


def render_offer_message(
    template_key: str,
    customer_name: str,
    business_name: str,
    service_name: str,
    old_start: datetime,
    new_start: datetime,
    accept_url: str,
    discount_percent: str = "",
    bonus_name: str = "",
    addon_service_name: str = "",
    incentive: str = "",
) -> str:
    values = {
        "{{customerName}}": customer_name,
        "{{businessName}}": business_name,
        "{{serviceName}}": service_name,
        "{{oldTime}}": fmt_time(old_start),
        "{{newTime}}": fmt_time(new_start),
        "{{oldSlot}}": fmt_slot(old_start),
        "{{newSlot}}": fmt_slot(new_start),
        "{{acceptUrl}}": accept_url,
        "{{discountPercent}}": discount_percent,
        "{{bonusName}}": bonus_name,
        "{{addonServiceName}}": addon_service_name,
        "{{incentive}}": incentive,
    }
    text = TEMPLATES[template_key]
    for key, value in values.items():
        text = text.replace(key, value)
    return text


TEMPLATES = {
    "earlier_discount": (
        "Hi {{customerName}}, {{businessName}} has an earlier opening for {{serviceName}} on "
        "{{newSlot}} instead of {{oldSlot}}. If this works for you, we can offer "
        "{{discountPercent}}% off. Confirm here: {{acceptUrl}}. If not, your current time stays unchanged."
    ),
    "earlier_none": (
        "Hi {{customerName}}, an earlier time opened up for {{serviceName}} on {{newSlot}} instead of "
        "{{oldSlot}}. If that is more convenient, you can confirm here: {{acceptUrl}}. Otherwise, "
        "your booking remains at {{oldSlot}}."
    ),
    "earlier_bonus": (
        "Hi {{customerName}}, we can move your {{serviceName}} appointment from {{oldSlot}} to {{newSlot}}. "
        "As a thank-you, we'll add {{bonusName}}. Confirm here: {{acceptUrl}}."
    ),
    "waitlist": (
        "Hi {{customerName}}, an earlier waitlist opening is available for {{serviceName}} on {{newSlot}}. "
        "Confirm here: {{acceptUrl}} or keep your current time at {{oldSlot}}."
    ),
    "auto_dropoff": (
        "Hi {{customerName}}, {{businessName}} can take your car earlier. You can drop it off on "
        "{{newSlot}} instead of {{oldSlot}}. If that works, confirm here: {{acceptUrl}}. Otherwise, "
        "your current time stays unchanged."
    ),
    "small_gap_addon": (
        "Hi {{customerName}}, we have a short opening before your appointment. Would you like to add "
        "{{addonServiceName}} with {{discountPercent}}% off without changing your main booking? "
        "Confirm here: {{acceptUrl}}."
    ),
    "decline_ack": "Thanks, {{customerName}}. Your appointment remains at {{oldSlot}}. See you at {{businessName}}.",
    "voice": (
        "Hello {{customerName}}, this is {{businessName}}. We're calling about your appointment for "
        "{{serviceName}} on {{oldSlot}}. We have an earlier opening on {{newSlot}}. If it is convenient "
        "for you, we can move the appointment and offer {{incentive}}. Would you like to confirm the new time?"
    ),
}
