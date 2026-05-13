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
# RedisDocumentStore
# ---------------------------------------------------------------------------

class RedisDocumentStore:
    """Per-user document and version persistence."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _document_key(user_id: str, document_id: str) -> str:
        return f"document:{user_id}:{document_id}"

    @staticmethod
    def _versions_key(user_id: str, document_id: str) -> str:
        return f"document_versions:{user_id}:{document_id}"

    async def save_document(self, user_id: str, document: dict) -> dict:
        await self.client.set(
            self._document_key(user_id, document["id"]),
            json.dumps(document, ensure_ascii=False),
        )
        return document

    async def get_document(self, user_id: str, document_id: str) -> Optional[dict]:
        raw = await self.client.get(self._document_key(user_id, document_id))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def add_version(self, user_id: str, document_id: str, version: dict) -> dict:
        await self.client.lpush(
            self._versions_key(user_id, document_id),
            json.dumps(version, ensure_ascii=False),
        )
        return version

    async def list_versions(self, user_id: str, document_id: str) -> list[dict]:
        rows = await self.client.lrange(self._versions_key(user_id, document_id), 0, -1)
        versions = []
        for row in rows:
            try:
                versions.append(json.loads(row))
            except Exception:
                continue
        return versions

    async def get_version(self, user_id: str, document_id: str, version_id: str) -> Optional[dict]:
        for version in await self.list_versions(user_id, document_id):
            if version.get("id") == version_id:
                return version
        return None


# ---------------------------------------------------------------------------
# RedisCourseStore
# ---------------------------------------------------------------------------

DEFAULT_RESEARCH_SPACES: list[dict[str, Any]] = [
    {
        "id": "microeconomics-llm-education",
        "title": "Principles of Microeconomics",
        "teacher": "Prof. John Doe",
        "topic": "大语言模型在教育领域的应用综述",
        "literatureCount": 24,
        "graphUpdates": 5,
        "status": "正在撰写文献综述",
        "material": {
            "title": "Theory of the Firm",
            "type": "outline",
            "sourceType": "lecture",
        },
    },
    {
        "id": "education-research-methods-ai-feedback",
        "title": "Research Methods in Education",
        "teacher": "Dr. Lin Chen",
        "topic": "AI 学习反馈工具的课堂成效研究",
        "literatureCount": 18,
        "graphUpdates": 3,
        "status": "等待规范校验",
        "material": {
            "title": "A Survey on AI-Powered Educational Tools",
            "type": "review",
            "sourceType": "paper",
        },
    },
    {
        "id": "academic-writing-thesis-norms",
        "title": "Academic Writing",
        "teacher": "Writing Center",
        "topic": "本科论文结构与引用规范",
        "literatureCount": 9,
        "graphUpdates": 2,
        "status": "需要补充引用证据",
        "material": {
            "title": "HUST Undergraduate Thesis Norms",
            "type": "gap",
            "sourceType": "lecture",
        },
    },
]


class RedisCourseStore:
    """Stores per-user research-space data, seeded by safe defaults."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _spaces_key(user_id: str) -> str:
        return f"research_spaces:{user_id}"

    async def list_research_spaces(self, user_id: str) -> list[dict]:
        raw = await self.client.get(self._spaces_key(user_id))
        if not raw:
            return [json.loads(json.dumps(space, ensure_ascii=False)) for space in DEFAULT_RESEARCH_SPACES]
        try:
            spaces = json.loads(raw)
        except Exception:
            return [json.loads(json.dumps(space, ensure_ascii=False)) for space in DEFAULT_RESEARCH_SPACES]
        return spaces if isinstance(spaces, list) else [json.loads(json.dumps(space, ensure_ascii=False)) for space in DEFAULT_RESEARCH_SPACES]

    async def get_research_space(self, user_id: str, space_id: str) -> Optional[dict]:
        for space in await self.list_research_spaces(user_id):
            if space.get("id") == space_id:
                return space
        return None


# ---------------------------------------------------------------------------
# RedisEvidenceStore
# ---------------------------------------------------------------------------

DEFAULT_EVIDENCE: list[dict[str, Any]] = [
    {
        "id": "norm-hust-2026",
        "title": "华中科技大学本科论文写作规范",
        "venue": "HUST Norm Corpus",
        "year": 2026,
        "score": 0.94,
        "type": "norm",
    },
    {
        "id": "edu-llm-review-2025",
        "title": "Large Language Models in Education: A Comprehensive Review",
        "venue": "Computers & Education",
        "year": 2025,
        "score": 0.91,
        "type": "paper",
    },
    {
        "id": "ai-feedback-2024",
        "title": "AI Feedback Tools and Learning Outcomes",
        "venue": "Learning Analytics",
        "year": 2024,
        "score": 0.87,
        "type": "paper",
    },
]


class RedisEvidenceStore:
    """Stores user-scoped evidence references surfaced in Library."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _evidence_key(user_id: str) -> str:
        return f"evidence:{user_id}"

    async def save_evidence(self, user_id: str, items: list[dict]) -> None:
        await self.client.set(
            self._evidence_key(user_id),
            json.dumps(items, ensure_ascii=False),
        )

    async def list_evidence(self, user_id: str) -> list[dict]:
        raw = await self.client.get(self._evidence_key(user_id))
        persisted: list[dict] = []
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    persisted = [item for item in parsed if isinstance(item, dict)]
            except Exception:
                persisted = []

        by_id = {item["id"]: json.loads(json.dumps(item, ensure_ascii=False)) for item in DEFAULT_EVIDENCE}
        for item in persisted:
            item_id = item.get("id")
            if isinstance(item_id, str):
                by_id[item_id] = item
        return list(by_id.values())


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
