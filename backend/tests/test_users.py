import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.users import ALLOWED_DOMAINS


class DomainValidationTest(unittest.TestCase):
    def test_hust_edu_cn_accepted(self):
        self.assertIsNotNone(ALLOWED_DOMAINS.match("alice@hust.edu.cn"))

    def test_stu_hust_edu_cn_accepted(self):
        self.assertIsNotNone(ALLOWED_DOMAINS.match("u202300001@stu.hust.edu.cn"))

    def test_gmail_rejected(self):
        self.assertIsNone(ALLOWED_DOMAINS.match("alice@gmail.com"))

    def test_bare_hust_rejected(self):
        self.assertIsNone(ALLOWED_DOMAINS.match("alice@hust.com"))

    def test_subdomain_spoofing_rejected(self):
        self.assertIsNone(ALLOWED_DOMAINS.match("alice@evil.hust.edu.cn"))


from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.users import router as users_router
from unittest.mock import AsyncMock, MagicMock, patch
import bcrypt as _bcrypt


def make_test_app(user_store):
    """Create a minimal FastAPI app with a mocked user_store in state."""
    app = FastAPI()
    app.include_router(users_router)
    app.state.user_store = user_store
    return app


def _bcrypt_hash(password: str) -> str:
    """Hash a password using bcrypt directly (avoids passlib/bcrypt 5.x compat issue)."""
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _bcrypt_verify(password: str, hash_: str) -> bool:
    """Verify a password against a bcrypt hash directly."""
    return _bcrypt.checkpw(password.encode(), hash_.encode())


class AuthEndpointTest(unittest.TestCase):
    def _make_store(self, exists=False, hash_value=None):
        store = MagicMock()
        store.exists = AsyncMock(return_value=exists)
        store.create = AsyncMock()
        store.get_hash = AsyncMock(return_value=hash_value)
        return store

    def test_register_success(self):
        store = self._make_store(exists=False)
        # Patch pwd_context.hash to avoid passlib/bcrypt 5.x incompatibility
        with patch("api.users.pwd_context.hash", side_effect=_bcrypt_hash):
            client = TestClient(make_test_app(store))
            res = client.post("/auth/register", json={"email": "alice@hust.edu.cn", "password": "password123"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json(), {"ok": True})

    def test_register_invalid_domain_returns_400(self):
        store = self._make_store()
        client = TestClient(make_test_app(store))
        res = client.post("/auth/register", json={"email": "alice@gmail.com", "password": "password123"})
        self.assertEqual(res.status_code, 400)

    def test_register_duplicate_returns_409(self):
        store = self._make_store(exists=True)
        client = TestClient(make_test_app(store))
        res = client.post("/auth/register", json={"email": "alice@hust.edu.cn", "password": "password123"})
        self.assertEqual(res.status_code, 409)

    def test_register_short_password_returns_422(self):
        store = self._make_store()
        client = TestClient(make_test_app(store))
        res = client.post("/auth/register", json={"email": "alice@hust.edu.cn", "password": "short"})
        self.assertEqual(res.status_code, 422)

    def test_login_success_returns_token(self):
        hash_ = _bcrypt_hash("password123")
        store = self._make_store(hash_value=hash_)
        with patch("api.users.pwd_context.verify", side_effect=_bcrypt_verify):
            client = TestClient(make_test_app(store))
            res = client.post("/auth/login", json={"email": "alice@hust.edu.cn", "password": "password123"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("token", res.json())

    def test_login_wrong_password_returns_401(self):
        hash_ = _bcrypt_hash("correct_password")
        store = self._make_store(hash_value=hash_)
        with patch("api.users.pwd_context.verify", side_effect=_bcrypt_verify):
            client = TestClient(make_test_app(store))
            res = client.post("/auth/login", json={"email": "alice@hust.edu.cn", "password": "wrong_password"})
        self.assertEqual(res.status_code, 401)

    def test_login_unknown_user_returns_401(self):
        store = self._make_store(hash_value=None)
        client = TestClient(make_test_app(store))
        res = client.post("/auth/login", json={"email": "nobody@hust.edu.cn", "password": "password123"})
        self.assertEqual(res.status_code, 401)


if __name__ == "__main__":
    unittest.main()
