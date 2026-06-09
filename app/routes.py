from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models import CatalogResponse, ChatRequest, ChatResponse, MusicLibraryResponse, ProviderTestRequest, ProviderTestResponse
from app.services.orchestrator import orchestrator
from app.services.music import get_music_library, resolve_track_path


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


@router.get("/music/library", response_model=MusicLibraryResponse)
async def music_library() -> MusicLibraryResponse:
    return get_music_library()


@router.get("/music/track/{track_id}")
async def music_track(track_id: str) -> FileResponse:
    path = resolve_track_path(track_id)
    return FileResponse(path)
