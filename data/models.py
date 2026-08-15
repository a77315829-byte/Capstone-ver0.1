"""
채점 엔진 데이터 타입.
- 질문 기반 입력(a.txt 질문지) + 포트폴리오(분할 매매).
- 로직 없음, 데이터 계약만.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


# ─────────── 열거형 ───────────

class Action(str, Enum):
    BUY = "매수"
    SELL = "매도"
    HOLD = "관망"
    PARTIAL_SELL = "일부매도"


class MetricId(str, Enum):
    M1 = "M1"   # 핵심요인 식별
    M2 = "M2"   # 정보 해석
    M3 = "M3"   # 위험 인식
    M4 = "M4"   # 행동-근거 정합성
    M5 = "M5"   # 논리 일관성
    PORTFOLIO = "PORTFOLIO"

class CardStatus(str, Enum):
    SCORED = "SCORED"
    EMPTY_INPUT = "EMPTY_INPUT"
    MISSING_RUBRIC = "MISSING_RUBRIC"
    PARSE_FAILED = "PARSE_FAILED"


# ─────────── 입력: 사용자 판단 ───────────

@dataclass
class Holding:
    """분할 매매 한 건 (최종 배분 스냅샷)."""
    asset_id: str
    action: Action
    weight_pct: int


@dataclass
class QuestionAnswer:
    """질문 하나에 대한 사용자 답. 객관식은 선택지들, 자유서술은 text."""
    question_id: str            # "Q1","Q5",...
    selected: list[str] = field(default_factory=list)   # 고른 선택지들(객관식)
    text: str = ""              # 자유서술(Q39)용


@dataclass
class UserDecision:
    scenario_id: str
    turn_no: int
    holdings: list[Holding]                     # 여러 종목 (분할 매매)
    cash_pct: int                               # 남긴 현금 비중
    answers: list[QuestionAnswer]               # 이 턴 질문들에 대한 답

    def is_empty(self) -> bool:
        no_trade = (not self.holdings) or all(h.action == Action.HOLD for h in self.holdings)
        no_answer = (not self.answers) or all(
            not a.selected and not a.text.strip() for a in self.answers
        )
        return no_trade and no_answer


# ─────────── 출력: 채점 결과 ───────────

@dataclass
class Penalty:
    """감점 하나. 근거를 항상 들고 있다."""
    amount: float
    cause: str                  # 사유 코드
    evidence: str = ""          # 근거 설명(기준표에서 인용)


@dataclass
class MetricResult:
    metric: MetricId
    score: float                # 1~5
    penalties: list[Penalty] = field(default_factory=list)
    reason: str = ""


@dataclass
class TrapResult:
    trap_id: str
    triggered: bool
    explanation: str


@dataclass
class Scorecard:
    scenario_id: str
    turn_no: int
    status: CardStatus
    metrics: list[MetricResult] = field(default_factory=list)
    traps: list[TrapResult] = field(default_factory=list)
    turn_score: float = 0.0     # 코드가 계산 (LLM 아님)
    feedback: str = ""

@dataclass
class QuestionScore:
    """질문 하나의 채점 결과 (피드백 재료)."""
    question_id: str
    metric: str            # 이 질문이 기여하는 M축
    score: float           # 1~5
    picked: list[str]      # 사용자가 고른 것
    good_hit: list[str]    # 고른 것 중 정답
    trap_hit: list[str]    # 고른 것 중 함정
    note: str = ""         # 판정 근거(기준표에서)