"""
store/redis_store.py
====================
Redis persistence layer for conversations, session artifacts, profiles, and users.

Extended vs original:
  - RedisConversationStore.save_session_artifact() / get_session_artifact()
    persists rich session products (papers, gaps, final_outline) under a
    separate key, stripped of numpy embeddings before JSON serialisation.
  - RedisProfileStore.get() returns a UserProfile instance via from_dict().
  - ConversationManager.save() now also accepts an optional artifacts kwarg.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import redis.asyncio as redis

from config import settings
from profile.models import UserProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_embeddings(obj: Any) -> Any:
    """Recursively remove 'embedding' keys from dicts/lists (numpy-safe)."""
    if isinstance(obj, dict):
        return {k: _strip_embeddings(v) for k, v in obj.items() if k != "embedding"}
    if isinstance(obj, list):
        return [_strip_embeddings(item) for item in obj]
    # Numpy arrays — convert to list so json.dumps can handle them if they
    # somehow slip through.  In practice the above key filter should catch all.
    try:
        import numpy as np  # noqa: PLC0415
        if isinstance(obj, np.ndarray):
            return obj.tolist()
    except ImportError:
        pass
    return obj


# ---------------------------------------------------------------------------
# RedisConversationStore
# ---------------------------------------------------------------------------

class RedisConversationStore:
    """Low-level key/value store for conversation histories and session artifacts."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    # --- Raw key/value (used by ConversationManager for raw history JSON) ---

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)

    async def set(self, key: str, value: str, ttl: int = 86400):
        await self.client.set(key, value, ex=ttl)

    async def delete(self, key: str):
        await self.client.delete(key)

    # --- Session artifact storage (papers / gaps / final_outline) ---

    @staticmethod
    def _artifact_key(user_id: str, session_id: str) -> str:
        return f"artifact:{user_id}:{session_id}"

    async def save_session_artifact(
        self,
        user_id: str,
        session_id: str,
        papers: list[dict] | None = None,
        gaps: list[dict] | None = None,
        final_outline: str | None = None,
        ttl: int = 86400 * 7,   # 7 days — outlasts basic history
    ) -> None:
        """Persist rich pipeline products for later sidebar restoration.

        Embeddings are stripped before serialisation — numpy arrays are not
        JSON-serialisable and are useless to the frontend.
        """
        payload: dict[str, Any] = {}
        if papers is not None:
            payload["papers"] = _strip_embeddings(papers)
        if gaps is not None:
            payload["gaps"] = _strip_embeddings(gaps)
        if final_outline is not None:
            payload["final_outline"] = final_outline

        if payload:
            await self.client.set(
                self._artifact_key(user_id, session_id),
                json.dumps(payload, ensure_ascii=False),
                ex=ttl,
            )

    async def get_session_artifact(self, user_id: str, session_id: str) -> dict:
        """Return stored artifact dict, or empty dict if not found."""
        raw = await self.client.get(self._artifact_key(user_id, session_id))
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}


# ---------------------------------------------------------------------------
# RedisProfileStore
# ---------------------------------------------------------------------------

class RedisProfileStore:
    """Stores UserProfile instances for each user."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def get(self, user_id: str) -> Optional[dict]:
        raw = await self.client.get(f"profile:{user_id}")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """Return a hydrated UserProfile, or None if not stored."""
        data = await self.get(user_id)
        if data is None:
            return None
        try:
            return UserProfile.from_dict(data)
        except Exception:
            return None

    async def set(self, user_id: str, profile: "UserProfile | dict"):
        if isinstance(profile, UserProfile):
            payload = profile.to_dict()
        else:
            payload = dict(profile)
        await self.client.set(f"profile:{user_id}", json.dumps(payload, ensure_ascii=False))

    async def update_weak_points(self, user_id: str, weak_points: dict) -> None:
        """Atomically update only the weak_points field of the stored profile."""
        profile = await self.get_profile(user_id)
        if profile is None:
            return
        profile.weak_points = weak_points
        await self.set(user_id, profile)


# ---------------------------------------------------------------------------
# UserStore
# ---------------------------------------------------------------------------

class UserStore:
    """Minimal credential store (email → bcrypt hash)."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _key(email: str) -> str:
        return f"users:{email}"

    async def exists(self, email: str) -> bool:
        return bool(await self.client.exists(self._key(email)))

    async def create(self, email: str, password_hash: str) -> None:
        await self.client.hset(self._key(email), mapping={"password_hash": password_hash})

    async def get_hash(self, email: str) -> Optional[str]:
        return await self.client.hget(self._key(email), "password_hash")
