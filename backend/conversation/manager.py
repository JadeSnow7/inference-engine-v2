import json

from config import settings


class ConversationManager:
    def __init__(self, redis_client):
        self.redis_client = redis_client

    async def load(self, user_id: str) -> list[dict]:
        raw = await self.redis_client.get(f"hist:{user_id}")
        if not raw:
            return []
        try:
            return json.loads(raw)
        except Exception:
            return []

    async def save(self, user_id: str, user_msg: str, assistant_msg: str):
        hist = await self.load(user_id)
        hist.extend(
            [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg},
            ]
        )
        while self._estimate_tokens(hist) > settings.MAX_HISTORY_TOKENS and len(hist) >= 2:
            hist = hist[2:]
        await self.redis_client.set(f"hist:{user_id}", json.dumps(hist, ensure_ascii=False), ttl=86400)

    def _estimate_tokens(self, hist: list[dict]) -> int:
        return sum(len(m["content"]) // 2 for m in hist)

