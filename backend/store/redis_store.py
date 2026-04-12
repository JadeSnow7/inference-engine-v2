import json
from typing import Optional

import redis.asyncio as redis

from config import settings
from profile.models import UserProfile


class RedisConversationStore:
    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)

    async def set(self, key: str, value: str, ttl: int = 86400):
        await self.client.set(key, value, ex=ttl)


class RedisProfileStore:
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

    async def set(self, user_id: str, profile: UserProfile):
        payload = profile.to_dict() if hasattr(profile, "to_dict") else dict(profile)
        await self.client.set(f"profile:{user_id}", json.dumps(payload, ensure_ascii=False))


class UserStore:
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
