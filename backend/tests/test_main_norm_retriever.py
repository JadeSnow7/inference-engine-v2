import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class MainNormRetrieverTest(unittest.TestCase):
    def test_build_norm_retriever_falls_back_without_raw_exception(self):
        import main

        class FailingEmbedder:
            def __init__(self):
                raise RuntimeError("provider failed with secret-like details")

        created = []

        class FakeRetriever:
            def __init__(self, embedder=None):
                created.append(embedder)

            def __len__(self):
                return 107

        with patch.object(main, "DashScopeEmbedder", FailingEmbedder), patch.object(main, "NormNodeRetriever", FakeRetriever):
            retriever = main.build_norm_retriever()

        self.assertIsInstance(retriever, FakeRetriever)
        self.assertEqual(created, [None])


if __name__ == "__main__":
    unittest.main()
