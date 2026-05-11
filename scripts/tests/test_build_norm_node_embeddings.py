import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = SCRIPTS_DIR / "build_norm_node_embeddings.py"
spec = importlib.util.spec_from_file_location("build_norm_node_embeddings", SCRIPT_PATH)
builder = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["build_norm_node_embeddings"] = builder
spec.loader.exec_module(builder)


class FakeEmbeddings:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            data=[
                SimpleNamespace(embedding=[1.0, 0.0]),
                SimpleNamespace(embedding=[0.0, 1.0]),
            ][: len(kwargs["input"])]
        )


class FakeOpenAI:
    def __init__(self, **kwargs):
        self.embeddings = FakeEmbeddings()


class BuildNormEmbeddingsTest(unittest.TestCase):
    def test_build_embeddings_writes_expected_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "norm_nodes.json"
            output = root / "norm_nodes_with_embeddings.json"
            source.write_text(json.dumps([
                {"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation source", "related": []},
                {"node_id": "B", "node_type": "修改建议", "dimension": "引用格式", "text": "add citation", "related": ["A"]},
            ], ensure_ascii=False), encoding="utf-8")

            with patch.object(builder, "OpenAI", FakeOpenAI):
                count, dim = builder.build_embeddings(source, output, api_key="test-key", batch_size=2, sleep_seconds=0)

            rows = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual((count, dim), (2, 2))
            self.assertEqual(rows[0]["embedding"], [1.0, 0.0])
            self.assertEqual(rows[1]["node_id"], "B")


if __name__ == "__main__":
    unittest.main()
