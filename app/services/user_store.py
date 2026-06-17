from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from threading import Lock
from time import strftime

from fastapi import HTTPException

from app.config import get_env_provider_defaults, get_provider_presets
from app.models import HistoryEntry, ProviderSelection, RuntimeSettings, UserConfigResponse, UserConfigUpdateRequest, UserProviderConfig


BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
ACCOUNTS_PATH = DATA_DIR / "user_accounts.json"
PROFILES_DIR = DATA_DIR / "user_profiles"
STORE_LOCK = Lock()
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")
PASSWORD_ITERATIONS = 150_000


DEFAULT_RUNTIME = RuntimeSettings()


def _ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _validate_username(username: str) -> str:
    normalized = username.strip()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=400,
            detail="Username must use letters, numbers, dot, underscore, or hyphen only.",
        )
    return normalized


def _profile_path(username: str) -> Path:
    return PROFILES_DIR / f"{username}.json"


def _default_slots() -> list[ProviderSelection]:
    env_defaults = get_env_provider_defaults()
    return [
        ProviderSelection(
            slot="melchior",
            provider_key="doubao",
            label="Doubao",
            model=env_defaults["doubao"]["model"],
            base_url=env_defaults["doubao"]["base_url"],
            server_ready=bool(env_defaults["doubao"]["api_key"]),
        ),
        ProviderSelection(
            slot="balthasar",
            provider_key="deepseek",
            label="DeepSeek",
            model=env_defaults["deepseek"]["model"],
            base_url=env_defaults["deepseek"]["base_url"],
            server_ready=bool(env_defaults["deepseek"]["api_key"]),
        ),
        ProviderSelection(
            slot="casper",
            provider_key="qwen",
            label="Qwen",
            model=env_defaults["qwen"]["model"],
            base_url=env_defaults["qwen"]["base_url"],
            server_ready=bool(env_defaults["qwen"]["api_key"]),
        ),
    ]


def _provider_defaults(provider_key: str) -> tuple[str, str, str]:
    env_defaults = get_env_provider_defaults()
    preset_map = {item.key: item for item in get_provider_presets()}
    env_item = env_defaults.get(provider_key, {})
    preset = preset_map.get(provider_key)
    label = (preset.label if preset else provider_key).strip()
    model = env_item.get("model") or (preset.default_model if preset else "")
    base_url = env_item.get("base_url") or (preset.base_url if preset else "")
    return label, model, base_url


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_ITERATIONS)
    return digest.hex()


def _read_accounts() -> dict:
    _ensure_dirs()
    return _read_json(ACCOUNTS_PATH, {"users": {}})


def _read_profile(username: str) -> dict:
    _ensure_dirs()
    profile = _read_json(_profile_path(username), {})
    if profile:
        return profile

    defaults = _default_slots()
    profile = {
        "username": username,
        "runtime": DEFAULT_RUNTIME.model_dump(),
        "providers": [
            {
                "slot": item.slot,
                "provider_key": item.provider_key,
                "label": item.label,
                "model": item.model,
                "base_url": item.base_url,
                "api_key": "",
            }
            for item in defaults
        ],
        "history": [],
    }
    _write_json(_profile_path(username), profile)
    return profile


def register_user(username: str, password: str) -> str:
    normalized = _validate_username(username)
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    with STORE_LOCK:
        accounts = _read_accounts()
        if normalized in accounts["users"]:
            raise HTTPException(status_code=409, detail="Username already exists.")

        salt = os.urandom(16).hex()
        accounts["users"][normalized] = {
            "salt": salt,
            "password_hash": _hash_password(password, salt),
        }
        _write_json(ACCOUNTS_PATH, accounts)
        _read_profile(normalized)

    return normalized


def authenticate_user(username: str, password: str) -> str:
    normalized = _validate_username(username)
    with STORE_LOCK:
        accounts = _read_accounts()
        record = accounts["users"].get(normalized)

    if not record:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    expected = _hash_password(password, record["salt"])
    if expected != record["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return normalized


def _effective_provider_status(provider_key: str, saved_providers: list[dict]) -> bool:
    env_defaults = get_env_provider_defaults()
    if env_defaults.get(provider_key, {}).get("api_key"):
        return True
    return any(item.get("provider_key") == provider_key and item.get("api_key") for item in saved_providers)


def _history_from_profile(raw_history: list[dict]) -> list[HistoryEntry]:
    history: list[HistoryEntry] = []
    for item in raw_history[:20]:
        try:
            history.append(HistoryEntry.model_validate(item))
        except Exception:
            continue
    return history


def get_user_bundle(username: str) -> UserConfigResponse:
    normalized = _validate_username(username)
    with STORE_LOCK:
        profile = _read_profile(normalized)

    raw_providers = profile.get("providers") or []
    providers: list[UserProviderConfig] = []
    for slot in ("melchior", "balthasar", "casper"):
        item = next((entry for entry in raw_providers if entry.get("slot") == slot), None)
        if not item:
            default_item = next(selection for selection in _default_slots() if selection.slot == slot)
            providers.append(
                UserProviderConfig(
                    slot=slot,
                    provider_key=default_item.provider_key,
                    label=default_item.label,
                    model=default_item.model,
                    base_url=default_item.base_url,
                    api_key="",
                    has_api_key=False,
                    server_ready=default_item.server_ready,
                )
            )
            continue

        provider_key = str(item.get("provider_key", "")).strip()
        default_label, default_model, default_base_url = _provider_defaults(provider_key)
        has_api_key = bool(str(item.get("api_key", "")).strip())
        providers.append(
            UserProviderConfig(
                slot=slot,
                provider_key=provider_key,
                label=str(item.get("label", "")).strip() or default_label,
                model=str(item.get("model", "")).strip() or default_model,
                base_url=str(item.get("base_url", "")).strip() or default_base_url,
                api_key="",
                has_api_key=has_api_key,
                server_ready=_effective_provider_status(provider_key, raw_providers),
            )
        )

    runtime = RuntimeSettings.model_validate(profile.get("runtime") or DEFAULT_RUNTIME.model_dump())
    history = _history_from_profile(profile.get("history") or [])
    return UserConfigResponse(username=normalized, providers=providers, runtime=runtime, history=history)


def save_user_config(username: str, request: UserConfigUpdateRequest) -> UserConfigResponse:
    normalized = _validate_username(username)
    with STORE_LOCK:
        profile = _read_profile(normalized)
        existing_map = {item.get("slot"): item for item in profile.get("providers") or [] if item.get("slot")}
        to_store: list[dict] = []

        for provider in request.providers:
            previous = existing_map.get(provider.slot, {})
            api_key = provider.api_key.strip()
            if not api_key and previous.get("provider_key") == provider.provider_key:
                api_key = str(previous.get("api_key", "")).strip()

            to_store.append(
                {
                    "slot": provider.slot,
                    "provider_key": provider.provider_key,
                    "label": provider.label.strip(),
                    "model": provider.model.strip(),
                    "base_url": provider.base_url.strip(),
                    "api_key": api_key,
                }
            )

        profile["runtime"] = request.runtime.model_dump()
        profile["providers"] = to_store
        _write_json(_profile_path(normalized), profile)

    return get_user_bundle(normalized)


def get_provider_api_key(username: str, slot: str, provider_key: str) -> str:
    normalized = _validate_username(username)
    with STORE_LOCK:
        profile = _read_profile(normalized)

    for item in profile.get("providers") or []:
        if item.get("slot") == slot and item.get("provider_key") == provider_key:
            return str(item.get("api_key", "")).strip()
    return ""


def get_history(username: str) -> list[HistoryEntry]:
    return get_user_bundle(username).history


def append_history(username: str, prompt: str, answer: str) -> list[HistoryEntry]:
    normalized = _validate_username(username)
    with STORE_LOCK:
        profile = _read_profile(normalized)
        history = profile.get("history") or []
        history.insert(
            0,
            {
                "prompt": prompt,
                "answer": answer,
                "time": strftime("%Y-%m-%d %H:%M:%S"),
            },
        )
        profile["history"] = history[:20]
        _write_json(_profile_path(normalized), profile)

    return get_history(normalized)


def clear_history(username: str) -> None:
    normalized = _validate_username(username)
    with STORE_LOCK:
        profile = _read_profile(normalized)
        profile["history"] = []
        _write_json(_profile_path(normalized), profile)


def build_prompt_with_history(username: str, prompt: str) -> str:
    history = get_history(username)[:5]
    if not history:
        return prompt

    memory_block = "\n\n".join(
        f"Memory {index + 1}\nQuestion: {item.prompt}\nFinal Verdict: {item.answer}"
        for index, item in enumerate(history)
    )
    return f"Conversation Memory:\n{memory_block}\n\nCurrent Question:\n{prompt}"
