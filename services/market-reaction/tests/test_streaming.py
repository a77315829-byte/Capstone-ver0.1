"""SSE 단계 순서, 최종 응답 호환성 및 연결 종료 시 작업 정리."""

import asyncio
import importlib
import json

import pytest
from fastapi.testclient import TestClient

import app.api.routes as routes
import app.core.agents as agents
import app.service as service
from app.core.fallback import AGENT_ORDER, build_fallback_agent_output
from app.main import app
from app.schemas.request import SimulationRequest
from app.schemas.response import SimulationResponse
from app.services.llm_client import LLMError

_BODY = {
    "user_id": "stream_test",
    "selected_stock": {"code": "005930", "name": "삼성전자"},
    "input_text": "AI 반도체 수요 증가로 삼성전자 HBM 실적 개선 기대가 커지고 있다.",
    "input_type_hint": "industry_information",
}


@pytest.fixture
def fast_fallback(monkeypatch):
    async def unavailable(**kwargs):
        raise LLMError("offline")

    async def no_documents(*args, **kwargs):
        return []

    for name in ("validator", "external_context", "agents", "critic", "summary"):
        monkeypatch.setattr(importlib.import_module(f"app.core.{name}"), "chat_json", unavailable)
    monkeypatch.setattr("app.core.external_context.retrieve_relevant_documents", no_documents)


def _decode(frame):
    lines = frame.strip().splitlines()
    return lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))


def test_stream_matches_existing_json_response(fast_fallback):
    with TestClient(app) as client:
        response = client.post("/simulate/stream", json=_BODY)
        original = client.post("/simulate", json=_BODY).json()
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    events = [_decode(frame) for frame in response.text.strip().split("\n\n")]
    assert [data["stage"] for name, data in events if name == "progress"] == [
        "validating", "context", "agents", "review", "summary",
    ]
    assert [name for name, _ in events] == [
        "progress", "progress", "context", "progress",
        "agent", "agent", "agent", "agent", "agent",
        "progress", "aggregate", "progress", "result",
    ]
    final = events[-1][1]
    SimulationResponse.model_validate(final)
    for key in ("simulation_id", "created_at"):
        original.pop(key)
        final.pop(key)
    assert final == original
    context = next(data for name, data in events if name == "context")
    assert context["fallback_used"] is True
    assert context["impact_analysis"] == final["impact_analysis"]
    assert context["current_stock_context"] == final["current_stock_context"]
    agent_events = [data for name, data in events if name == "agent"]
    assert [data["completed_agents"] for data in agent_events] == [1, 2, 3, 4, 5]
    assert all(data["total_agents"] == 5 and data["fallback_used"] for data in agent_events)
    aggregate = next(data for name, data in events if name == "aggregate")
    assert aggregate == {key: final[key] for key in aggregate}


@pytest.mark.asyncio
async def test_context_and_agents_stream_before_review_and_summary(fast_fallback, monkeypatch):
    gates = {agent_type: asyncio.Event() for agent_type in AGENT_ORDER}
    review_gate = asyncio.Event()
    summary_gate = asyncio.Event()
    original_review = service.review_agent_consistency
    original_summary = service.generate_summary

    async def gated_agent(agent_type, standard_input):
        await gates[agent_type].wait()
        output = build_fallback_agent_output(
            agent_type, standard_input.impact_direction,
            standard_input.price_reflection_level, standard_input.event_type,
        )
        return output, [f"agent:{agent_type.value}"]

    async def gated_review(*args):
        await review_gate.wait()
        review, modules = await original_review(*args)
        review.conflicts = ["정합성 검토에서 확인한 불확실성"]
        return review, modules

    async def gated_summary(*args):
        await summary_gate.wait()
        return await original_summary(*args)

    monkeypatch.setattr(agents, "run_agent", gated_agent)
    monkeypatch.setattr(service, "review_agent_consistency", gated_review)
    monkeypatch.setattr(service, "generate_summary", gated_summary)
    stream = routes._simulation_events(SimulationRequest(**_BODY))

    async def next_event():
        return _decode(await asyncio.wait_for(anext(stream), 1))

    pending = None
    try:
        assert await next_event() == ("progress", {"stage": "validating"})
        assert await next_event() == ("progress", {"stage": "context"})
        name, context = await next_event()
        assert name == "context" and context["impact_analysis"]
        assert await next_event() == ("progress", {"stage": "agents"})
        completion_order = list(reversed(AGENT_ORDER))
        for completed, agent_type in enumerate(completion_order, start=1):
            gates[agent_type].set()
            name, data = await next_event()
            assert name == "agent"
            assert data["agent"]["agent_type"] == agent_type.value
            assert data["completed_agents"] == completed
        assert await next_event() == ("progress", {"stage": "review"})
        pending = asyncio.create_task(next_event())
        await asyncio.sleep(0)
        assert not pending.done()
        review_gate.set()
        name, aggregate = await pending
        assert name == "aggregate"
        assert "정합성 검토에서 확인한 불확실성" in aggregate["uncertainty_factors"]
        assert await next_event() == ("progress", {"stage": "summary"})
        pending = asyncio.create_task(next_event())
        await asyncio.sleep(0)
        assert not pending.done()
        summary_gate.set()
        name, result = await pending
        assert name == "result"
        assert [agent["agent_type"] for agent in result["agent_reactions"]] == [
            agent_type.value for agent_type in AGENT_ORDER
        ]
        assert aggregate["uncertainty_factors"] == result["uncertainty_factors"]
        with pytest.raises(StopAsyncIteration):
            await anext(stream)
    finally:
        if pending is not None and not pending.done():
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)
        await stream.aclose()


def test_stream_rejection_and_request_validation(fast_fallback):
    with TestClient(app) as client:
        response = client.post("/simulate/stream", json=dict(_BODY, input_text="삼성전자 지금 사야 하나요?"))
        malformed = client.post("/simulate/stream", json={})
    events = [_decode(frame) for frame in response.text.strip().split("\n\n")]
    assert [name for name, _ in events] == ["progress", "error"]
    assert events[-1][1]["status"] == "rejected"
    assert events[-1][1]["reason_code"] == "DIRECT_ADVICE_REQUEST"
    assert malformed.status_code == 422
    assert malformed.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_stream_unexpected_error_does_not_expose_exception(monkeypatch):
    async def broken(request, on_event):
        await on_event("progress", {"stage": "validating"})
        raise RuntimeError("private upstream configuration")

    monkeypatch.setattr(routes, "run_market_reaction_simulation", broken)
    frames = [frame async for frame in routes._simulation_events(SimulationRequest(**_BODY))]
    assert _decode(frames[-1])[1]["status"] == "error"
    assert _decode(frames[-1])[1]["reason_code"] == "SIMULATION_FAILED"
    assert "private upstream configuration" not in "".join(frames)


@pytest.mark.asyncio
async def test_heartbeat_and_deadline_cancel_pipeline(monkeypatch):
    cancelled = asyncio.Event()

    async def blocked(request, on_event):
        try:
            await on_event("progress", {"stage": "validating"})
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    monkeypatch.setattr(routes, "run_market_reaction_simulation", blocked)
    monkeypatch.setattr(routes, "_STREAM_HEARTBEAT_SECONDS", 0.005)
    monkeypatch.setattr(routes, "_STREAM_TIMEOUT_SECONDS", 0.05)
    frames = [frame async for frame in routes._simulation_events(SimulationRequest(**_BODY))]
    events = [_decode(frame) for frame in frames if frame.startswith("event:")]
    assert events[0] == ("progress", {"stage": "validating"})
    assert ": keep-alive\n\n" in frames
    assert _decode(frames[-1])[1]["reason_code"] == "SIMULATION_TIMEOUT"
    assert cancelled.is_set()


@pytest.mark.asyncio
@pytest.mark.parametrize("stop_reason", ["disconnect", "deadline"])
async def test_stream_cancellation_cleans_up_all_agents(fast_fallback, monkeypatch, stop_reason):
    started = set()
    cancelled = set()
    all_started = asyncio.Event()

    async def blocked_agent(agent_type, standard_input):
        started.add(agent_type)
        if len(started) == 5:
            all_started.set()
        try:
            await asyncio.Event().wait()
        finally:
            # 비동기 정리까지 완료되어야 연결 종료 처리가 끝난다.
            await asyncio.sleep(0)
            cancelled.add(agent_type)

    monkeypatch.setattr(agents, "run_agent", blocked_agent)
    if stop_reason == "deadline":
        monkeypatch.setattr(routes, "_STREAM_TIMEOUT_SECONDS", 0.05)
        frames = [frame async for frame in routes._simulation_events(SimulationRequest(**_BODY))]
        assert _decode(frames[-1])[1]["reason_code"] == "SIMULATION_TIMEOUT"
    else:
        messages = []
        request_sent = False

        async def receive():
            nonlocal request_sent
            if not request_sent:
                request_sent = True
                return {"type": "http.request", "body": json.dumps(_BODY).encode(), "more_body": False}
            await all_started.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1", "method": "POST", "scheme": "http",
            "path": "/simulate/stream", "raw_path": b"/simulate/stream", "query_string": b"",
            "root_path": "", "headers": [(b"content-type", b"application/json")],
            "server": ("test", 80), "client": ("test", 123),
        }
        await asyncio.wait_for(app(scope, receive, send), 1)
        assert messages[0]["status"] == 200
        assert not any(b"event: result" in message.get("body", b"") for message in messages)
    assert started == set(AGENT_ORDER)
    assert cancelled == set(AGENT_ORDER)


@pytest.mark.asyncio
async def test_agent_callback_failure_cancels_remaining_agents(fast_fallback, monkeypatch):
    started = asyncio.Event()
    cancelled = set()
    count = 0
    original_agent = agents.run_agent

    async def waiting_agent(agent_type, standard_input):
        nonlocal count
        count += 1
        if count == 5:
            started.set()
        if agent_type == AGENT_ORDER[0]:
            await started.wait()
            return await original_agent(agent_type, standard_input)
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.add(agent_type)

    async def broken_callback(name, data):
        if name == "agent":
            raise RuntimeError("consumer disconnected")

    monkeypatch.setattr(agents, "run_agent", waiting_agent)
    with pytest.raises(RuntimeError, match="consumer disconnected"):
        await asyncio.wait_for(service.run_market_reaction_simulation(
            SimulationRequest(**_BODY), on_event=broken_callback,
        ), 1)
    assert cancelled == set(AGENT_ORDER[1:])
