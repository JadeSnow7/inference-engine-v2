import os
import unittest
from unittest.mock import patch


class SettingsCompatibilityTest(unittest.TestCase):
    def test_jwt_secret_falls_back_to_secret_key(self) -> None:
        from config import Settings

        env = {
            "DASHSCOPE_API_KEY": "test-key",
            "JWT_SECRET": "jwt-secret",
        }

        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.SECRET_KEY, "jwt-secret")


if __name__ == "__main__":
    unittest.main()
