import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "run_rq2_offline.py"
spec = importlib.util.spec_from_file_location("run_rq2_offline", SCRIPT_PATH)
runner = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["run_rq2_offline"] = runner
spec.loader.exec_module(runner)


class RQ2OfflineRunnerTest(unittest.TestCase):
    def test_build_method_output_contains_required_schema(self):
        query = {
            "query_id": "Q001",
            "ground_truth_issues": ["引用格式-APA"],
            "expected_ref_nodes": ["NRM-APA-001", "NRM-APA-002"],
            "has_known_issue": True,
        }

        row = runner.build_method_output(query, "full_graphrag", theta=0.6)

        self.assertEqual(row["method"], "full_graphrag")
        self.assertEqual(row["query_id"], "Q001")
        self.assertEqual(row["run_type"], "offline_stub")
        self.assertTrue(row["feedback_structure_complete"])
        self.assertEqual(row["theta_used"], 0.6)
        self.assertIn("generated_refs", row)
        self.assertIn("validation_results", row)
        self.assertIn("retrieved_nodes", row)

    def test_write_outputs_creates_one_row_per_query_per_method(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_dir = root / "data" / "rq2_traceability"
            outputs_dir = data_dir / "system_outputs"
            outputs_dir.mkdir(parents=True)
            (data_dir / "query_set.json").write_text(json.dumps([
                {
                    "query_id": "Q001",
                    "text": "Synthetic text.",
                    "ground_truth_issues": ["引用格式-APA"],
                    "expected_ref_nodes": ["NRM-APA-001"],
                    "has_known_issue": True,
                },
                {
                    "query_id": "Q002",
                    "text": "Synthetic control text.",
                    "ground_truth_issues": [],
                    "expected_ref_nodes": [],
                    "has_known_issue": False,
                },
            ]), encoding="utf-8")

            runner.write_outputs(root, theta=0.6)

            full_rows = [
                json.loads(line)
                for line in (outputs_dir / "full_graphrag.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            baseline_rows = [
                json.loads(line)
                for line in (outputs_dir / "baseline_a.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            self.assertEqual(len(full_rows), 2)
            self.assertEqual(len(baseline_rows), 2)
            self.assertEqual(full_rows[0]["generated_refs"], ["NRM-APA-001"])
            self.assertEqual(baseline_rows[0]["generated_refs"], [])


if __name__ == "__main__":
    unittest.main()
