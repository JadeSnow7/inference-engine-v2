import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


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

    def test_parse_limit_defaults_to_full_query_set(self):
        args = real.parse_args(["--method", "all", "--query-set", "query_set_v2.json", "--real"])

        self.assertIsNone(args.limit)

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

    def test_build_real_row_with_llm_fails_explicitly_until_generation_is_wired(self):
        query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}

        with self.assertRaisesRegex(RuntimeError, "LLM generation is not wired yet"):
            real.build_real_row(query, "full_graphrag", object(), theta=0.6, with_llm=True)

    def test_main_reports_with_llm_boundary_without_traceback(self):
        stderr = io.StringIO()
        argv = [
            "run_rq2_real.py",
            "--root", str(Path("/app/inference-engine")),
            "--method", "full_graphrag",
            "--limit", "1",
            "--real",
            "--with-llm",
        ]

        with patch.object(sys, "argv", argv), patch("sys.stderr", stderr):
            exit_code = real.main()

        self.assertEqual(exit_code, 2)
        self.assertIn("LLM generation", stderr.getvalue())
        self.assertNotIn("Traceback", stderr.getvalue())

    def test_build_real_row_with_llm_uses_injected_generator(self):
        query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}

        class FakeRAG:
            def retrieve(self, text, *, top_k, graph_expand):
                return [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation evidence", "score": 0.8}]

        calls = []

        def fake_generator(*, query, method, retrieved_nodes):
            calls.append((query["query_id"], method, [node["node_id"] for node in retrieved_nodes]))
            return "评价维度：规范溯源。\n问题定位：citation evidence\n规范依据：[REF:A]\n修改建议：revise citation."

        row = real.build_real_row(
            query,
            "full_graphrag",
            FakeRAG(),
            theta=0.6,
            with_llm=True,
            llm_generator=fake_generator,
        )

        self.assertEqual(calls, [("Q001", "full_graphrag", ["A"])])
        self.assertEqual(row["run_type"], "real_system_llm")
        self.assertEqual(row["generated_refs"], ["A"])
        self.assertTrue(row["validation_results"]["A"]["pass"])

    def test_llm_generation_retries_transient_failures(self):
        query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}

        class FakeRAG:
            def retrieve(self, text, *, top_k, graph_expand):
                return [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation evidence", "score": 0.8}]

        attempts = []

        def flaky_generator(*, query, method, retrieved_nodes):
            attempts.append(query["query_id"])
            if len(attempts) < 3:
                raise TimeoutError("temporary timeout")
            return "评价维度：规范溯源。\n问题定位：citation evidence\n规范依据：[REF:A]\n修改建议：revise citation."

        row = real.build_real_row(
            query,
            "full_graphrag",
            FakeRAG(),
            theta=0.6,
            with_llm=True,
            llm_generator=flaky_generator,
            llm_max_attempts=3,
            llm_retry_delay_seconds=0,
        )

        self.assertEqual(len(attempts), 3)
        self.assertEqual(row["run_type"], "real_system_llm")
        self.assertEqual(row["generated_refs"], ["A"])

    def test_resume_rows_reuses_only_live_llm_prefix(self):
        queries = [{"query_id": "Q001"}, {"query_id": "Q002"}]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "full_graphrag.jsonl"
            path.write_text(
                json.dumps({"method": "full_graphrag", "query_id": "Q001", "run_type": "real_system_llm"}) + "\n",
                encoding="utf-8",
            )

            rows = real.read_resumable_live_rows(path, method="full_graphrag", queries=queries)

        self.assertEqual([row["query_id"] for row in rows], ["Q001"])

    def test_resume_rows_ignores_fallback_or_mismatched_outputs(self):
        queries = [{"query_id": "Q001"}, {"query_id": "Q002"}]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "full_graphrag.jsonl"
            path.write_text(
                json.dumps({"method": "full_graphrag", "query_id": "Q001", "run_type": "real_system"}) + "\n",
                encoding="utf-8",
            )

            rows = real.read_resumable_live_rows(path, method="full_graphrag", queries=queries)

        self.assertEqual(rows, [])

    def test_build_llm_prompt_contains_query_nodes_and_ref_instruction(self):
        query = {"query_id": "Q001", "text": "citation evidence"}
        nodes = [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "Every claim needs a source.", "score": 0.8}]

        messages = real.build_llm_messages(query=query, method="full_graphrag", retrieved_nodes=nodes)

        joined = "\n".join(message["content"] for message in messages)
        self.assertIn("Q001", joined)
        self.assertIn("citation evidence", joined)
        self.assertIn("A", joined)
        self.assertIn("[REF:A]", joined)

    def test_query_set_path_argument_and_all_methods_are_supported(self):
        args = real.parse_args(["--method", "all", "--query-set", "query_set_v2.json", "--real"])

        self.assertEqual(args.method, "all")
        self.assertEqual(args.query_set, "query_set_v2.json")

    def test_build_run_manifest_records_reproducibility_fields(self):
        manifest = real.build_run_manifest(
            root=Path("/repo"),
            run_id="run-1",
            query_set_hash="abc",
            norm_nodes_hash="def",
            run_type="real",
            model="fallback",
            random_seed=7,
        )

        self.assertEqual(manifest["run_id"], "run-1")
        self.assertEqual(manifest["run_type"], "real")
        self.assertEqual(manifest["query_set_hash"], "abc")
        self.assertEqual(manifest["norm_nodes_hash"], "def")
        self.assertEqual(manifest["theta_values"], [0.5, 0.55, 0.6, 0.65, 0.7])
        self.assertFalse(manifest["offline_stub_allowed"])
        self.assertIn("full_graphrag", manifest["method_configs"])


if __name__ == "__main__":
    unittest.main()
