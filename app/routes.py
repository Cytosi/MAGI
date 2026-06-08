from __future__ import annotations

from fastapi import APIRouter

from app.models import CatalogResponse, ChatRequest, ChatResponse, ProviderTestRequest, ProviderTestResponse
from app.services.orchestrator import orchestrator


router = APIRouter(tags=["magi"])


@router.get("/catalog", response_model=CatalogResponse)
async def catalog() -> CatalogResponse:
    return orchestrator.catalog()


@router.post("/test-providers", response_model=ProviderTestResponse)
async def test_providers(request: ProviderTestRequest) -> ProviderTestResponse:
    return await orchestrator.test_providers(request)


@router.post("/deliberate", response_model=ChatResponse)
async def deliberate(request: ChatRequest) -> ChatResponse:
    return await orchestrator.deliberate(request)
