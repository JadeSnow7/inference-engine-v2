import json
import tempfile
import unittest
from pathlib import Path


class ProRagControlExperimentTest(unittest.TestCase):
    def test_select_samples_uses_existing_twenty_without_claiming_sixty_draw(self):
        from scripts.pro_rag_control_experiment import load_selected_samples

        root = Path(__file__).resolve().parents[2]
        samples, note = load_selected_samples(root)

        self.assertEqual(len(samples), 20)
        self.assertIn("existing 20", note)
        self.assertEqual(samples[0]["sample_id"], "Q001")
        self.assertIn("selection_hash", samples[0])
        self.assertEqual(samples[0]["source_dataset"], "data/rq2_traceability/query_set.json")

    def test_run_experiment_writes_required_files_and_group_counts(self):
        from scripts.pro_rag_control_experiment import run_experiment

        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            package_dir = Path(tmp) / "pro_rag_control_experiment"
            summary = run_experiment(root=root, output_dir=package_dir, live_g4=False)

            self.assertEqual(summary["sample_count"], 20)
            self.assertEqual(summary["group_counts"], {"G1": 20, "G2": 20, "G3": 20, "G4": 20})
            self.assertFalse(summary["jxfz_confirmed"])
            self.assertTrue((package_dir / "00_readme.md").exists())
            self.assertTrue((package_dir / "01_config" / "model_config.json").exists())
            self.assertTrue((package_dir / "04_metrics" / "metrics_summary.json").exists())
            self.assertTrue((package_dir / "07_paper_tables" / "table_d13_risk_boundary.csv").exists())

    def test_g1_has_no_retriever_and_flags_reference_markers_as_hallucinated(self):
        from scripts.pro_rag_control_experiment import build_group_record

        sample = {
            "sample_id": "S1",
            "text": "A paragraph without evidence.",
            "sample_type": "引用格式",
            "expected_refs": ["NRM-APA-001"],
            "is_control": False,
            "source_dataset": "x",
            "selection_hash": "h",
        }
        record = build_group_record(sample, "G1", output_text="Advice [REF:NRM-APA-001]", references=[])

        self.assertEqual(record["rag_mode"], "none")
        self.assertEqual(record["retriever_impl"], "none")
        self.assertEqual(record["metrics"]["hallucinated_reference_rate"], 1.0)
        self.assertEqual(record["model_claim_level"], "declared_only")

    def test_g2_metrics_count_grounded_expected_refs(self):
        from scripts.pro_rag_control_experiment import compute_reference_metrics

        metrics = compute_reference_metrics(
            expected_refs=["NRM-APA-001", "NRM-APA-002"],
            references=[
                {"id": "NRM-APA-001", "status": "resolved"},
                {"id": "NRM-OTHER-001", "status": "resolved"},
            ],
            output_text="[REF:NRM-APA-001] [REF:NRM-OTHER-001]",
        )

        self.assertEqual(metrics["expected_reference_recall"], 0.5)
        self.assertEqual(metrics["grounded_reference_precision"], 0.5)
        self.assertEqual(metrics["hallucinated_reference_rate"], 0.5)
        self.assertEqual(metrics["reference_event_rate"], 1.0)

    def test_no_secret_scan_redacts_signed_urls_and_tokens(self):
        from scripts.pro_rag_control_experiment import sanitize_sensitive, scan_for_secrets

        value = {
            "fileUrl": "https://example.com/doc?Expires=1&Signature=abc",
            "Authorization": "Bearer secret",
            "title": "safe",
        }
        sanitized = sanitize_sensitive(value)
        findings = scan_for_secrets(json.dumps(sanitized, ensure_ascii=False))

        self.assertEqual(sanitized, {"title": "safe"})
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
