import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "validate_eval_data.py"
spec = importlib.util.spec_from_file_location("validate_eval_data", SCRIPT_PATH)
validate_eval_data = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["validate_eval_data"] = validate_eval_data
spec.loader.exec_module(validate_eval_data)


class ValidateEvalDataTest(unittest.TestCase):
    def test_detects_common_pii_patterns(self):
        text = "Contact alice@example.com or student 2023123456 before review."

        matches = validate_eval_data.find_pii(text)

        self.assertTrue(any(match.kind == "email" for match in matches))
        self.assertTrue(any(match.kind == "student_id" for match in matches))

    def test_validates_minimal_query_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data" / "rq2_traceability"
            data_dir.mkdir(parents=True)
            long_text = " ".join(["This synthetic paragraph discusses academic writing structure."] * 25)
            queries = [
                {
                    "query_id": "Q001",
                    "text": long_text,
                    "ground_truth_issues": ["引用格式-APA"],
                    "expected_ref_nodes": ["NRM-APA-001"],
                    "has_known_issue": True,
                }
            ]
            (data_dir / "query_set.json").write_text(json.dumps(queries), encoding="utf-8")

            issues = validate_eval_data.validate_query_set(
                tmp_path,
                min_queries=1,
                min_controls=0,
                min_dimension_coverage=0,
                word_min=20,
                word_max=300,
            )

            self.assertEqual(issues, [])

    def test_reports_missing_required_field(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data" / "rq2_traceability"
            data_dir.mkdir(parents=True)
            queries = [
                {
                    "query_id": "Q001",
                    "text": " ".join(["Synthetic text."] * 80),
                    "ground_truth_issues": ["引用格式-APA"],
                    "has_known_issue": True,
                }
            ]
            (data_dir / "query_set.json").write_text(json.dumps(queries), encoding="utf-8")

            issues = validate_eval_data.validate_query_set(
                tmp_path,
                min_queries=1,
                min_controls=0,
                min_dimension_coverage=0,
                word_min=20,
                word_max=300,
            )

            self.assertTrue(any("expected_ref_nodes" in issue for issue in issues))

    def test_reads_jsonl_line_by_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            jsonl_path = Path(tmp) / "sample.jsonl"
            jsonl_path.write_text('{"query_id":"Q001"}\n\n{"query_id":"Q002"}\n', encoding="utf-8")

            rows = validate_eval_data.read_jsonl(jsonl_path)

            self.assertEqual([row["query_id"] for row in rows], ["Q001", "Q002"])

    def test_full_gate_reports_bad_theta_sweep(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data" / "rq2_traceability"
            outputs_dir = data_dir / "system_outputs"
            outputs_dir.mkdir(parents=True)
            query = {
                "query_id": "Q001",
                "text": " ".join(["This synthetic paragraph discusses academic writing structure."] * 25),
                "ground_truth_issues": ["引用格式-APA"],
                "expected_ref_nodes": ["NRM-APA-001"],
                "has_known_issue": True,
            }
            (data_dir / "query_set.json").write_text(json.dumps([query]), encoding="utf-8")
            row = {
                "method": "full_graphrag",
                "query_id": "Q001",
                "retrieved_nodes": [],
                "generated_refs": [],
                "validation_results": {},
                "feedback_structure_complete": True,
            }
            for method, filename in validate_eval_data.TRACEABILITY_METHOD_FILES.items():
                method_row = dict(row)
                method_row["method"] = method
                (outputs_dir / filename).write_text(json.dumps(method_row) + "\n", encoding="utf-8")
            (data_dir / "theta_sweep.jsonl").write_text(
                json.dumps({"query_id": "Q001", "theta_sweep": [{"theta": 0.6}], "downgrade_trigger_count": 0}) + "\n",
                encoding="utf-8",
            )

            query_issues = validate_eval_data.validate_query_set(
                tmp_path,
                min_queries=1,
                min_controls=0,
                min_dimension_coverage=0,
                word_min=20,
                word_max=300,
            )
            self.assertEqual(query_issues, [])
            issues = validate_eval_data.validate_theta_sweep(tmp_path, {"Q001"})

            self.assertTrue(any("theta values" in issue for issue in issues))

    def test_validates_pending_kg_node_counts_template(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data" / "rq1_kg_quality"
            data_dir.mkdir(parents=True)
            (data_dir / "kg_node_counts.csv").write_text(
                "\n".join([
                    "node_type,count,audit_status,notes",
                    "规范条款,0,pending,Replace count after manual audit.",
                    "示例片段,0,pending,Replace count after manual audit.",
                    "违例模式,0,pending,Replace count after manual audit.",
                    "修改建议,0,pending,Replace count after manual audit.",
                    "评价维度,0,pending,Replace count after manual audit.",
                ]) + "\n",
                encoding="utf-8",
            )

            issues = validate_eval_data.validate_kg_node_counts(tmp_path, require_completed=False)

            self.assertEqual(issues, [])


if __name__ == "__main__":
    unittest.main()
