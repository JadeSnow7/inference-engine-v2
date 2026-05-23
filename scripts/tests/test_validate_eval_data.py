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

    def test_query_set_v2_validates_labels_refs_and_distribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            rq1_dir = tmp_path / "data" / "rq1_kg_quality"
            rq2_dir = tmp_path / "data" / "rq2_traceability"
            rq1_dir.mkdir(parents=True)
            rq2_dir.mkdir(parents=True)
            (rq1_dir / "kg_gold_nodes.json").write_text(json.dumps([
                {"node_id": "A", "node_type": "NormRule", "dimension": "citation_format", "text": "APA citation rule."},
                {"node_id": "B", "node_type": "NormRule", "dimension": "section_structure", "text": "Abstract order rule."},
            ]), encoding="utf-8")
            queries = []
            categories = [
                "citation_format",
                "section_structure",
                "paragraph_function",
                "argument_coherence",
                "evidence_integration",
                "academic_style",
            ]
            for category in categories:
                for idx in range(2):
                    queries.append({
                        "query_id": f"{category}-{idx}",
                        "text": " ".join(["Synthetic academic writing paragraph for evaluation."] * 20),
                        "category": category,
                        "difficulty": ["easy", "medium", "hard"][(idx + len(queries)) % 3],
                        "expected_issue_types": [f"{category}.issue"],
                        "expected_refs": ["A"],
                        "expected_ref_nodes": ["A"],
                        "ground_truth_issues": [f"{category}.issue"],
                        "has_known_issue": True,
                        "is_control": False,
                        "tags": [],
                    })
            queries.append({
                "query_id": "ambiguous-0",
                "text": " ".join(["Synthetic academic writing paragraph with borderline feedback evidence."] * 20),
                "category": "ambiguous_borderline",
                "difficulty": "hard",
                "expected_issue_types": ["evidence_integration.borderline"],
                "expected_refs": ["B"],
                "expected_ref_nodes": ["B"],
                "ground_truth_issues": ["evidence_integration.borderline"],
                "has_known_issue": True,
                "is_control": False,
                "tags": ["ambiguous"],
            })
            for idx in range(2):
                queries.append({
                    "query_id": f"control-{idx}",
                    "text": " ".join(["Synthetic academic writing control paragraph."] * 20),
                    "category": "no_issue_control",
                    "difficulty": "easy",
                    "expected_issue_types": [],
                    "expected_refs": [],
                    "expected_ref_nodes": [],
                    "ground_truth_issues": [],
                    "has_known_issue": False,
                    "is_control": True,
                    "tags": ["control"],
                })
            queries.append({
                "query_id": "adversarial-0",
                "text": " ".join(["Synthetic academic writing paragraph with bracketed math range not citation."] * 20),
                "category": "adversarial_control",
                "difficulty": "medium",
                "expected_issue_types": [],
                "expected_refs": [],
                "expected_ref_nodes": [],
                "ground_truth_issues": [],
                "has_known_issue": False,
                "is_control": True,
                "tags": ["control", "adversarial"],
            })
            (rq2_dir / "query_set_v2.json").write_text(json.dumps(queries), encoding="utf-8")

            issues = validate_eval_data.validate_query_set_v2(
                tmp_path,
                min_queries=len(queries),
                min_controls=2,
                min_category_coverage=2,
                word_min=20,
                word_max=300,
            )

            self.assertEqual(issues, [])

    def test_query_set_v2_rejects_unknown_expected_ref_and_missing_label(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            rq1_dir = tmp_path / "data" / "rq1_kg_quality"
            rq2_dir = tmp_path / "data" / "rq2_traceability"
            rq1_dir.mkdir(parents=True)
            rq2_dir.mkdir(parents=True)
            (rq1_dir / "kg_gold_nodes.json").write_text(json.dumps([
                {"node_id": "A", "node_type": "NormRule", "dimension": "citation_format", "text": "APA citation rule."},
            ]), encoding="utf-8")
            (rq2_dir / "query_set_v2.json").write_text(json.dumps([{
                "query_id": "Q001",
                "text": " ".join(["Synthetic academic writing paragraph."] * 30),
                "category": "citation_format",
                "difficulty": "easy",
                "expected_issue_types": [],
                "expected_refs": ["MISSING"],
                "expected_ref_nodes": ["MISSING"],
                "ground_truth_issues": [],
                "has_known_issue": True,
                "is_control": False,
                "tags": ["bad-label"],
            }]), encoding="utf-8")

            issues = validate_eval_data.validate_query_set_v2(
                tmp_path,
                min_queries=1,
                min_controls=0,
                min_category_coverage=0,
                word_min=20,
                word_max=300,
            )

            self.assertTrue(any("unknown expected_refs" in issue for issue in issues))
            self.assertTrue(any("has_known_issue=true but expected_issue_types is empty" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
