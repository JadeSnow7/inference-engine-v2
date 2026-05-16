import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


class SettingsCompatibilityTest(unittest.TestCase):
    def test_jwt_secret_falls_back_to_secret_key(self) -> None:
        from config import Settings

        env = {
            "DASHSCOPE_API_KEY": "test-key",
            "JWT_SECRET": "jwt-secret",
        }

        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.SECRET_KEY, "jwt-secret")

    def test_modelscope_local_path_wins_over_remote_embed_model(self) -> None:
        from config import Settings

        with tempfile.TemporaryDirectory() as tmp:
            model_path = Path(tmp) / "BAAI" / "bge-small-zh-v1.5"
            model_path.mkdir(parents=True)
            env = {
                "DASHSCOPE_API_KEY": "test-key",
                "JWT_SECRET": "jwt-secret",
                "EMBED_MODEL": "BAAI/bge-small-zh-v1.5",
                "MODELSCOPE_EMBED_MODEL_PATH": str(model_path),
            }

            with patch.dict(os.environ, env, clear=True):
                settings = Settings()

            self.assertEqual(settings.local_embed_model_path, str(model_path))

    def test_missing_modelscope_path_does_not_resolve_remote_embed_model(self) -> None:
        from config import Settings

        env = {
            "DASHSCOPE_API_KEY": "test-key",
            "JWT_SECRET": "jwt-secret",
            "EMBED_MODEL": "BAAI/bge-small-zh-v1.5",
            "MODELSCOPE_EMBED_MODEL_PATH": "/tmp/definitely-missing-modelscope-bge",
        }

        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.local_embed_model_path, "")

    def test_ai_provider_preference_defaults_to_bailian_first(self) -> None:
        from config import Settings

        env = {
            "DASHSCOPE_API_KEY": "test-key",
            "JWT_SECRET": "jwt-secret",
        }

        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.AI_PROVIDER_PREFERENCE, "bailian_first")

    def test_editing_model_is_configured_by_dashscope_key(self) -> None:
        from config import Settings

        env = {
            "DASHSCOPE_API_KEY": "dashscope-key",
            "JWT_SECRET": "jwt-secret",
            "DASHSCOPE_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "MODEL_NAME": "deepseek-v4-pro",
        }

        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertTrue(settings.editing_model_configured)

    def test_local_rag_startup_uses_modelscope_path_once(self) -> None:
        os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
        os.environ.setdefault("SECRET_KEY", "test-secret")
        import main

        class FakeSentenceTransformer:
            model_names: list[str] = []

            def __init__(self, model_name: str):
                self.model_names.append(model_name)

            def encode(self, texts, normalize_embeddings: bool = True):
                single = isinstance(texts, str)
                if isinstance(texts, str):
                    texts = [texts]
                vectors = [[0.1, 0.2, 0.3, 0.4] for _ in texts]
                return vectors[0] if single else vectors

        fake_module = SimpleNamespace(SentenceTransformer=FakeSentenceTransformer)
        original_module = sys.modules.get("sentence_transformers")
        sys.modules["sentence_transformers"] = fake_module

        with tempfile.TemporaryDirectory() as tmp:
            model_path = Path(tmp) / "modelscope" / "BAAI" / "bge-small-zh-v1.5"
            model_path.mkdir(parents=True)
            graph_path = Path(tmp) / "knowledge_graph.gpickle"
            fake_settings = SimpleNamespace(
                local_embed_model_path=str(model_path),
                GRAPH_PERSIST_PATH=str(graph_path),
            )

            try:
                with patch.object(main, "settings", fake_settings):
                    embedder, kg, rag = main.build_local_rag()
            finally:
                if original_module is None:
                    sys.modules.pop("sentence_transformers", None)
                else:
                    sys.modules["sentence_transformers"] = original_module

        self.assertIsNotNone(embedder)
        self.assertIsNotNone(kg)
        self.assertEqual(rag.health()["provider"], "local-graphrag")
        self.assertEqual(FakeSentenceTransformer.model_names, [str(model_path)])


if __name__ == "__main__":
    unittest.main()
