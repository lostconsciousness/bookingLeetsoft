import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.services.demo_seed import seed_demo_data

router = APIRouter(prefix="/api")
seed_lock = asyncio.Lock()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/demo/reset")
async def reset_demo(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    async with seed_lock:
        await seed_demo_data(session)
    return {"status": "reset"}


@router.post("/demo/seed")
async def seed_demo(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    async with seed_lock:
        await seed_demo_data(session)
    return {"status": "seeded"}
