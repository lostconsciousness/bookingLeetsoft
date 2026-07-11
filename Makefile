.PHONY: up down seed test backend-test frontend-build

up:
	docker compose up --build

down:
	docker compose down

seed:
	curl -X POST http://localhost:8000/api/demo/seed

test:
	cd backend && pytest

backend-test:
	cd backend && pytest

frontend-build:
	cd frontend && npm run build

