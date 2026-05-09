import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "rq2_real_backend.py"
spec = importlib.util.spec_from_file_location("rq2_real_backend", SCRIPT_PATH)
backend = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["rq2_real_backend"] = backend
spec.loader.exec_module(backend)


class RQ2RealBackendTest(unittest.TestCase):
    def test_retrieve_respects_graph_expansion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_dir = root / "data" / "rq2_traceability"
            data_dir.mkdir(parents=True)
            (data_dir / "norm_nodes.json").write_text(json.dumps([
                {"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation source evidence", "related": ["B"]},
                {"node_id": "B", "node_type": "修改建议", "dimension": "引用格式", "text": "claim traceability", "related": []},
                {"node_id": "C", "node_type": "规范条款", "dimension": "章节结构", "text": "abstract order", "related": []},
            ]), encoding="utf-8")
            graphrag = backend.NormGraphRAG.from_root(root)

            no_expand = graphrag.retrieve("citation evidence", top_k=1, graph_expand=False)
            expanded = graphrag.retrieve("citation evidence", top_k=1, graph_expand=True)

            self.assertEqual([node["node_id"] for node in no_expand], ["A"])
            self.assertEqual([node["node_id"] for node in expanded], ["A", "B"])

    def test_build_retrieval_row_with_binding(self):
        node = {"node_id": "A", "score": 0.75}
        row = backend.build_retrieval_row(
            query={"query_id": "Q001", "expected_ref_nodes": ["A"]},
            method="full_graphrag",
            retrieved_nodes=[node],
            generated_text="Feedback [REF:A]",
            theta=0.6,
            binding=True,
        )

        self.assertEqual(row["generated_refs"], ["A"])
        self.assertTrue(row["validation_results"]["A"]["pass"])
        self.assertEqual(row["run_type"], "real_system")


if __name__ == "__main__":
    unittest.main()
