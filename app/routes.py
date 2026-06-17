from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.models import (
    CatalogResponse,
    ChatRequest,
    ChatResponse,
    MusicLibraryResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    UserAuthRequest,
    UserConfigResponse,
    UserConfigUpdateRequest,
    UserHistoryResponse,
    UserSessionResponse,
)
from app.services.orchestrator import orchestrator
from app.services.music import get_music_library, resolve_track_path
from app.services.user_auth import UserIdentity, create_user_token, require_user_token
from app.services.user_store import append_history, authenticate_user, build_prompt_with_history, clear_history, get_history, get_user_bundle, register_user, save_user_config


router = APIRouter(tags=["magi"])


@router.get("/catalog", response_model=CatalogResponse)
async def catalog() -> CatalogResponse:
    return orchestrator.catalog()


@router.post("/auth/register", response_model=UserSessionResponse)
async def auth_register(request: UserAuthRequest) -> UserSessionResponse:
    username = register_user(request.username, request.password)
    token, expires_at = create_user_token(username)
    return UserSessionResponse(username=username, token=token, expires_at=expires_at)


@router.post("/auth/login", response_model=UserSessionResponse)
async def auth_login(request: UserAuthRequest) -> UserSessionResponse:
    username = authenticate_user(request.username, request.password)
    token, expires_at = create_user_token(username)
    return UserSessionResponse(username=username, token=token, expires_at=expires_at)


@router.get("/auth/session", response_model=UserSessionResponse)
async def auth_session(user: UserIdentity = Depends(require_user_token)) -> UserSessionResponse:
    token, expires_at = create_user_token(user.username)
    return UserSessionResponse(username=user.username, token=token, expires_at=expires_at)


@router.get("/user/config", response_model=UserConfigResponse)
async def user_config(user: UserIdentity = Depends(require_user_token)) -> UserConfigResponse:
    return get_user_bundle(user.username)


@router.post("/user/config", response_model=UserConfigResponse)
async def update_user_config(
    request: UserConfigUpdateRequest,
    user: UserIdentity = Depends(require_user_token),
) -> UserConfigResponse:
    return save_user_config(user.username, request)


@router.get("/user/history", response_model=UserHistoryResponse)
async def user_history(user: UserIdentity = Depends(require_user_token)) -> UserHistoryResponse:
    return UserHistoryResponse(username=user.username, history=get_history(user.username))


@router.delete("/user/history", response_model=UserHistoryResponse)
async def delete_user_history(user: UserIdentity = Depends(require_user_token)) -> UserHistoryResponse:
    clear_history(user.username)
    return UserHistoryResponse(username=user.username, history=[])


@router.post("/test-providers", response_model=ProviderTestResponse)
async def test_providers(
    request: ProviderTestRequest,
    user: UserIdentity = Depends(require_user_token),
) -> ProviderTestResponse:
    return await orchestrator.test_providers(request, user.username)


@router.post("/deliberate", response_model=ChatResponse)
async def deliberate(
    request: ChatRequest,
    user: UserIdentity = Depends(require_user_token),
) -> ChatResponse:
    enriched = request.model_copy(update={"prompt": build_prompt_with_history(user.username, request.prompt)})
    response = await orchestrator.deliberate(enriched, user.username)
    append_history(user.username, request.prompt, response.consensus)
    return response


@router.get("/music/library", response_model=MusicLibraryResponse)
async def music_library() -> MusicLibraryResponse:
    return get_music_library()


@router.get("/music/track/{track_id}")
async def music_track(track_id: str) -> FileResponse:
    path = resolve_track_path(track_id)
    return FileResponse(path)
