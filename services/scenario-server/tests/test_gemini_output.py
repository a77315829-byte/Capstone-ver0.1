import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import config
from scoring.gemini_client import generate_json


class GeminiOutputTest(unittest.TestCase):
    @patch.dict(os.environ, {"AI_MODE": "auto"})
    @patch.object(config, "GEMINI_API_KEY", "unit-test-key")
    def test_feedback_has_bounded_schema_and_failure_moves_to_next_model(self):
        client = MagicMock()
        client.__enter__.return_value = client
        client.models.generate_content.side_effect = [RuntimeError("offline"), SimpleNamespace(text='{"explanation":"확인할 위험을 함께 설명했습니다."}')]
        with patch("google.genai.Client", return_value=client):
            result = generate_json("synthetic", ["first", "second"], required_keys=["explanation"])
        self.assertTrue(result.ok)
        self.assertEqual(result.model, "second")
        settings = client.models.generate_content.call_args.kwargs["config"]
        self.assertEqual(settings.max_output_tokens, 1024)
        self.assertEqual(settings.response_json_schema["required"], ["explanation"])
        self.assertEqual(settings.response_json_schema["properties"]["explanation"]["maxLength"], 600)
