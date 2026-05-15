import asyncio
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DEEPSEEK_API_KEY", "deepseek-test-key")


class FakeProvider:
    def __init__(self):
        self.calls = []

    async def complete_json(self, messages, strategy):
        self.calls.append(("json", strategy, messages))
        return {"summary": "诊断完成", "risk_level": "low"}

    async def revise_text(self, text, instruction, strategy):
        self.calls.append(("text", strategy, instruction))
        return f"{text}（已优化）"


class EditingPipelineTest(unittest.TestCase):
    def test_pipeline_runs_fixed_stages_and_returns_patch_gate_and_unresolved_citation(self):
        from editing.pipeline import EDITING_STAGE_IDS, EditingPipeline
        from editing.models import DocumentBlock, EditingJobCreate

        pipeline = EditingPipeline(provider=FakeProvider(), norm_retriever=None, rag=None)
        job = asyncio.run(pipeline.create_job(EditingJobCreate(
            blocks=[DocumentBlock(id="p1", type="paragraph", content="本文提出一个方法，但缺少引用。")],
            selected_block_ids=["p1"],
            mode="academic_enhance",
            objective="提升学术表达",
        )))
        events = asyncio.run(_collect_events(pipeline.run_job(job.job_id)))
        status = pipeline.get_job(job.job_id)

        self.assertEqual([stage.stage_id for stage in status.stages], EDITING_STAGE_IDS)
        self.assertTrue(all(stage.status == "completed" for stage in status.stages))
        self.assertEqual(status.patches[0].block_id, "p1")
        self.assertIn("已优化", status.patches[0].revised_text)
        self.assertEqual(status.gate_report.status, "pass")
        self.assertTrue(any(ref.status == "unresolved" for ref in status.references))
        self.assertIn("editing_patch", [event["type"] for event in events])
        self.assertIn("editing_gate", [event["type"] for event in events])

    def test_deepseek_adapter_uses_stage_strategy_parameters(self):
        from editing.deepseek import DeepSeekProvider, StageStrategy

        captured = {}

        class FakeCompletions:
            async def create(self, **kwargs):
                captured.update(kwargs)
                return SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content='{"ok":true}', reasoning_content="trace"))
                ])

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        provider = DeepSeekProvider(client_factory=lambda: FakeClient())
        result = asyncio.run(provider.complete_json(
            [{"role": "user", "content": "return json"}],
            StageStrategy(model="deepseek-v4-pro", thinking=True, reasoning_effort="high", temperature=None, json_output=True),
        ))

        self.assertEqual(result, {"ok": True})
        self.assertEqual(captured["model"], "deepseek-v4-pro")
        self.assertEqual(captured["reasoning_effort"], "high")
        self.assertEqual(captured["extra_body"], {"thinking": {"type": "enabled"}})
        self.assertEqual(captured["response_format"], {"type": "json_object"})
        self.assertNotIn("temperature", captured)

    def test_deepseek_adapter_defaults_to_dashscope_when_deepseek_key_missing(self):
        import editing.deepseek as deepseek_module
        from editing.deepseek import DeepSeekProvider, StageStrategy

        captured = {}

        class FakeCompletions:
            async def create(self, **kwargs):
                captured["request"] = kwargs
                return SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content='{"ok":true}', reasoning_content=""))
                ])

        class FakeAsyncOpenAI:
            def __init__(self, **kwargs):
                captured["client"] = kwargs
                self.chat = SimpleNamespace(completions=FakeCompletions())

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        fake_settings = SimpleNamespace(
            DEEPSEEK_API_KEY="",
            DEEPSEEK_BASE_URL="https://api.deepseek.com",
            DASHSCOPE_API_KEY="dashscope-key",
            DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )

        with (
            patch.object(deepseek_module, "settings", fake_settings),
            patch.object(deepseek_module, "AsyncOpenAI", FakeAsyncOpenAI),
        ):
            provider = DeepSeekProvider()
            result = asyncio.run(provider.complete_json(
                [{"role": "user", "content": "return json"}],
                StageStrategy(model="deepseek-v4-pro", thinking=False, json_output=True),
            ))

        self.assertEqual(result, {"ok": True})
        self.assertEqual(captured["client"]["api_key"], "dashscope-key")
        self.assertEqual(captured["client"]["base_url"], "https://dashscope.aliyuncs.com/compatible-mode/v1")
        self.assertEqual(captured["request"]["model"], "deepseek-v4-pro")

    def test_deepseek_adapter_maps_empty_json_to_retryable_error(self):
        from editing.deepseek import DeepSeekProvider, RetryableModelError, StageStrategy

        class FakeCompletions:
            async def create(self, **_kwargs):
                return SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content="", reasoning_content=""))
                ])

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        provider = DeepSeekProvider(client_factory=lambda: FakeClient())
        with self.assertRaises(RetryableModelError):
            asyncio.run(provider.complete_json(
                [{"role": "user", "content": "json"}],
                StageStrategy(model="deepseek-v4-pro", thinking=True, reasoning_effort="high", json_output=True),
            ))

    def test_revision_prompt_marks_text_as_already_provided(self):
        from editing.deepseek import DeepSeekProvider, StageStrategy

        captured = {}

        class FakeCompletions:
            async def create(self, **kwargs):
                captured.update(kwargs)
                return SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content="修订后正文", reasoning_content=""))
                ])

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        provider = DeepSeekProvider(client_factory=lambda: FakeClient())
        result = asyncio.run(provider.revise_text(
            "本文提出一个方法。",
            "请提升学术表达，只输出修订后正文。",
            StageStrategy(model="deepseek-v4-pro", thinking=False),
        ))

        self.assertEqual(result, "修订后正文")
        self.assertIn("不要要求用户再次提供原文", captured["messages"][0]["content"])
        self.assertIn("待修订正文", captured["messages"][1]["content"])
        self.assertIn("本文提出一个方法。", captured["messages"][1]["content"])


async def _collect_events(iterator):
    events = []
    async for raw in iterator:
        if raw.startswith("data: "):
            events.append(json.loads(raw.removeprefix("data: ").strip()))
    return events


if __name__ == "__main__":
    unittest.main()
