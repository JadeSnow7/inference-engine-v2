import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "summarize_rq2_results.py"
spec = importlib.util.spec_from_file_location("summarize_rq2_results", SCRIPT_PATH)
summary = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["summarize_rq2_results"] = summary
spec.loader.exec_module(summary)


class SummarizeRQ2ResultsTest(unittest.TestCase):
    def test_summarizes_method_metrics(self):
        rows = [
            {
                "query_id": "Q001",
                "retrieved_nodes": [{"node_id": "A"}],
                "generated_refs": ["A"],
                "validation_results": {"A": {"exists": True, "cosine": 0.72, "pass": True}},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
            },
            {
                "query_id": "Q002",
                "retrieved_nodes": [],
                "generated_refs": [],
                "validation_results": {},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
            },
        ]
        queries = {
            "Q001": {"expected_ref_nodes": ["A"], "has_known_issue": True},
            "Q002": {"expected_ref_nodes": [], "has_known_issue": False},
        }

        result = summary.summarize_method("full_graphrag", rows, queries)

        self.assertEqual(result["method"], "full_graphrag")
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["avg_retrieved_nodes"], 0.5)
        self.assertEqual(result["avg_generated_refs"], 0.5)
        self.assertEqual(result["node_exist_rate"], 1.0)
        self.assertEqual(result["threshold_pass_rate"], 1.0)
        self.assertEqual(result["generated_expected_coverage"], 1.0)


if __name__ == "__main__":
    unittest.main()
