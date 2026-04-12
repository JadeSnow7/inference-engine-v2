import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from profile.inject import inject_user_profile
from profile.models import UserProfile, from_survey


class ProfileInjectTest(unittest.TestCase):
    def test_from_survey_maps_answers(self) -> None:
        profile = from_survey("指出问题并给 2-3 个修改方向", "详细")
        self.assertEqual(profile.teaching_style, "directional")
        self.assertEqual(profile.feedback_verbosity, "detailed")

    def test_inject_profile_appends_hints(self) -> None:
        profile = UserProfile(feedback_verbosity="concise", writing_stage="零基础")
        result = inject_user_profile("系统提示", profile)
        self.assertIn("当前用户画像", result)
        self.assertIn("零基础", result)
        self.assertIn("每条反馈不超过 2 句", result)
