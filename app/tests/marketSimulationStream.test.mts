import assert from "node:assert/strict";
import { test } from "node:test";
import { readMarketSimulationStream, streamMarketSimulation } from "../src/services/marketSimulationStream.ts";

const encoder = new TextEncoder();
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const signal = () => new AbortController().signal;
function body(text: string, byteByByte = false) {
  const bytes = encoder.encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (byteByByte) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      else controller.enqueue(bytes);
      controller.close();
    },
  });
}

test("decodes Korean UTF-8 and CRLF split across arbitrary network chunks", async () => {
  const events: unknown[] = [];
  const text = ": keep-alive\n\n" + frame("agent", { agent: { comment: "수요 증가 전망" } }) + frame("result", { status: "success" });
  await readMarketSimulationStream(body(text.replaceAll("\n", "\r\n"), true), e => events.push(e), signal());
  assert.deepEqual(events, [
    { event: "agent", data: { agent: { comment: "수요 증가 전망" } } },
    { event: "result", data: { status: "success" } },
  ]);
});

test("delivers an intermediate result while the final response is still pending", async () => {
  let producer!: ReadableStreamDefaultController<Uint8Array>;
  let received!: () => void;
  const firstEvent = new Promise<void>(resolve => { received = resolve; });
  const events: string[] = [];
  const pending = readMarketSimulationStream(new ReadableStream({ start(c) { producer = c; } }), e => {
    events.push(e.event);
    received();
  }, signal());
  producer.enqueue(encoder.encode(frame("progress", { stage: "agents" })));
  await firstEvent;
  assert.deepEqual(events, ["progress"]);
  producer.enqueue(encoder.encode(frame("result", { status: "success" })));
  await pending;
  assert.deepEqual(events, ["progress", "result"]);
});

test("accepts multi-line data and ignores comments and unknown event types", async () => {
  const events: unknown[] = [];
  await readMarketSimulationStream(body(': heartbeat\n\nevent: future\ndata: ignored\n\nevent: result\ndata: {\ndata: "status": "success"}\n\n'), e => events.push(e), signal());
  assert.deepEqual(events, [{ event: "result", data: { status: "success" } }]);
});

test("a terminal rejection ends the stream without inventing a result", async () => {
  const events: string[] = [];
  await readMarketSimulationStream(body(frame("error", { status: "rejected", message: "입력 확인" }) + frame("result", {})), e => events.push(e.event), signal());
  assert.deepEqual(events, ["error"]);
});

test("an interrupted stream without a terminal event is an error", async () => {
  await assert.rejects(readMarketSimulationStream(body(frame("progress", { stage: "summary" })), () => {}, signal()), /최종 결과/);
  await assert.rejects(readMarketSimulationStream(body('event: result\ndata: {"status":'), () => {}, signal()), /최종 결과/);
});

test("malformed JSON is reported without exposing upstream output", async () => {
  await assert.rejects(readMarketSimulationStream(body("event: agent\ndata: invalid private output\n\n"), () => {}, signal()), /분석 응답을 읽지 못했습니다/);
});

test("abort stops a pending read and cancels its network body", async () => {
  let cancelled = false;
  const controller = new AbortController();
  const pending = readMarketSimulationStream(new ReadableStream({ cancel() { cancelled = true; } }), () => {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(cancelled, true);
});

test("POST preserves auth, request body and cookies without a second request", async t => {
  let calls = 0;
  const controller = new AbortController();
  const request = { user_id: "test", selected_stock: { code: "005930", name: "삼성전자" }, input_text: "실적 개선", input_type_hint: "real_news" };
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    calls += 1;
    assert.equal(url, "/api/market-reaction/simulate/stream");
    assert.equal(options.method, "POST");
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer test-token");
    assert.deepEqual(JSON.parse(String(options.body)), request);
    assert.equal(options.credentials, "include");
    assert.equal(options.signal, controller.signal);
    return new Response(body(frame("result", { status: "success" })), { headers: { "Content-Type": "text/event-stream" } });
  });
  await streamMarketSimulation({ url: "/api/market-reaction/simulate/stream", request, token: "test-token", withCredentials: true, signal: controller.signal, onEvent: () => {} });
  assert.equal(calls, 1);
});
