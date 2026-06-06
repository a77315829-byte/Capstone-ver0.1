from typing import Dict, Any, Optional, List
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import MarketModel

app = FastAPI(title="STOTRA Simulator API")

# React(localhost:3000/5173 등)에서 호출할 수 있게 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용. 나중엔 프론트 주소만 허용하는 게 좋음
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 메모리 내 시뮬레이터 저장소
SIMULATIONS: Dict[str, MarketModel] = {}


# =========================
# Request models
# =========================

class CreateSimRequest(BaseModel):
    news_text: str = ""
    use_llm: bool = True
    llm_model: str = "llama3.1:8b"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_every_n_steps: int = 10
    n_retail: int = 400
    n_institution: int = 20


class UpdateNewsRequest(BaseModel):
    news_text: str


class RunStepsRequest(BaseModel):
    steps: int = 1


# =========================
# Helpers
# =========================

def serialize_model(sim_id: str, model: MarketModel) -> Dict[str, Any]:
    return {
        "sim_id": sim_id,
        "t": model.t,
        "news_text": model.news_text,
        "price": model.price,
        "prev_price": model.prev_price,
        "last_price_change": model.last_price_change,
        "last_return": model.last_return,
        "interest_rate": model.interest_rate,
        "gov_stimulus": model.gov_stimulus,
        "rolling_vol": model.rolling_vol,
        "llm_signals": model.llm_signals,
        "use_llm": model.use_llm,
        "llm_every_n_steps": model.llm_every_n_steps,
        "inst_scale": model.inst_scale,
        "ret_scale": model.ret_scale,
    }


def get_sim_or_404(sim_id: str) -> MarketModel:
    sim = SIMULATIONS.get(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return sim


# =========================
# Routes
# =========================

@app.get("/")
def root():
    return {
        "message": "STOTRA Simulator API running",
        "sim_count": len(SIMULATIONS),
    }


@app.post("/sim/create")
def create_sim(req: CreateSimRequest):
    sim_id = str(uuid4())

    model = MarketModel(
        n_retail=req.n_retail,
        n_institution=req.n_institution,
        use_llm=req.use_llm,
        llm_model=req.llm_model,
        llm_base_url=req.llm_base_url,
        llm_every_n_steps=req.llm_every_n_steps,
    )
    model.news_text = req.news_text

    SIMULATIONS[sim_id] = model

    return {
        "message": "Simulation created",
        "state": serialize_model(sim_id, model),
    }


@app.get("/sim/{sim_id}/state")
def get_state(sim_id: str):
    model = get_sim_or_404(sim_id)
    return serialize_model(sim_id, model)


@app.post("/sim/{sim_id}/news")
def update_news(sim_id: str, req: UpdateNewsRequest):
    model = get_sim_or_404(sim_id)
    model.news_text = req.news_text
    return {
        "message": "News updated",
        "state": serialize_model(sim_id, model),
    }


@app.post("/sim/{sim_id}/step")
def run_one_step(sim_id: str):
    model = get_sim_or_404(sim_id)
    model.step()
    return {
        "message": "Step completed",
        "state": serialize_model(sim_id, model),
    }


@app.post("/sim/{sim_id}/run")
def run_steps(sim_id: str, req: RunStepsRequest):
    model = get_sim_or_404(sim_id)

    if req.steps <= 0:
        raise HTTPException(status_code=400, detail="steps must be >= 1")
    if req.steps > 1000:
        raise HTTPException(status_code=400, detail="steps too large")

    for _ in range(req.steps):
        model.step()

    return {
        "message": f"{req.steps} steps completed",
        "state": serialize_model(sim_id, model),
    }


@app.delete("/sim/{sim_id}")
def delete_sim(sim_id: str):
    model = SIMULATIONS.pop(sim_id, None)
    if model is None:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return {
        "message": "Simulation deleted",
        "sim_id": sim_id,
    }


@app.get("/sim")
def list_sims():
    return {
        "count": len(SIMULATIONS),
        "items": [serialize_model(sim_id, model) for sim_id, model in SIMULATIONS.items()],
    }




class RunVisualSimRequest(BaseModel):
    symbol: str = ""
    stock_name: str = ""
    current_price: float = 100.0
    change_rate: float = 0.0
    volume: float = 0.0
    news_text: str = ""
    steps: int = 60
    use_llm: bool = True
    llm_model: str = "llama3.1:8b"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_every_n_steps: int = 10
    n_retail: int = 400
    n_institution: int = 20


def signal_to_card(key: str, title: str, signal: Optional[Dict[str, Any]]):
    signal = signal or {
        "stance": "hold",
        "intensity": 0.0,
        "confidence": 0.0,
        "key_factors": [],
    }

    stance = signal.get("stance", "hold")
    intensity = float(signal.get("intensity", 0.0))
    confidence = float(signal.get("confidence", 0.0))
    key_factors = signal.get("key_factors", [])

    if stance == "buy":
        action = "매수 우위"
    elif stance == "sell":
        action = "매도 우위"
    else:
        action = "관망"

    return {
        "key": key,
        "title": title,
        "stance": stance,
        "action": action,
        "intensity": intensity,
        "confidence": confidence,
        "key_factors": key_factors if isinstance(key_factors, list) else [str(key_factors)],
    }


@app.post("/sim/run-visual")
def run_visual_sim(req: RunVisualSimRequest):
    if req.steps <= 0:
        raise HTTPException(status_code=400, detail="steps must be >= 1")
    if req.steps > 300:
        raise HTTPException(status_code=400, detail="steps too large")

    news_text = req.news_text.strip()
    if not news_text:
        news_text = f"""
종목: {req.stock_name}({req.symbol})
현재가: {req.current_price}
등락률: {req.change_rate}%
거래량: {req.volume}
"""

    model = MarketModel(
        n_retail=req.n_retail,
        n_institution=req.n_institution,
        use_llm=req.use_llm,
        llm_model=req.llm_model,
        llm_base_url=req.llm_base_url,
        llm_every_n_steps=req.llm_every_n_steps,
        price_init=max(float(req.current_price or 100.0), 0.1),
    )

    model.news_text = news_text

    price_history: List[Dict[str, Any]] = []

    def push_history():
        price_history.append({
            "t": model.t,
            "price": model.price,
            "prev_price": model.prev_price,
            "price_change": model.last_price_change,
            "return": model.last_return,
            "rolling_vol": model.rolling_vol,
            "interest_rate": model.interest_rate,
            "gov_stimulus": model.gov_stimulus,
        })

    push_history()

    for _ in range(req.steps):
        model.step()
        push_history()

    start_price = price_history[0]["price"]
    end_price = price_history[-1]["price"]
    simulated_return = ((end_price - start_price) / start_price) if start_price > 0 else 0.0

    if simulated_return > 0.03:
        market_decision = "매수 우위"
        market_comment = "시뮬레이션 결과 가격이 상승하는 흐름을 보였습니다."
    elif simulated_return < -0.03:
        market_decision = "매도 또는 관망"
        market_comment = "시뮬레이션 결과 가격이 하락하는 흐름을 보였습니다."
    else:
        market_decision = "관망"
        market_comment = "시뮬레이션 결과 뚜렷한 방향성이 강하지 않았습니다."

    llm_signals = model.llm_signals or {}

    participants = [
        signal_to_card("FED", "연준", llm_signals.get("FED")),
        signal_to_card("GOV", "정부", llm_signals.get("GOV")),
        signal_to_card("INST", "기관", llm_signals.get("INST")),
        signal_to_card("RET", "개미", llm_signals.get("RET")),
    ]

    return {
        "success": True,
        "data": {
            "symbol": req.symbol,
            "stockName": req.stock_name,
            "newsText": news_text,
            "steps": req.steps,
            "priceHistory": price_history,
            "participants": participants,
            "llmSignals": llm_signals,
            "market": {
                "decision": market_decision,
                "comment": market_comment,
                "startPrice": start_price,
                "endPrice": end_price,
                "simulatedReturn": simulated_return,
                "finalVolatility": model.rolling_vol,
                "interestRate": model.interest_rate,
                "govStimulus": model.gov_stimulus,
            },
            "finalState": serialize_model("visual", model),
        }
    }