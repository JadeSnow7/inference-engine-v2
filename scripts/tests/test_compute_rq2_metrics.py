import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "compute_rq2_metrics.py"
spec = importlib.util.spec_from_file_location("compute_rq2_metrics", SCRIPT_PATH)
metrics = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["compute_rq2_metrics"] = metrics
spec.loader.exec_module(metrics)


class ComputeRQ2MetricsTest(unittest.TestCase):
    def test_summarizes_grounding_and_control_metrics(self):
        queries = {
            "Q001": {
                "query_id": "Q001",
                "expected_refs": ["A", "B"],
                "expected_issue_types": ["citation.apa"],
                "has_known_issue": True,
                "is_control": False,
            },
            "Q002": {
                "query_id": "Q002",
                "expected_refs": [],
                "expected_issue_types": [],
                "has_known_issue": False,
                "is_control": True,
            },
        }
        rows = [
            {
                "method": "full_graphrag",
                "run_type": "real",
                "query_id": "Q001",
                "retrieved_nodes": [{"node_id": "A"}, {"node_id": "C"}],
                "generated_refs": ["A", "MISSING"],
                "validation_results": {
                    "A": {"exists": True, "cosine": 0.81, "pass": True},
                    "MISSING": {"exists": False, "cosine": 0.0, "pass": False},
                },
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
                "raw_feedback": "评价维度：引用格式\n问题定位：citation issue\n规范依据：[REF:A] [REF:MISSING]\n修改建议：revise.",
                "latency_ms": 100,
                "token_usage": {"total_tokens": 42},
            },
            {
                "method": "full_graphrag",
                "run_type": "real",
                "query_id": "Q002",
                "retrieved_nodes": [],
                "generated_refs": [],
                "validation_results": {},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
                "raw_feedback": "No corrective issue found.",
                "latency_ms": 200,
                "token_usage": {"total_tokens": 10},
            },
        ]

        result = metrics.summarize_method("full_graphrag", rows, queries)

        self.assertEqual(result["method"], "full_graphrag")
        self.assertEqual(result["expected_ref_recall"], 0.5)
        self.assertEqual(result["retrieved_node_coverage"], 1.0)
        self.assertEqual(result["irrelevant_node_rate"], 0.5)
        self.assertEqual(result["grounded_ref_precision"], 0.5)
        self.assertEqual(result["hallucinated_ref_rate"], 0.5)
        self.assertEqual(result["generated_ref_existence_rate"], 0.5)
        self.assertEqual(result["generated_ref_validity_rate"], 0.5)
        self.assertEqual(result["control_false_alarm_rate"], 0.0)
        self.assertEqual(result["p50_latency_ms"], 150.0)
        self.assertEqual(result["p95_latency_ms"], 195.0)
        self.assertEqual(result["total_tokens"], 52)

    def test_rejects_offline_stub_before_summary(self):
        row = {
            "method": "full_graphrag",
            "run_type": "offline_stub",
            "query_id": "Q001",
            "retrieved_nodes": [],
            "generated_refs": [],
            "validation_results": {},
            "low_confidence_refs": [],
            "feedback_structure_complete": True,
        }

        with self.assertRaisesRegex(ValueError, "run_type"):
            metrics.validate_rows_for_paper_results("full_graphrag", [row])

    def test_writes_metrics_markdown_and_tex_tables(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_dir = root / "data" / "rq2_traceability"
            outputs_dir = data_dir / "system_outputs"
            outputs_dir.mkdir(parents=True)
            query = {
                "query_id": "Q001",
                "text": "Synthetic writing text.",
                "expected_refs": ["A"],
                "expected_ref_nodes": ["A"],
                "expected_issue_types": ["citation.apa"],
                "ground_truth_issues": ["citation.apa"],
                "has_known_issue": True,
                "is_control": False,
                "category": "citation_format",
                "difficulty": "easy",
                "tags": [],
            }
            (data_dir / "query_set_v2.json").write_text(json.dumps([query]), encoding="utf-8")
            (data_dir / "run_manifest.json").write_text(json.dumps({
                "run_id": "run-test",
                "run_type": "real",
                "query_set_hash": "abc",
                "theta_values": [0.5, 0.55, 0.6, 0.65, 0.7],
                "offline_stub_allowed": False,
            }), encoding="utf-8")
            row = {
                "method": "full_graphrag",
                "run_type": "real",
                "query_id": "Q001",
                "retrieved_nodes": [{"node_id": "A"}],
                "generated_refs": ["A"],
                "validation_results": {"A": {"exists": True, "cosine": 0.8, "pass": True}},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
                "raw_feedback": "评价维度：引用格式\n问题定位：x\n规范依据：[REF:A]\n修改建议：y",
            }
            for method in metrics.METHODS:
                method_row = dict(row)
                method_row["method"] = method
                (outputs_dir / f"{method}.jsonl").write_text(json.dumps(method_row) + "\n", encoding="utf-8")

            report = metrics.compute_and_write(root)

            self.assertEqual(report["run_manifest"]["run_id"], "run-test")
            self.assertTrue((root / "outputs" / "rq2_metrics.json").exists())
            self.assertTrue((root / "outputs" / "rq2_metrics.md").exists())
            self.assertTrue((root / "paper_tables" / "rq2_main_results.tex").exists())


if __name__ == "__main__":
    unittest.main()
