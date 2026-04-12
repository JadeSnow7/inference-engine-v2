import json
import os
import unittest
from typing import Optional

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from conversation.manager import ConversationManager


class FakeRedisStore:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.ttl: dict[str, int] = {}

    async def get(self, key: str) -> Optional[str]:
        return self.values.get(key)

    async def set(self, key: str, value: str, ttl: int = 86400) -> None:
        self.values[key] = value
        self.ttl[key] = ttl


class ConversationManagerTest(unittest.IsolatedAsyncioTestCase):
    async def test_load_returns_empty_list_on_bad_json(self) -> None:
        store = FakeRedisStore()
        store.values["hist:u1"] = "{bad json"
        manager = ConversationManager(store)

        self.assertEqual(await manager.load("u1"), [])

    async def test_save_rolls_history_by_message_pairs(self) -> None:
        store = FakeRedisStore()
        store.values["hist:u2"] = json.dumps(
            [
                {"role": "user", "content": "甲" * 12000},
                {"role": "assistant", "content": "乙" * 12000},
            ],
            ensure_ascii=False,
        )
        manager = ConversationManager(store)

        await manager.save("u2", "新问题", "新回答")

        saved = json.loads(store.values["hist:u2"])
        self.assertEqual(saved, [{"role": "user", "content": "新问题"}, {"role": "assistant", "content": "新回答"}])
        self.assertEqual(store.ttl["hist:u2"], 86400)
