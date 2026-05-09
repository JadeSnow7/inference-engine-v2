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


if __name__ == "__main__":
    unittest.main()
