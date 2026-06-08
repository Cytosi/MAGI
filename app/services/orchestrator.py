from __future__ import annotations

import asyncio

from app.config import EVALUATOR_PROMPT, PERSONAS, RuntimeProviderConfig, get_env_provider_defaults, get_provider_presets
from app.models import (
    CatalogResponse,
    ChatRequest,
    ChatResponse,
    EvaluationResult,
    MagiReply,
    ProviderPresetResponse,
    ProviderSelection,
    ProviderTestRequest,
    ProviderTestResponse,
)
from app.services.providers import ProviderClient


SLOT_LABELS = {
    "melchior": "MELCHIOR",
    "balthasar": "BALTHASAR",
    "casper": "CASPER",
}

EVALUATOR_PRIORITY = ["qwen", "gpt", "gemini", "deepseek", "doubao", "custom"]


class MagiOrchestrator:
    def catalog(self) -> CatalogResponse:
        presets = [
            ProviderPresetResponse(
                key=item.key,
                label=item.label,
                base_url=item.base_url,
                default_model=item.default_model,
                docs_url=item.docs_url,
            )
            for item in get_provider_presets()
        ]
        env_defaults = get_env_provider_defaults()
        recommended = [
            ProviderSelection(
                slot="melchior",
                provider_key="doubao",
                label="Doubao",
                model=env_defaults["doubao"]["model"],
                base_url=env_defaults["doubao"]["base_url"],
            ),
            ProviderSelection(
                slot="balthasar",
                provider_key="deepseek",
                label="DeepSeek",
                model=env_defaults["deepseek"]["model"],
                base_url=env_defaults["deepseek"]["base_url"],
            ),
            ProviderSelection(
                slot="casper",
                provider_key="qwen",
                label="Qwen",
                model=env_defaults["qwen"]["model"],
                base_url=env_defaults["qwen"]["base_url"],
            ),
        ]
        return CatalogResponse(presets=presets, recommended=recommended)

    async def test_providers(self, request: ProviderTestRequest) -> ProviderTestResponse:
        providers = self._build_provider_clients(request.providers)
        results = await asyncio.gather(
            *[
                provider.generate(
                    prompt="Reply with CONNECTION OK only.",
                    system_prompt="This is a connectivity probe. Return CONNECTION OK only.",
                    temperature=0,
                    max_tokens=32,
                )
                for provider in providers
            ]
        )
        ready_count = sum(1 for item in results if item.status == "ready")
        return ProviderTestResponse(results=results, ready_count=ready_count)

    async def deliberate(self, request: ChatRequest) -> ChatResponse:
        providers = self._build_provider_clients(request.providers)
        council = await asyncio.gather(
            *[
                provider.generate(
                    prompt=request.prompt,
                    system_prompt=request.system_prompt,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                )
                for provider in providers
            ]
        )
        evaluation = await self._evaluate(council, providers, request)
        consensus = evaluation.content if evaluation.status == "ready" else self._fallback_consensus(council)
        return ChatResponse(
            prompt=request.prompt,
            consensus=consensus,
            council=council,
            evaluation=evaluation,
        )

    def _build_provider_clients(self, selections: list[ProviderSelection]) -> list[ProviderClient]:
        env_defaults = get_env_provider_defaults()
        preset_map = {item.key: item for item in get_provider_presets()}
        clients: list[ProviderClient] = []

        for selection in selections:
            env_config = env_defaults.get(selection.provider_key, {})
            preset = preset_map.get(selection.provider_key)
            label = selection.label.strip() or (preset.label if preset else selection.provider_key)
            model = selection.model.strip() or env_config.get("model", "") or (preset.default_model if preset else "")
            base_url = selection.base_url.strip() or env_config.get("base_url", "") or (preset.base_url if preset else "")
            api_key = env_config.get("api_key", "")

            clients.append(
                ProviderClient(
                    RuntimeProviderConfig(
                        code=selection.slot,
                        display_name=f"{SLOT_LABELS[selection.slot]} / {label}",
                        provider_key=selection.provider_key,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        persona=PERSONAS[selection.slot],
                    )
                )
            )

        return clients

    async def _evaluate(
        self,
        council: list[MagiReply],
        providers: list[ProviderClient],
        request: ChatRequest,
    ) -> EvaluationResult:
        ready_members = [member for member in council if member.status == "ready"]
        if not ready_members:
            return EvaluationResult(
                name="EVALUATOR",
                provider_key="none",
                model="none",
                status="skipped",
                content="No MAGI node returned a usable answer. Restore provider connectivity and try again.",
                latency_ms=0,
                error="no_ready_member",
            )

        evaluator = self._pick_evaluator(providers)
        evaluation_prompt = self._build_evaluation_prompt(request.prompt, ready_members)
        reply = await evaluator.generate(
            prompt=evaluation_prompt,
            system_prompt=EVALUATOR_PROMPT,
            temperature=0.2,
            max_tokens=min(request.max_tokens, 900),
        )
        return EvaluationResult(
            name=f"EVALUATOR / {evaluator.config.display_name}",
            provider_key=evaluator.config.provider_key,
            model=evaluator.config.model,
            status="ready" if reply.status == "ready" else "error",
            content=reply.content if reply.content else self._fallback_consensus(council),
            latency_ms=reply.latency_ms,
            error=reply.error,
        )

    @staticmethod
    def _pick_evaluator(providers: list[ProviderClient]) -> ProviderClient:
        sorted_providers = sorted(
            providers,
            key=lambda item: EVALUATOR_PRIORITY.index(item.config.provider_key)
            if item.config.provider_key in EVALUATOR_PRIORITY
            else len(EVALUATOR_PRIORITY),
        )
        return sorted_providers[0]

    @staticmethod
    def _build_evaluation_prompt(user_prompt: str, ready_members: list[MagiReply]) -> str:
        sections = [
            "User question:",
            user_prompt,
            "",
            "Council answers:",
        ]
        for member in ready_members:
            sections.append(f"{member.name}:")
            sections.append(member.content)
            sections.append("")
        sections.append("Synthesize the answers above and return one final verdict only.")
        return "\n".join(sections).strip()

    @staticmethod
    def _fallback_consensus(council: list[MagiReply]) -> str:
        ready_members = [member for member in council if member.status == "ready"]
        if not ready_members:
            return "No MAGI node returned a usable answer. Check provider access, billing, and network connectivity."
        return "\n\n".join(f"{member.name}\n{member.content}" for member in ready_members)


orchestrator = MagiOrchestrator()
