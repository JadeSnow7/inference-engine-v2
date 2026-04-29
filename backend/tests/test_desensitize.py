import os
os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

import unittest
from core.desensitize import desensitize


class TestDesensitize(unittest.TestCase):

    # ---- Regex-based rules ------------------------------------------------

    def test_letter_prefixed_student_id(self):
        # Covers U-, S-, B- and other single-letter prefix formats
        for sid in ["U2021123456", "S2021123456", "B20211234"]:
            with self.subTest(sid=sid):
                result = desensitize(f"我的学号是{sid}，请帮我看看")
                self.assertIn("[学号]", result)
                self.assertNotIn(sid, result)

    def test_phone_number(self):
        result = desensitize("联系方式：13812345678")
        self.assertIn("[电话]", result)
        self.assertNotIn("13812345678", result)

    def test_email(self):
        result = desensitize("邮件发到 zhangsan@hust.edu.cn")
        self.assertIn("[邮箱]", result)
        self.assertNotIn("zhangsan@hust.edu.cn", result)

    def test_id_card(self):
        result = desensitize("身份证号420102199001011234")
        self.assertIn("[身份证]", result)

    def test_no_false_positive_on_normal_text(self):
        text = "请分析这段论文摘要的结构是否合理，重点看逻辑连接。"
        result = desensitize(text)
        self.assertEqual(result, text)

    # ---- Profile-based rules ----------------------------------------------

    def test_profile_name_substitution(self):
        profile = {"name": "张三"}
        result = desensitize("我是张三，请帮我修改这段话", profile=profile)
        self.assertIn("[姓名]", result)
        self.assertNotIn("张三", result)

    def test_profile_advisor_substitution(self):
        profile = {"advisor": "李教授"}
        result = desensitize("导师李教授要求我补充实验数据", profile=profile)
        self.assertIn("[导师姓名]", result)
        self.assertNotIn("李教授", result)

    def test_profile_student_id_substitution(self):
        profile = {"student_id": "2021302110001"}
        result = desensitize("学号2021302110001的同学", profile=profile)
        self.assertIn("[学号]", result)

    def test_short_name_not_substituted(self):
        # Single-char names cause too many false positives — skip them
        profile = {"name": "王"}
        result = desensitize("这是王道教材的例题", profile=profile)
        self.assertIn("王道", result)  # should NOT be replaced

    def test_empty_profile(self):
        text = "帮我写一段文献综述"
        self.assertEqual(desensitize(text, profile={}), text)

    def test_none_profile(self):
        text = "帮我写一段文献综述"
        self.assertEqual(desensitize(text, profile=None), text)

    # ---- Combined ---------------------------------------------------------

    def test_combined_pii(self):
        profile = {"name": "李明", "student_id": "U2021999888"}
        text = "我是李明，学号U2021999888，手机13900001234，邮箱liming@example.com"
        result = desensitize(text, profile=profile)
        self.assertIn("[姓名]", result)
        self.assertIn("[学号]", result)
        self.assertIn("[电话]", result)
        self.assertIn("[邮箱]", result)
        self.assertNotIn("李明", result)
        self.assertNotIn("U2021999888", result)
        self.assertNotIn("13900001234", result)
        self.assertNotIn("liming@example.com", result)


if __name__ == "__main__":
    unittest.main()
