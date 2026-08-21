from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.configuration import router as configuration_router
from app.api.demo import router as demo_router
from app.api.offers import accept_offer, decline_offer, router as offers_router
from app.api.optimization import generate_offer, router as optimization_router
from app.api.schedule import router as schedule_router
from app.core.config import settings
from app.db.session import engine
from app.models import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    application = FastAPI(title=settings.app_name, lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(demo_router)
    application.include_router(schedule_router)
    application.include_router(optimization_router)
    application.include_router(offers_router)
    application.include_router(configuration_router)
    return application


app = create_app()

# Backward-compatible exports for direct lifecycle unit tests and integrations.
__all__ = ["accept_offer", "app", "create_app", "decline_offer", "generate_offer"]
