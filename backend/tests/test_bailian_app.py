import os
import unittest
from types import SimpleNamespace

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core import bailian_app


class BailianAppAdapterTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_enabled = bailian_app.settings.ENABLE_BAILIAN_APP
        self.original_app_id = bailian_app.settings.DASHSCOPE_APP_ID
        self.original_api_key = bailian_app.settings.DASHSCOPE_API_KEY

    def tearDown(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = self.original_enabled
        bailian_app.settings.DASHSCOPE_APP_ID = self.original_app_id
        bailian_app.settings.DASHSCOPE_API_KEY = self.original_api_key

    def test_require_configured_rejects_disabled_app(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = False
        bailian_app.settings.DASHSCOPE_APP_ID = "app-id"
        bailian_app.settings.DASHSCOPE_API_KEY = "api-key"

        with self.assertRaisesRegex(bailian_app.BailianAppError, "未启用"):
            bailian_app._require_configured()

    def test_require_configured_rejects_missing_app_id(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = True
        bailian_app.settings.DASHSCOPE_APP_ID = ""
        bailian_app.settings.DASHSCOPE_API_KEY = "api-key"

        with self.assertRaisesRegex(bailian_app.BailianAppError, "DASHSCOPE_APP_ID"):
            bailian_app._require_configured()

    def test_require_configured_rejects_missing_api_key(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = True
        bailian_app.settings.DASHSCOPE_APP_ID = "app-id"
        bailian_app.settings.DASHSCOPE_API_KEY = ""

        with self.assertRaisesRegex(bailian_app.BailianAppError, "DASHSCOPE_API_KEY"):
            bailian_app._require_configured()

    def test_sanitize_references_strips_sensitive_urls_recursively(self) -> None:
        references = [
            {
                "title": "Norm file",
                "fileUrl": "https://signed.example/file",
                "metadata": {
                    "downloadUrl": "https://signed.example/download",
                    "safe": "kept",
                    "nested": [{"signedUrl": "https://signed.example/nested", "name": "node"}],
                },
            }
        ]

        sanitized = bailian_app._sanitize_references(references)

        self.assertEqual(sanitized, [{"title": "Norm file", "metadata": {"safe": "kept", "nested": [{"name": "node"}]}}])

    async def test_call_bailian_app_once_parses_text_session_and_references(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = True
        bailian_app.settings.DASHSCOPE_APP_ID = "app-id"
        bailian_app.settings.DASHSCOPE_API_KEY = "api-key"

        class FakeApplication:
            calls = []

            @staticmethod
            def call(**kwargs):
                FakeApplication.calls.append(kwargs)
                return SimpleNamespace(
                    status_code=200,
                    request_id="req-1",
                    output={
                        "text": "反馈文本",
                        "session_id": "app-session-1",
                        "doc_references": [{"title": "规范", "fileUrl": "https://signed.example/file"}],
                    },
                )

        original_loader = bailian_app._load_application
        bailian_app._load_application = lambda: FakeApplication
        try:
            chunk = await bailian_app.call_bailian_app_once("prompt", session_id="old-session")
        finally:
            bailian_app._load_application = original_loader

        self.assertEqual(chunk.text, "反馈文本")
        self.assertEqual(chunk.session_id, "app-session-1")
        self.assertEqual(chunk.references, [{"title": "规范"}])
        self.assertEqual(FakeApplication.calls[0]["api_key"], "api-key")
        self.assertEqual(FakeApplication.calls[0]["app_id"], "app-id")
        self.assertEqual(FakeApplication.calls[0]["prompt"], "prompt")
        self.assertEqual(FakeApplication.calls[0]["session_id"], "old-session")

    async def test_stream_bailian_app_yields_incremental_chunks(self) -> None:
        bailian_app.settings.ENABLE_BAILIAN_APP = True
        bailian_app.settings.DASHSCOPE_APP_ID = "app-id"
        bailian_app.settings.DASHSCOPE_API_KEY = "api-key"

        class FakeApplication:
            @staticmethod
            def call(**_kwargs):
                return [
                    SimpleNamespace(status_code=200, request_id="req-1", output={"text": "第一", "session_id": "s1"}),
                    SimpleNamespace(status_code=200, request_id="req-2", output={"text": "第二", "session_id": "s1"}),
                ]

        original_loader = bailian_app._load_application
        bailian_app._load_application = lambda: FakeApplication
        try:
            chunks = [chunk async for chunk in bailian_app.stream_bailian_app("prompt")]
        finally:
            bailian_app._load_application = original_loader

        self.assertEqual([chunk.text for chunk in chunks], ["第一", "第二"])
        self.assertEqual([chunk.session_id for chunk in chunks], ["s1", "s1"])


if __name__ == "__main__":
    unittest.main()
