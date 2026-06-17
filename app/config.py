from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_DOUBAO_MODEL = "doubao-seed-1-8-251228"
DEFAULT_PILOT_NAME = "Shinji Ikari"
DEFAULT_ADMIN_SESSION_HOURS = 12
LEGACY_DOUBAO_MODELS = {
    "doubao-seed-1-6-thinking-250715",
}


def load_local_env() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_local_env()


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def get_admin_password() -> str:
    return _env("ADMIN_PASSWORD")


def is_admin_auth_configured() -> bool:
    return bool(get_admin_password())


def get_admin_session_hours() -> int:
    raw = _env("ADMIN_SESSION_HOURS", str(DEFAULT_ADMIN_SESSION_HOURS))
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_ADMIN_SESSION_HOURS
    return min(max(value, 1), 72)


def get_runtime_config_path() -> Path:
    return Path(_env("MAGI_RUNTIME_CONFIG", "data/runtime_config.json"))


@dataclass(frozen=True)
class ProviderPreset:
    key: str
    label: str
    base_url: str
    default_model: str
    docs_url: str


@dataclass(frozen=True)
class RuntimeProviderConfig:
    code: str
    display_name: str
    provider_key: str
    api_key: str
    model: str
    base_url: str
    persona: str


PERSONAS = {
    "melchior": "你是 MELCHIOR。请只输出最终结论，重点关注结构化判断、可执行方案和关键风险，不要展示推理过程。",
    "balthasar": "你是 BALTHASAR。请只输出最终结论，重点关注方案扩展、替代路径和创新机会，不要展示推理过程。",
    "casper": "你是 CASPER。请只输出最终结论，重点关注用户体验、沟通成本和长期可维护性，不要展示推理过程。",
}

EVALUATOR_PROMPT = (
    "你是 EVA 三贤人系统的最终评测模型。"
    "你会收到三位贤人的最终结论，请综合它们，只输出一份最终结果。"
    "输出必须使用中文，简洁清晰，不要展示推理过程，不要复述评测规则。"
    "请使用以下结构：最终结论、执行方案、主要风险。"
)


def get_provider_presets() -> list[ProviderPreset]:
    return [
        ProviderPreset(
            key="gpt",
            label="GPT",
            base_url="https://api.openai.com/v1",
            default_model="gpt-4o-mini",
            docs_url="https://platform.openai.com/docs/api-reference/chat/create",
        ),
        ProviderPreset(
            key="gemini",
            label="Gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            default_model="gemini-2.5-flash",
            docs_url="https://ai.google.dev/gemini-api/docs/openai?hl=zh-cn",
        ),
        ProviderPreset(
            key="qwen",
            label="Qwen",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            default_model="qwen-plus",
            docs_url="https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
        ),
        ProviderPreset(
            key="deepseek",
            label="DeepSeek",
            base_url="https://api.deepseek.com",
            default_model="deepseek-v4-flash",
            docs_url="https://api-docs.deepseek.com/",
        ),
        ProviderPreset(
            key="doubao",
            label="Doubao",
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            default_model=DEFAULT_DOUBAO_MODEL,
            docs_url="https://www.volcengine.com/docs/82379/1302010",
        ),
        ProviderPreset(
            key="custom",
            label="自定义",
            base_url="https://your-provider.example.com/v1",
            default_model="your-model-name",
            docs_url="",
        ),
    ]


def get_env_provider_defaults() -> dict[str, dict[str, str]]:
    return {
        "gpt": {
            "api_key": _env("OPENAI_API_KEY"),
            "model": _env("OPENAI_MODEL", "gpt-4o-mini"),
            "base_url": _env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        },
        "gemini": {
            "api_key": _env("GEMINI_API_KEY"),
            "model": _env("GEMINI_MODEL", "gemini-2.5-flash"),
            "base_url": _env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
        },
        "qwen": {
            "api_key": _env("QWEN_API_KEY"),
            "model": _env("QWEN_MODEL", "qwen-plus"),
            "base_url": _env("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        },
        "deepseek": {
            "api_key": _env("DEEPSEEK_API_KEY"),
            "model": _env("DEEPSEEK_MODEL", "deepseek-v4-flash"),
            "base_url": _env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        },
        "doubao": {
            "api_key": _env("DOUBAO_API_KEY", _env("ARK_API_KEY")),
            "model": _env("DOUBAO_MODEL", DEFAULT_DOUBAO_MODEL),
            "base_url": _env("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
        },
    }
