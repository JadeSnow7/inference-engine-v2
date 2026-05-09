import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "rq2_traceability_lib.py"
spec = importlib.util.spec_from_file_location("rq2_traceability_lib", SCRIPT_PATH)
rq2 = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["rq2_traceability_lib"] = rq2
spec.loader.exec_module(rq2)


class RQ2TraceabilityLibTest(unittest.TestCase):
    def test_extract_refs_preserves_first_seen_order_and_deduplicates(self):
        text = "Fix citation [REF:NRM-APA-001], then structure [REF:STR-ABS-001] and again [REF:NRM-APA-001]."

        refs = rq2.extract_refs(text)

        self.assertEqual(refs, ["NRM-APA-001", "STR-ABS-001"])

    def test_validate_refs_marks_existence_and_threshold(self):
        node_scores = {"NRM-APA-001": 0.78, "STR-ABS-001": 0.55}

        results = rq2.validate_refs(["NRM-APA-001", "STR-ABS-001", "MISSING-001"], node_scores, theta=0.6)

        self.assertEqual(results["NRM-APA-001"], {"exists": True, "cosine": 0.78, "pass": True})
        self.assertEqual(results["STR-ABS-001"], {"exists": True, "cosine": 0.55, "pass": False})
        self.assertEqual(results["MISSING-001"], {"exists": False, "cosine": 0.0, "pass": False})

    def test_theta_sweep_recalculates_pass_rate_without_changing_existence(self):
        validation_results = {
            "A": {"exists": True, "cosine": 0.72, "pass": True},
            "B": {"exists": True, "cosine": 0.58, "pass": False},
            "C": {"exists": False, "cosine": 0.0, "pass": False},
        }

        sweep = rq2.build_theta_sweep(validation_results, theta_values=[0.5, 0.6, 0.7])

        self.assertEqual(sweep[0], {"theta": 0.5, "pass_rate": 2 / 3, "node_exist_rate": 2 / 3})
        self.assertEqual(sweep[1], {"theta": 0.6, "pass_rate": 1 / 3, "node_exist_rate": 2 / 3})
        self.assertEqual(sweep[2], {"theta": 0.7, "pass_rate": 1 / 3, "node_exist_rate": 2 / 3})


if __name__ == "__main__":
    unittest.main()
