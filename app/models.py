from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


DEFAULT_SYSTEM_PROMPT = (
    "Return final answers only. Do not expose reasoning. "
    "Respond in Chinese and include conclusion, execution plan, and risks."
)


class ProviderSelection(BaseModel):
    slot: Literal["melchior", "balthasar", "casper"]
    provider_key: str = Field(..., min_length=1, max_length=32)
    label: str = Field(default="", max_length=80)
    model: str = Field(default="", max_length=120)
    base_url: str = Field(default="", max_length=500)
    server_ready: bool = False


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=12000)
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT, max_length=4000)
    temperature: float = Field(default=0.4, ge=0, le=2)
    max_tokens: int = Field(default=900, ge=128, le=4000)
    providers: list[ProviderSelection] = Field(..., min_length=3, max_length=3)

    @model_validator(mode="after")
    def validate_unique_providers(self) -> "ChatRequest":
        slots = [provider.slot for provider in self.providers]
        if len(set(slots)) != 3:
            raise ValueError("Each MAGI slot must be configured exactly once.")

        provider_keys = [provider.provider_key for provider in self.providers]
        if len(set(provider_keys)) != 3:
            raise ValueError("All three MAGI providers must be unique.")

        for provider in self.providers:
            if not provider.label.strip():
                raise ValueError(f"{provider.slot} is missing a display label.")
            if not provider.model.strip():
                raise ValueError(f"{provider.slot} is missing a model name.")
            if not provider.base_url.strip():
                raise ValueError(f"{provider.slot} is missing a base URL.")

        return self


class ProviderTestRequest(BaseModel):
    providers: list[ProviderSelection] = Field(..., min_length=3, max_length=3)

    @model_validator(mode="after")
    def validate_unique_providers(self) -> "ProviderTestRequest":
        slots = [provider.slot for provider in self.providers]
        if len(set(slots)) != 3:
            raise ValueError("Each MAGI slot must be configured exactly once.")
        return self


class MagiReply(BaseModel):
    code: str
    name: str
    provider_key: str
    status: Literal["ready", "error", "missing_config"]
    content: str
    model: str
    base_url: str
    latency_ms: int
    error: str | None = None


class EvaluationResult(BaseModel):
    name: str
    provider_key: str
    model: str
    status: Literal["ready", "error", "skipped"]
    content: str
    latency_ms: int
    error: str | None = None


class ChatResponse(BaseModel):
    prompt: str
    consensus: str
    council: list[MagiReply]
    evaluation: EvaluationResult


class ProviderTestResponse(BaseModel):
    results: list[MagiReply]
    ready_count: int


class ProviderPresetResponse(BaseModel):
    key: str
    label: str
    base_url: str
    default_model: str
    docs_url: str
    server_ready: bool = False


class CatalogResponse(BaseModel):
    presets: list[ProviderPresetResponse]
    recommended: list[ProviderSelection]


class MusicTrackResponse(BaseModel):
    id: str
    title: str
    artist: str
    filename: str
    available: bool
    reason: str | None = None


class MusicLibraryResponse(BaseModel):
    root: str
    tracks: list[MusicTrackResponse]
