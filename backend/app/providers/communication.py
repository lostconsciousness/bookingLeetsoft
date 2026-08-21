from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CommunicationMessage, Customer


class CommunicationProvider(ABC):
    def __init__(self, session: AsyncSession):
        self.session = session

    @abstractmethod
    async def send_message(self, channel: str, customer: Customer, message: str, business_id: int, offer_id: int | None = None) -> CommunicationMessage:
        raise NotImplementedError

    async def receive_reply(self, payload: dict) -> dict:
        return {"status": "mock_received", "payload": payload}

    async def get_delivery_status(self, message_id: int) -> str:
        return "mock_delivered"


class MockCommunicationProvider(CommunicationProvider):
    async def send_message(self, channel: str, customer: Customer, message: str, business_id: int, offer_id: int | None = None) -> CommunicationMessage:
        row = CommunicationMessage(
            business_id=business_id,
            customer_id=customer.id,
            offer_id=offer_id,
            channel=channel,
            body=message,
            delivery_status="mock_delivered",
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def record_customer_reply(
        self,
        channel: str,
        customer: Customer,
        message: str,
        business_id: int,
        offer_id: int,
    ) -> CommunicationMessage:
        row = CommunicationMessage(
            business_id=business_id,
            customer_id=customer.id,
            offer_id=offer_id,
            channel=channel,
            direction="inbound",
            body=message,
            delivery_status="mock_received",
        )
        self.session.add(row)
        await self.session.flush()
        return row


class MockWhatsAppProvider(MockCommunicationProvider):
    pass


class MockSmsProvider(MockCommunicationProvider):
    pass


class MockEmailProvider(MockCommunicationProvider):
    pass


class MockTelegramProvider(MockCommunicationProvider):
    pass
