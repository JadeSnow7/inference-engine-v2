import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "run_rq2_real.py"
spec = importlib.util.spec_from_file_location("run_rq2_real", SCRIPT_PATH)
real = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["run_rq2_real"] = real
spec.loader.exec_module(real)


class RunRQ2RealTest(unittest.TestCase):
    def test_method_config_declares_four_methods(self):
        self.assertEqual(sorted(real.METHOD_CONFIGS), ["ablation_no_expand", "baseline_a", "baseline_b", "full_graphrag"])
        self.assertFalse(real.METHOD_CONFIGS["baseline_a"]["retrieval"])
        self.assertTrue(real.METHOD_CONFIGS["full_graphrag"]["graph_expand"])
        self.assertTrue(real.METHOD_CONFIGS["full_graphrag"]["binding"])

    def test_parse_method_allows_single_method_selection(self):
        args = real.parse_args(["--method", "baseline_b", "--limit", "2"])

        self.assertEqual(args.method, "baseline_b")
        self.assertEqual(args.limit, 2)

    def test_dry_run_row_uses_real_system_dry_run_type(self):
        query = {"query_id": "Q001", "text": "sample", "expected_ref_nodes": ["A"]}
        row = real.build_dry_run_row(query, "full_graphrag", theta=0.6)

        self.assertEqual(row["run_type"], "real_system_dry_run")
        self.assertEqual(row["method"], "full_graphrag")
        self.assertEqual(row["theta_used"], 0.6)
        self.assertEqual(row["generated_refs"], [])

    def test_build_real_no_llm_row_uses_method_config(self):
        query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}

        class FakeRAG:
            def retrieve(self, text, *, top_k, graph_expand):
                self.called = {"text": text, "top_k": top_k, "graph_expand": graph_expand}
                return [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation evidence", "score": 0.8}]

        rag = FakeRAG()

        row = real.build_real_row(query, "full_graphrag", rag, theta=0.6, with_llm=False)

        self.assertEqual(rag.called["graph_expand"], True)
        self.assertEqual(row["run_type"], "real_system")
        self.assertEqual(row["generated_refs"], ["A"])
        self.assertTrue(row["validation_results"]["A"]["pass"])


if __name__ == "__main__":
    unittest.main()
