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

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)
        self.ttl.pop(key, None)


class ConversationManagerTest(unittest.IsolatedAsyncioTestCase):
    async def test_load_returns_empty_list_on_bad_json(self) -> None:
        store = FakeRedisStore()
        store.values["hist:u1:s1"] = "{bad json"
        manager = ConversationManager(store)

        self.assertEqual(await manager.load("u1", "s1"), [])

    async def test_save_rolls_history_by_message_pairs(self) -> None:
        store = FakeRedisStore()
        store.values["hist:u2:s2"] = json.dumps(
            [
                {"role": "user", "content": "甲" * 12000},
                {"role": "assistant", "content": "乙" * 12000},
            ],
            ensure_ascii=False,
        )
        manager = ConversationManager(store)
        await manager.ensure_session("u2", "s2", "旧标题")

        await manager.save("u2", "s2", "新问题", "新回答", "paragraph")

        saved = json.loads(store.values["hist:u2:s2"])
        self.assertEqual(saved, [{"role": "user", "content": "新问题"}, {"role": "assistant", "content": "新回答"}])
        self.assertEqual(store.ttl["hist:u2:s2"], 86400)

    async def test_ensure_session_creates_metadata_and_list_sessions_sorted(self) -> None:
        store = FakeRedisStore()
        manager = ConversationManager(store)

        session_a = await manager.ensure_session("u3", None, "第一条消息")
        await manager.save("u3", session_a, "第一条消息", "第一条回答", "review")
        session_b = await manager.ensure_session("u3", None, "第二条消息")
        await manager.save("u3", session_b, "第二条消息", "第二条回答", "proposal")

        listing = await manager.list_sessions("u3", limit=20, offset=0)

        self.assertEqual(listing["total"], 2)
        self.assertEqual(listing["items"][0]["session_id"], session_b)
        self.assertEqual(listing["items"][0]["scene"], "proposal")
        self.assertEqual(listing["items"][1]["title"], "第一条消息")

    async def test_delete_session_removes_history_and_index(self) -> None:
        store = FakeRedisStore()
        manager = ConversationManager(store)

        session_id = await manager.ensure_session("u4", None, "要删除的会话")
        await manager.save("u4", session_id, "要删除的会话", "回答", "format")

        deleted = await manager.delete_session("u4", session_id)
        listing = await manager.list_sessions("u4", limit=20, offset=0)

        self.assertTrue(deleted)
        self.assertEqual(listing, {"total": 0, "items": []})
        self.assertNotIn(f"hist:u4:{session_id}", store.values)
