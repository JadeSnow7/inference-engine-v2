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


if __name__ == "__main__":
    unittest.main()
