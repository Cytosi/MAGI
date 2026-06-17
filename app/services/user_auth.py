from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException


SESSION_HOURS = 24
SESSION_SECRET = hashlib.sha256(b"magi-user-session").hexdigest()


@dataclass(frozen=True)
class UserIdentity:
    username: str


def create_user_token(username: str) -> tuple[str, int]:
    expires_at = int(time.time()) + SESSION_HOURS * 3600
    payload = {
        "sub": username,
        "exp": expires_at,
        "nonce": secrets.token_hex(8),
        "scope": "magi-user",
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}", expires_at


def verify_user_token(token: str) -> UserIdentity:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Malformed user token.") from exc

    expected = hmac.new(SESSION_SECRET.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid user token.")

    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    if payload.get("scope") != "magi-user":
        raise HTTPException(status_code=401, detail="Invalid user scope.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="User session expired.")

    username = str(payload.get("sub", "")).strip()
    if not username:
        raise HTTPException(status_code=401, detail="Missing user identity.")
    return UserIdentity(username=username)


def require_user_token(x_user_token: str | None = Header(default=None)) -> UserIdentity:
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Missing X-User-Token header.")
    return verify_user_token(x_user_token)
