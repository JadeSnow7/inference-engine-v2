import os
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class HealthApiTest(unittest.TestCase):
    def test_config_status_exposes_active_bailian_first_provider(self) -> None:
        import api.health as health_module

        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(rag=SimpleNamespace(health=lambda: {"provider": "disabled", "configured": False}))
            )
        )

        fake_settings = SimpleNamespace(
            AI_PROVIDER_PREFERENCE="bailian_first",
            DASHSCOPE_API_KEY="test-key",
            MODEL_NAME="qwen-plus",
            ENABLE_BAILIAN_APP=True,
            DASHSCOPE_APP_ID="app-id",
            ENABLE_LOCAL_RAG=False,
            active_ai_provider="bailian_app",
        )

        with patch.object(health_module, "settings", fake_settings):
            response = asyncio.run(health_module.config_status(request))

        payload = json.loads(response.body)["data"]
        self.assertEqual(payload["active_provider"], "bailian_app")
        self.assertEqual(payload["provider_preference"], "bailian_first")
        self.assertEqual(payload["llm"]["model"], "qwen-plus")
        self.assertEqual(payload["bailian_app"]["configured"], True)


if __name__ == "__main__":
    unittest.main()
