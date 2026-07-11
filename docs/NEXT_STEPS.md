# Next Steps

## Real Booking Provider Integrations

- Implement Square, Acuity, Calendly, SimplyBook, Phorest, and Shopmonkey adapters.
- Add provider-specific appointment, staff, service, and location mapping.
- Add sync jobs for historical bookings and future appointments.
- Add provider webhooks for real-time schedule changes.

## Real Communication Providers

- Add WhatsApp Business, SMS, and email providers behind the existing communication interface.
- Keep mock sending available for demos and testing.
- Add delivery status callbacks and retry handling.
- Add opt-out handling and frequency caps per channel.

## Telegram Bot Option

- Add a Telegram bot integration for businesses whose customers already use Telegram.
- Support deep links to public offer tokens.
- Record replies and delivery status in `CommunicationMessage`.

## Voice Call Integration

- Add a voice provider for scripted calls.
- Generate channel-specific call scripts from the existing templates.
- Store call outcome, transcript summary, and customer reply.

## Consent And GDPR/ePrivacy Review

- Review service-message and marketing-message consent boundaries.
- Add audit history for consent changes.
- Add retention rules for messages and offer decisions.
- Add export/delete workflows for customer data.

## OAuth And Token Storage

- Add encrypted credential storage.
- Implement OAuth refresh token rotation.
- Restrict provider credentials by business and location.

## Webhooks

- Add webhook receivers for booking changes and message delivery callbacks.
- Verify signatures for all providers.
- Queue webhook work so provider outages do not affect dashboard use.

## Audit Logs

- Track who generated offers, changed settings, and accepted or declined public offers.
- Keep immutable event history for booking updates.

## Production Deployment

- Add a production Docker image for the frontend.
- Run migrations in release jobs.
- Add structured logging, metrics, backups, and health checks.
- Add authentication, tenant isolation, rate limiting, and CI/CD.

