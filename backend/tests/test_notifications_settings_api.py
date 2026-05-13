import asyncio
import json
import os
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.notifications import list_notifications, mark_notification_read
from api.settings import SettingsUpdateRequest, get_settings, update_settings
from store.redis_store import RedisNotificationStore, RedisSettingsStore


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value


def response_data(response):
    return json.loads(response.body)["data"]


def make_request():
    redis = FakeRedis()
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        notification_store=RedisNotificationStore(redis),
        settings_store=RedisSettingsStore(redis),
    )))


class NotificationsSettingsApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_lists_seeded_notifications_and_marks_one_read(self):
        request = make_request()

        list_response = self.run_async(list_notifications(request, user_id="alice@hust.edu.cn"))
        items = response_data(list_response)["items"]
        self.assertGreaterEqual(len(items), 1)
        unread = next(item for item in items if not item["read"])

        read_response = self.run_async(mark_notification_read(unread["id"], request, user_id="alice@hust.edu.cn"))
        self.assertTrue(response_data(read_response)["read"])

        refreshed = response_data(self.run_async(list_notifications(request, user_id="alice@hust.edu.cn")))["items"]
        self.assertTrue(next(item for item in refreshed if item["id"] == unread["id"])["read"])

    def test_gets_defaults_and_updates_workspace_settings(self):
        request = make_request()

        defaults = response_data(self.run_async(get_settings(request, user_id="alice@hust.edu.cn")))
        self.assertEqual(defaults["workspaceDensity"], "comfortable")
        self.assertTrue(defaults["autoSave"])

        updated = response_data(self.run_async(update_settings(
            SettingsUpdateRequest(workspaceDensity="compact", notificationsEnabled=False),
            request,
            user_id="alice@hust.edu.cn",
        )))

        self.assertEqual(updated["workspaceDensity"], "compact")
        self.assertFalse(updated["notificationsEnabled"])
        self.assertTrue(updated["autoSave"])


if __name__ == "__main__":
    unittest.main()
