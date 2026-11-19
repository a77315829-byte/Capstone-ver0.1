import asyncio
from unittest.mock import patch
from app.narrative.generator import generate_reasoning_summary, generate_comparison

def test_failed_llm_preserves_scored_result():
    with patch("app.narrative.generator.route_narrative_request", side_effect=ConnectionError("offline")):
        text = asyncio.run(generate_reasoning_summary("관망", []))
        assert "규칙 기반" in text and "관망" in text

def test_compare_is_available_without_llm():
    with patch("app.narrative.generator.route_narrative_request", side_effect=ConnectionError("offline")):
        text = asyncio.run(generate_comparison("매수", "관망", []))
        assert "매수" in text and "관망" in text and "규칙 기반" in text
