# Schedule Optimizer Demo

First demo version of a SaaS product that helps appointment-based service businesses reduce idle gaps in staff schedules.

The MVP detects gaps between bookings, suggests a booking that can move earlier, generates a mock rescheduling offer, shows the message in a customer inbox simulator, and lets the customer accept or decline through a public offer page. No real third-party messages are sent.

## Demo Flow

1. Seed the demo data.
2. Open the Dashboard to see today’s utilization and idle time.
3. Go to Optimizer and select Urban Cut Studio or FastFix Auto.
4. Review highlighted idle gaps and the suggested customer move.
5. Generate a mock offer.
6. Open Customer Inbox to preview WhatsApp, SMS, Email, Telegram, or voice-call text.
7. Open the public offer link.
8. Accept or decline the change.
9. Return to the dashboard and optimizer to see updated metrics.
10. Try Smart Booking to quote gap-filling or low-demand slots.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, lucide-react
- Backend: Python, FastAPI, SQLAlchemy 2.0 async ORM, asyncpg, Pydantic
- Database: PostgreSQL through Docker Compose
- Migrations: Alembic
- Tests: Pytest

## Run With Docker Compose

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/api/health

Seed or reset the demo data:

```bash
curl -X POST http://localhost:8000/api/demo/seed
```

or:

```bash
make seed
```

## Useful Commands

```bash
make up
make down
make test
make frontend-build
```

## API Overview

- `GET /api/health`
- `POST /api/demo/reset`
- `POST /api/demo/seed`
- `GET /api/businesses`
- `GET /api/businesses/{business_id}`
- `GET /api/schedule?businessId=&date=&staffId=`
- `GET /api/gaps?businessId=&date=&staffId=`
- `POST /api/optimization/detect-gaps`
- `POST /api/optimization/generate-candidates`
- `POST /api/optimization/generate-offer`
- `GET /api/offers`
- `GET /api/offers/{offer_id}`
- `GET /api/public/offers/{token}`
- `POST /api/public/offers/{token}/accept`
- `POST /api/public/offers/{token}/decline`
- `GET /api/messages`
- `POST /api/messages/mock-send`
- `POST /api/smart-pricing/quote`
- `GET /api/settings/{business_id}`
- `PATCH /api/settings/{business_id}`

## UI Pages

- Dashboard: high-level bookings, idle minutes, saved cost, utilization, offer counts
- Optimizer: visual timeline, highlighted idle gaps, suggested move, offer generation
- Offers: generated offer list with message preview and public links
- Customer Inbox: customer list, mock channel preview, accept/decline simulator
- Smart Booking: dynamic pricing quote and slot cards
- Settings: editable optimization policy
- Public Offer: customer-facing accept or decline page

## Seed Data

The seed includes:

- Urban Cut Studio: hair salon with Anna, Max, haircut/coloring/beard trim services, consent examples, and a visible 13:10-15:00 idle gap.
- FastFix Auto: auto service with Markus, oil change/diagnostics/brake inspection services, flexible drop-off customer data, and multiple schedule gaps.

## Known Limitations

- The backend creates tables on startup for demo convenience.
- Alembic is configured, but the demo path does not require running migrations manually.
- Booking and communication providers are mock-only.
- Authentication, billing, audit logs, OAuth storage, and webhooks are intentionally out of scope.
- Timezone handling is simplified around the seeded Europe/Vienna demo data.

## Next Steps

See [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).

