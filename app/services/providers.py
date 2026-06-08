from __future__ import annotations

import time
from dataclasses import dataclass

import httpx

from app.config import RuntimeProviderConfig
from app.models import MagiReply


def _friendly_error_message(provider_key: str, exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 401:
            return "鉴权失败，请检查 API Key 是否正确，以及是否属于对应平台。"
        if status == 402:
            return "账户当前不可用，通常是余额不足、未开通计费或额度已耗尽。"
        if status == 403:
            return "请求被拒绝，请检查模型权限、区域权限或账号是否已开通该服务。"
        if status == 404:
            if provider_key == "doubao":
                return "Doubao 返回 404。通常是模型名不存在、账号所在区域不匹配，或该模型在当前账号下不可用。"
            return "请求地址或模型不存在，请检查 Base URL 和模型名。"
        if status == 429:
            return "请求过多，已触发限流，请稍后重试。"
        if 500 <= status <= 599:
            return "上游模型服务暂时异常，请稍后重试。"

    if isinstance(exc, httpx.TimeoutException):
        return "请求超时，请检查网络连通性或稍后重试。"

    return "本次同步失败，请检查模型名、Base URL、API Key 权限或网络连通性。"


@dataclass
class ProviderClient:
    config: RuntimeProviderConfig
    timeout_seconds: float = 90.0

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> MagiReply:
        if not self.config.api_key:
            return MagiReply(
                code=self.config.code,
                name=self.config.display_name,
                provider_key=self.config.provider_key,
                status="missing_config",
                content="未配置 API Key，当前贤人处于离线待机状态。",
                model=self.config.model,
                base_url=self.config.base_url,
                latency_ms=0,
                error="missing_api_key",
            )

        started = time.perf_counter()
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": f"{system_prompt}\n\n{self.config.persona}"},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.config.base_url.rstrip('/')}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return MagiReply(
                code=self.config.code,
                name=self.config.display_name,
                provider_key=self.config.provider_key,
                status="error",
                content=_friendly_error_message(self.config.provider_key, exc),
                model=self.config.model,
                base_url=self.config.base_url,
                latency_ms=latency_ms,
                error=str(exc),
            )

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "模型返回为空。")
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return MagiReply(
            code=self.config.code,
            name=self.config.display_name,
            provider_key=self.config.provider_key,
            status="ready",
            content=content,
            model=self.config.model,
            base_url=self.config.base_url,
            latency_ms=latency_ms,
            error=None,
        )
