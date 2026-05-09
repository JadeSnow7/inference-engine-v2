import json
import time
import uuid
from typing import Optional

from config import settings


class ConversationManager:
    def __init__(self, redis_client):
        # Accept a RedisConversationStore, a duck-typed store (has get/set/delete),
        # or a raw async redis client.
        # self.redis_client is used throughout the manager for get/set/delete;
        # self._store exposes richer methods (e.g. save_session_artifact).
        _has_store_api = (
            hasattr(redis_client, "get")
            and hasattr(redis_client, "set")
            and hasattr(redis_client, "delete")
        )
        if _has_store_api:
            # Already a store-like object (RedisConversationStore or FakeRedisStore)
            self._store = redis_client
            self.redis_client = redis_client
        else:
            # Raw async redis client — wrap it
            from store.redis_store import RedisConversationStore  # local to avoid circular deps
            self._store = RedisConversationStore(redis_client)
            self.redis_client = self._store

    def _history_key(self, user_id: str, session_id: str) -> str:
        return f"hist:{user_id}:{session_id}"

    def _index_key(self, user_id: str) -> str:
        return f"sessions:{user_id}"

    def _bailian_session_key(self, user_id: str, session_id: str) -> str:
        return f"bailian:session:{user_id}:{session_id}"

    def _make_title(self, initial_message: str) -> str:
        title = " ".join(initial_message.split()).strip()
        return title[:40] if title else "新会话"

    async def _load_index(self, user_id: str) -> list[dict]:
        raw = await self.redis_client.get(self._index_key(user_id))
        if not raw:
            return []
        try:
            return json.loads(raw)
        except Exception:
            return []

    async def _save_index(self, user_id: str, sessions: list[dict]) -> None:
        await self.redis_client.set(self._index_key(user_id), json.dumps(sessions, ensure_ascii=False), ttl=86400)

    async def ensure_session(self, user_id: str, session_id: Optional[str], initial_message: str) -> str:
        sessions = await self._load_index(user_id)
        if session_id and any(session.get("session_id") == session_id for session in sessions):
            return session_id

        resolved_session_id = uuid.uuid4().hex
        sessions.insert(
            0,
            {
                "session_id": resolved_session_id,
                "title": self._make_title(initial_message),
                "scene": "",
                "updated_at": int(time.time()),
                "message_count": 0,
            },
        )
        await self._save_index(user_id, sessions)
        return resolved_session_id

    async def load(self, user_id: str, session_id: str) -> list[dict]:
        raw = await self.redis_client.get(self._history_key(user_id, session_id))
        if not raw:
            return []
        try:
            return json.loads(raw)
        except Exception:
            return []

    async def save(self, user_id: str, session_id: str, user_msg: str, assistant_msg: str, scene: str):
        hist = await self.load(user_id, session_id)
        hist.extend(
            [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg},
            ]
        )
        while self._estimate_tokens(hist) > settings.MAX_HISTORY_TOKENS and len(hist) >= 2:
            hist = hist[2:]
        await self.redis_client.set(self._history_key(user_id, session_id), json.dumps(hist, ensure_ascii=False), ttl=86400)

        sessions = await self._load_index(user_id)
        sessions = [session for session in sessions if session.get("session_id") != session_id]
        sessions.insert(
            0,
            {
                "session_id": session_id,
                "title": self._make_title(hist[0]["content"]) if hist else self._make_title(user_msg),
                "scene": scene,
                "updated_at": int(time.time()),
                "message_count": len(hist),
            },
        )
        await self._save_index(user_id, sessions)

    async def list_sessions(self, user_id: str, limit: int = 20, offset: int = 0) -> dict:
        sessions = await self._load_index(user_id)
        sessions.sort(key=lambda item: item.get("updated_at", 0), reverse=True)
        return {"total": len(sessions), "items": sessions[offset : offset + limit]}

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        sessions = await self._load_index(user_id)
        filtered = [session for session in sessions if session.get("session_id") != session_id]
        if len(filtered) == len(sessions):
            return False
        await self.redis_client.delete(self._history_key(user_id, session_id))
        await self.redis_client.delete(self._bailian_session_key(user_id, session_id))
        await self._save_index(user_id, filtered)
        return True

    async def get_bailian_app_session(self, user_id: str, session_id: str) -> Optional[str]:
        return await self.redis_client.get(self._bailian_session_key(user_id, session_id))

    async def save_bailian_app_session(self, user_id: str, session_id: str, app_session_id: str) -> None:
        if app_session_id:
            await self.redis_client.set(self._bailian_session_key(user_id, session_id), app_session_id, ttl=86400 * 7)

    def _estimate_tokens(self, hist: list[dict]) -> int:
        return sum(len(m["content"]) // 2 for m in hist)
