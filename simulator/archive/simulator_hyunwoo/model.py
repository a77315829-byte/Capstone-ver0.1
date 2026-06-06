# model.py
import json
import hashlib
import numpy as np
import requests

from mesa import Agent, Model
from mesa.time import StagedActivation


# =========================
# Ollama client (REST)
# =========================

class OllamaClient:
    """
    Ollama REST API를 사용해 JSON 의사결정(stance/intensity/confidence)을 받는다.
    - 캐시: 같은 news + 비슷한 상태면 재호출 방지
    """
    def __init__(self, base_url="http://127.0.0.1:11434", model="llama3.1:8b"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.cache = {}

    def _post_chat(self, messages, options=None):
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if options:
            payload["options"] = options
        r = requests.post(url, json=payload, timeout=120)
        r.raise_for_status()
        return r.json()["message"]["content"]

    def decide(self, role: str, system_prompt: str, user_prompt: str,
               news_text: str, state_bucket: str):
        news_hash = hashlib.md5(news_text.encode("utf-8")).hexdigest()
        key = (role, news_hash, state_bucket)
        if key in self.cache:
            return self.cache[key]

        raw = self._post_chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            options={
                "temperature": 0.2,
                "num_predict": 200,  # 출력 길이 제한
            }
        )

        # JSON만 뽑아 파싱(방어적으로)
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            obj = json.loads(raw[start:end+1])
        except Exception:
            obj = {"stance": "hold", "intensity": 0.0, "confidence": 0.0, "key_factors": ["parse_failed"]}

        stance = obj.get("stance", "hold")
        if stance not in ("buy", "sell", "hold"):
            stance = "hold"
        intensity = float(np.clip(obj.get("intensity", 0.0), 0.0, 1.0))
        confidence = float(np.clip(obj.get("confidence", 0.0), 0.0, 1.0))
        key_factors = obj.get("key_factors", [])
        if not isinstance(key_factors, list):
            key_factors = [str(key_factors)]

        out = {"stance": stance, "intensity": intensity, "confidence": confidence, "key_factors": key_factors[:5]}
        self.cache[key] = out
        return out


# =========================
# LLM prompts (JSON-only)
# =========================

BASE_JSON_RULE = """
You MUST output ONLY valid JSON. No markdown. No extra text.
Schema:
{
  "stance": "buy" | "sell" | "hold",
  "intensity": number,  // 0..1
  "confidence": number, // 0..1
  "key_factors": [string, ...]
}
"""

FED_SYSTEM = f"""You are the Federal Reserve policy maker agent.
You decide how monetary policy affects risk assets given the news and market state.
Output JSON only.
{BASE_JSON_RULE}
"""

GOV_SYSTEM = f"""You are the Government fiscal authority agent.
You decide whether fiscal stimulus/regulation supports risk assets given the news and market state.
Output JSON only.
{BASE_JSON_RULE}
"""

INST_SYSTEM = f"""You are an Institutional investor agent (risk-managed).
Interpret the news and market state, then decide buy/sell/hold.
Output JSON only.
{BASE_JSON_RULE}
"""

RET_SYSTEM = f"""You are a Retail investor crowd agent (sentiment-driven).
Overreact to fear/greed cues. Interpret the news and market state, then decide buy/sell/hold.
Output JSON only.
{BASE_JSON_RULE}
"""


def state_bucket(price, vol, rate):
    # 캐시 키용 버킷팅(너무 자주 LLM 호출 방지)
    p = int(price // 20)
    v = int((vol * 100) // 2)
    r = int((rate * 100) // 1)
    return f"P{p}_V{v}_R{r}"


def stance_to_signed_flow(stance, intensity, confidence, scale):
    s = 0.0
    if stance == "buy":
        s = 1.0
    elif stance == "sell":
        s = -1.0
    return s * intensity * confidence * scale


# =========================
# ABM Agents (rule-based backbone)
# =========================

class FedAgent(Agent):
    def __init__(self, unique_id, model, rate=0.05):
        super().__init__(unique_id, model)
        self.rate = float(rate)

    def policy_step(self):
        sig = self.model.llm_signals.get("FED", {"stance": "hold", "intensity": 0.0, "confidence": 0.0})
        bias = 0.0
        if sig["stance"] == "sell":
            bias = +0.002 * sig["intensity"] * sig["confidence"]
        elif sig["stance"] == "buy":
            bias = -0.004 * sig["intensity"] * sig["confidence"]

        ret = self.model.last_return
        if ret < -0.02:
            self.rate -= 0.01
        else:
            self.rate += 0.001

        self.rate += bias
        self.rate = float(np.clip(self.rate, 0.0, 0.15))
        self.model.interest_rate = self.rate

    def risk_step(self):
        pass

    def trade_step(self):
        pass


class GovernmentAgent(Agent):
    def __init__(self, unique_id, model, price_floor=85.0):
        super().__init__(unique_id, model)
        self.price_floor = float(price_floor)
        self.stimulus = 0.0

    def policy_step(self):
        base = 1.0 if self.model.price < self.price_floor else 0.0
        sig = self.model.llm_signals.get("GOV", {"stance": "hold", "intensity": 0.0, "confidence": 0.0})

        extra = 0.0
        if sig["stance"] == "buy":
            extra = 0.5 * sig["intensity"] * sig["confidence"]
        elif sig["stance"] == "sell":
            extra = -0.5 * sig["intensity"] * sig["confidence"]

        self.stimulus = float(np.clip(base + extra, 0.0, 1.0))
        self.model.gov_stimulus = self.stimulus

    def risk_step(self):
        pass

    def trade_step(self):
        pass


class InstitutionAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.wealth = float(np.random.uniform(50_000, 200_000))
        self.risk_tolerance = float(np.random.uniform(0.5, 1.5))
        self.base_exposure = float(np.random.uniform(0.5, 1.5))
        self.order = 0.0

    def policy_step(self):
        pass

    def risk_step(self):
        vol = self.model.rolling_vol
        target = self.risk_tolerance * self.base_exposure / (vol + 1e-3)
        target = float(np.clip(target, 0.0, 5.0))

        rate_penalty = 1.0 - np.clip(self.model.interest_rate * 3.0, 0.0, 0.9)
        target *= float(rate_penalty)

        direction = target - 1.0
        self.order = self.wealth * direction * 0.0002
        self.model.order_flow += float(self.order)

    def trade_step(self):
        pass


class RetailAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.wealth = float(np.random.uniform(1_000, 10_000))
        self.fear = float(np.random.rand())
        self.greed = float(np.random.rand())
        self.order = 0.0

    def policy_step(self):
        pass

    def risk_step(self):
        pass

    def trade_step(self):
        price_change = self.model.last_price_change

        if price_change < 0:
            self.fear += 0.05
            self.greed -= 0.03
        else:
            self.fear -= 0.02
            self.greed += 0.02

        self.fear = float(np.clip(self.fear, 0.0, 1.0))
        self.greed = float(np.clip(self.greed, 0.0, 1.0))

        decision = self.greed - self.fear
        volume = self.wealth * abs(decision) * 0.01
        self.order = float(volume if decision > 0 else -volume)
        self.model.order_flow += self.order

# =========================
# Market Model
# =========================

class MarketModel(Model):
    """
    - news_text: Streamlit에서 입력 받는 뉴스
    - step()에서 (옵션) LLM 4회 호출하여 신호 생성 -> order_flow/정책에 반영
    """
    def __init__(
        self,
        n_retail=500,
        n_institution=20,
        alpha=0.00005,
        beta=0.5,
        gamma=1.0,
        price_init=100.0,
        price_floor_for_gov=85.0,
        use_llm=True,
        llm_model="llama3.1:8b",
        llm_base_url="http://127.0.0.1:11434",
        llm_every_n_steps=10,  # ✅ 매 스텝 호출은 느릴 수 있어서 기본 10스텝마다
        inst_scale=8000,
        ret_scale=3000,
    ):
        super().__init__()
        self.t = 0

        # 입력
        self.news_text = ""
        self.use_llm = bool(use_llm)

        # 시장 상태
        self.price = float(price_init)
        self.prev_price = float(price_init)
        self.last_price_change = 0.0
        self.last_return = 0.0

        self.interest_rate = 0.05
        self.gov_stimulus = 0.0

        self.returns_window = []
        self.rolling_vol = 0.01

        self.order_flow = 0.0

        # 파라미터
        self.alpha = float(alpha)
        self.beta = float(beta)
        self.gamma = float(gamma)

        # LLM
        self.llm = OllamaClient(base_url=llm_base_url, model=llm_model) if self.use_llm else None
        self.llm_signals = {}  # {"FED": {...}, "GOV": {...}, "INST": {...}, "RET": {...}}
        self.llm_every_n_steps = int(llm_every_n_steps)
        self.inst_scale = float(inst_scale)
        self.ret_scale = float(ret_scale)

        # Scheduler
        self.schedule = StagedActivation(
            self,
            stage_list=["policy_step", "risk_step", "trade_step"],
            shuffle=True
        )

        # agents
                # agents
        next_id = 0

        self.fed = FedAgent(next_id, self, rate=self.interest_rate)
        next_id += 1

        self.gov = GovernmentAgent(next_id, self, price_floor=price_floor_for_gov)
        next_id += 1

        self.schedule.add(self.fed)
        self.schedule.add(self.gov)

        for _ in range(int(n_institution)):
            agent = InstitutionAgent(next_id, self)
            next_id += 1
            self.schedule.add(agent)

        for _ in range(int(n_retail)):
            agent = RetailAgent(next_id, self)
            next_id += 1
            self.schedule.add(agent)

    def _llm_user_prompt(self):
        return f"""News:
{self.news_text}

Market state:
price={self.price:.2f}, vol={self.rolling_vol:.4f}, rate={self.interest_rate:.4f}

Return JSON only.
"""

    def _maybe_run_llm(self):
        if (not self.use_llm) or (self.llm is None):
            return
        if not self.news_text.strip():
            return
        if self.llm_every_n_steps <= 0:
            return
        if (self.t % self.llm_every_n_steps) != 0:
            return

        sb = state_bucket(self.price, self.rolling_vol, self.interest_rate)
        user_prompt = self._llm_user_prompt()

        self.llm_signals["FED"] = self.llm.decide("FED", FED_SYSTEM, user_prompt, self.news_text, sb)
        self.llm_signals["GOV"] = self.llm.decide("GOV", GOV_SYSTEM, user_prompt, self.news_text, sb)
        self.llm_signals["INST"] = self.llm.decide("INST", INST_SYSTEM, user_prompt, self.news_text, sb)
        self.llm_signals["RET"] = self.llm.decide("RET", RET_SYSTEM, user_prompt, self.news_text, sb)

        # 시장에 직접 주문흐름으로 주입(집단 행동 효과)
        inst = self.llm_signals["INST"]
        ret = self.llm_signals["RET"]
        self.order_flow += stance_to_signed_flow(inst["stance"], inst["intensity"], inst["confidence"], self.inst_scale)
        self.order_flow += stance_to_signed_flow(ret["stance"],  ret["intensity"],  ret["confidence"], self.ret_scale)

    def market_clear(self):
        # 정책 항
        rate_effect = self.interest_rate
        stimulus_effect = self.gov_stimulus

        delta_price = self.alpha * self.order_flow
        delta_price += (-self.beta * rate_effect) * self.price * 0.01
        delta_price += (self.gamma * stimulus_effect) * self.price * 0.01

        new_price = max(self.price + delta_price, 0.1)

        self.prev_price = self.price
        self.price = float(new_price)

        self.last_price_change = self.price - self.prev_price
        self.last_return = (self.last_price_change / self.prev_price) if self.prev_price > 0 else 0.0

        self.returns_window.append(self.last_return)
        if len(self.returns_window) > 30:
            self.returns_window.pop(0)
        self.rolling_vol = float(np.std(self.returns_window)) if len(self.returns_window) > 2 else 0.01

        self.order_flow = 0.0

    def step(self):
        # 1) 뉴스가 있을 때, N스텝마다 LLM이 반응 → 신호/주문흐름 주입
        self._maybe_run_llm()

        # 2) ABM 기본 루프
        self.schedule.step()

        # 3) 가격 결정
        self.market_clear()

        self.t += 1