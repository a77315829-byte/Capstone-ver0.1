export type AgentReaction = {
  agent_type?: string;
  agent_name_ko?: string;
  reaction_direction?: string;
  reaction_direction_ko?: string;
  reaction_strength?: string;
  reaction_strength_ko?: string;
  key_reasons?: string[];
  comment?: string;
  risk_factors?: string[];
};

export type SimulationResult = {
  status?: string;
  simulation_id?: string;
  selected_stock?: { code?: string; name?: string };
  input_text?: string;
  input_type?: string;
  impact_analysis?: {
    impact_direction?: string;
    impact_direction_ko?: string;
    impact_strength?: string;
    impact_strength_ko?: string;
    related_industries?: string[];
    time_horizon?: string;
    time_horizon_ko?: string;
    key_keywords?: string[];
  };
  current_stock_context?: {
    code?: string;
    name?: string;
    industry?: string;
    current_price?: number | null;
    daily_change_rate?: number | null;
    volume_trend?: string;
    data_source?: string;
    is_realtime?: boolean;
  };
  market_pressure?: {
    buy?: number;
    sell?: number;
    hold?: number;
    dominant?: string;
    headline?: string;
  };
  market_sentiment?: {
    code?: string;
    label_ko?: string;
    one_liner?: string;
  };
  analysis_confidence?: {
    score?: number;
    grade?: string;
    grade_ko?: string;
    explanation?: string;
  };
  uncertainty_factors?: string[];
  agent_reactions?: AgentReaction[];
  overall_explanation?: string;
  meta?: {
    llm_model?: string;
    llm_status?: string;
    fallback_used?: boolean;
    fallback_modules?: string[];
    stock_data_source?: string;
    db_save_status?: string;
  };
  created_at?: string;
};

export type SimulationProgress = {
  stage: "quote" | "validating" | "context" | "agents" | "review" | "summary";
  message?: string;
};

export type SimulationContext = Pick<SimulationResult, "impact_analysis" | "current_stock_context"> & {
  fallback_used: boolean;
};

export type SimulationAgent = {
  agent: AgentReaction;
  fallback_used: boolean;
  completed_agents: number;
  total_agents: number;
};

export type SimulationAggregate = Pick<SimulationResult, "market_pressure" | "market_sentiment" | "uncertainty_factors">;

export type SimulationStreamEvent =
  | { event: "progress"; data: SimulationProgress }
  | { event: "context"; data: SimulationContext }
  | { event: "agent"; data: SimulationAgent }
  | { event: "aggregate"; data: SimulationAggregate }
  | { event: "result"; data: SimulationResult }
  | { event: "error"; data: { status: "rejected" | "error"; reason_code?: string; message: string } };

const eventNames = new Set(["progress", "context", "agent", "aggregate", "result", "error"]);

// Read lines incrementally: fetch chunks can split UTF-8 characters, CRLF, and event data.
export async function readMarketSimulationStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SimulationStreamEvent) => void,
  signal: AbortSignal,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];
  let terminal = false;

  const dispatch = () => {
    if (dataLines.length && eventNames.has(eventName)) {
      let data: unknown;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        throw new Error("분석 응답을 읽지 못했습니다. 다시 분석해주세요.");
      }
      if (!data || typeof data !== "object") {
        throw new Error("분석 응답 형식이 올바르지 않습니다.");
      }
      signal.throwIfAborted();
      onEvent({ event: eventName, data } as SimulationStreamEvent);
      terminal = eventName === "result" || eventName === "error";
    }
    eventName = "message";
    dataLines = [];
  };

  const consumeLines = (atEnd = false) => {
    while (!terminal) {
      const end = buffer.search(/[\r\n]/);
      if (end < 0 || (!atEnd && buffer[end] === "\r" && end === buffer.length - 1)) return;
      const line = buffer.slice(0, end);
      const delimiterLength = buffer[end] === "\r" && buffer[end + 1] === "\n" ? 2 : 1;
      buffer = buffer.slice(end + delimiterLength);
      if (!line) {
        dispatch();
      } else if (!line.startsWith(":")) {
        const separator = line.indexOf(":");
        const field = separator < 0 ? line : line.slice(0, separator);
        const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
        if (field === "event") eventName = value;
        if (field === "data") dataLines.push(value);
      }
    }
  };

  const abortRead = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortRead, { once: true });
  try {
    signal.throwIfAborted();
    while (!terminal) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      consumeLines(done);
      if (done) break;
    }
    if (!terminal) {
      throw new Error("분석 연결이 중단되어 최종 결과를 받지 못했습니다. 다시 분석해주세요.");
    }
  } finally {
    signal.removeEventListener("abort", abortRead);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamMarketSimulation({
  url,
  request,
  token,
  withCredentials,
  signal,
  onEvent,
}: {
  url: string;
  request: { user_id: string; selected_stock: { code: string; name: string }; input_text: string; input_type_hint: string };
  token: string | null;
  withCredentials?: boolean;
  signal: AbortSignal;
  onEvent: (event: SimulationStreamEvent) => void;
}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: withCredentials ? "include" : "same-origin",
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.message || data?.error;
    if (typeof message === "string") throw new Error(message);
    if (response.status === 422) throw new Error("직접적인 투자 추천 요청은 처리할 수 없습니다.");
    if (response.status === 502 || response.status === 503) throw new Error("시장 반응 분석 서비스에 연결하지 못했습니다.");
    throw new Error("시뮬레이션 실행 중 오류가 발생했습니다.");
  }
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("분석 스트리밍 응답을 받지 못했습니다. 다시 분석해주세요.");
  }
  await readMarketSimulationStream(response.body, onEvent, signal);
}
