# fallback_rules.md — 룰 기반 Fallback 로직 명세

> **이 문서의 목적**
> Ollama 호출이 실패(타임아웃, 파싱 에러, 서버 다운)했을 때 각 모듈이 사용하는 **결정적(deterministic) fallback 로직**을 정의한다.
> Claude Code는 모든 LLM 호출 지점에 이 fallback을 반드시 구현해야 한다.
> fallback은 "그럴듯한 기본값"을 제공하는 것이 목적이며, LLM 수준의 분석을 대체하지는 않는다.

---

## 0. Fallback 트리거 조건

다음 중 하나가 발생하면 해당 모듈은 fallback으로 전환:

1. **LLM 연결 실패**: Ollama 서버 미응답 (`ConnectionError`, `ConnectTimeout`)
2. **응답 타임아웃**: `ollama_timeout_seconds` 초과
3. **JSON 파싱 실패**: 응답이 유효 JSON이 아님 (1회 재시도 후에도 실패)
4. **스키마 불일치**: 필수 필드 누락, enum 값 범위 벗어남

> 재시도는 **1회**. 같은 프롬프트로 재시도. 2회 연속 실패 → fallback.

---

## 1. 입력값 분류 Fallback (`validator.py`)

### 트리거
`classify_input()` LLM 호출 실패 시.
> 단, 룰 기반 1차 필터(길이, 반복문자, 욕설)는 LLM 무관하게 항상 동작.

### Fallback 로직

```python
def fallback_classify_input(stock_name: str, input_text: str) -> dict:
    """
    LLM 실패 시 키워드 기반 분류.
    정밀도는 떨어지지만 명백한 케이스를 처리.
    """
    text = input_text.strip()

    # 1. 직접 추천 요청 감지
    # 시장 반응 질문("오를까", "내릴까", "어떻게 반응할까", "어떤 영향이 있을까")은 허용.
    # 사용자의 투자 행동을 직접 결정해 달라는 요청만 거절.
    advice_keywords = ["지금 사야", "지금 팔아야", "매수해도", "매도해도", "매수할까", "매도할까",
                       "추천해", "매수 추천", "매도 추천", "지금 들어가야", "지금 나와야",
                       "사도 되", "팔아도 되"]
    if any(kw in text for kw in advice_keywords):
        return {
            "classification": "direct_advice",
            "input_type": "unknown",
            "reason": "직접적인 투자 추천 요청으로 판단됩니다."
        }

    # 2. 종목명 포함 여부로 관련성 판단
    if stock_name not in text:
        # 종목명이 없어도 산업 키워드가 있으면 허용
        industry_keywords = ["반도체", "HBM", "AI", "배터리", "자동차",
                            "바이오", "게임", "플랫폼", "조선", "에너지",
                            "금리", "환율", "원유", "실적", "매출"]
        has_industry = any(kw in text for kw in industry_keywords)
        if not has_industry:
            return {
                "classification": "low_relevance",
                "input_type": "unknown",
                "reason": "선택 종목과의 관련성을 확인할 수 없습니다."
            }

    # 3. 입력 유형 추론 (키워드 기반)
    input_type = "unknown"
    if any(kw in text for kw in ["라면", "한다면", "가정", "만약", "경우"]):
        input_type = "hypothetical_scenario"
    elif any(kw in text for kw in ["실적", "매출", "영업이익", "순이익", "분기"]):
        input_type = "company_information"
    elif any(kw in text for kw in ["수요", "공급", "산업", "시장", "업계", "투자 확대"]):
        input_type = "industry_information"
    elif any(kw in text for kw in ["금리", "환율", "원유", "원자재", "CPI", "GDP"]):
        input_type = "economic_market_event"
    else:
        input_type = "real_news"

    return {
        "classification": "valid",
        "input_type": input_type,
        "reason": "키워드 기반 자동 분류 (LLM fallback)"
    }
```

---

## 2. 외부 시장 맥락 분석 Fallback (`external_context.py`)

### 트리거
`analyze_external_context()` LLM 호출 실패 시.

### Fallback 로직

```python
def fallback_external_context(
    stock_name: str,
    input_text: str,
    input_type: str
) -> dict:
    """
    키워드 빈도 기반으로 영향 방향/강도 추정.
    정밀한 분석은 불가하지만 파이프라인을 중단시키지 않는다.
    """

    # 긍정/부정 키워드 카운트
    positive_kw = ["증가", "확대", "개선", "성장", "상승", "호조", "흑자",
                   "계약", "수주", "출시", "돌파", "최대", "신고가"]
    negative_kw = ["감소", "축소", "악화", "하락", "적자", "손실",
                   "규제", "제재", "소송", "리콜", "중단", "철수"]

    pos_count = sum(1 for kw in positive_kw if kw in input_text)
    neg_count = sum(1 for kw in negative_kw if kw in input_text)

    # 영향 방향
    if pos_count > neg_count:
        direction = "positive"
    elif neg_count > pos_count:
        direction = "negative"
    else:
        direction = "neutral"

    # 영향 강도 (키워드 합산 기반)
    total = pos_count + neg_count
    if total >= 4:
        strength = "high"
    elif total >= 2:
        strength = "medium"
    else:
        strength = "low"

    # 산업 추출 (간단한 키워드 매핑)
    industry_map = {
        "반도체": ["반도체", "HBM", "DRAM", "NAND", "파운드리", "메모리"],
        "AI 인프라": ["AI", "인공지능", "GPU", "서버", "데이터센터"],
        "2차전지": ["배터리", "2차전지", "리튬", "양극재", "음극재"],
        "자동차": ["자동차", "EV", "전기차", "자율주행"],
        "바이오": ["바이오", "제약", "신약", "임상"],
        "조선": ["조선", "LNG", "선박"],
    }

    related = []
    for industry, keywords in industry_map.items():
        if any(kw in input_text for kw in keywords):
            related.append(industry)

    if not related:
        related = ["기타"]

    # 시간 범위
    time_map = {
        "short_term": ["오늘", "내일", "이번 주", "단기", "즉시"],
        "long_term": ["장기", "3년", "5년", "10년", "구조적"],
    }
    time_horizon = "mid_term"  # 기본값
    for horizon, keywords in time_map.items():
        if any(kw in input_text for kw in keywords):
            time_horizon = horizon
            break

    # 사건 유형
    event_type_map = {
        "earnings": ["실적", "매출", "영업이익", "순이익"],
        "new_product": ["신제품", "출시", "발표"],
        "regulation": ["규제", "제재", "법안"],
        "industry_demand_increase": ["수요 증가", "수요 확대", "투자 확대"],
        "interest_rate_change": ["금리", "기준금리"],
        "exchange_rate_change": ["환율", "원달러"],
        "supply_chain": ["공급", "계약", "공급망"],
        "competition": ["경쟁사", "경쟁", "점유율"],
    }
    event_type = "other"
    for etype, keywords in event_type_map.items():
        if any(kw in input_text for kw in keywords):
            event_type = etype
            break

    return {
        "event_summary": f"{stock_name} 관련 {input_type} 분석 (자동 생성)",
        "event_type": event_type,
        "impact_direction": direction,
        "impact_strength": strength,
        "related_industries": related,
        "positive_factors": [f"{kw} 관련 긍정 요인" for kw in positive_kw if kw in input_text][:3] or ["정보 기반 긍정 요인 미검출"],
        "negative_factors": [f"{kw} 관련 부정 요인" for kw in negative_kw if kw in input_text][:3] or ["정보 기반 부정 요인 미검출"],
        "uncertainty_factors": ["LLM 분석 미수행으로 상세 불확실성 미평가", "사용자 입력 정보의 사실 여부 미확인"],
        "time_horizon": time_horizon
    }
```

---

## 3. 에이전트별 판단 초점 Fallback (`realtime_context.py`)

### 트리거
`agent_focus` 생성 LLM 호출 실패 시.

### Fallback 로직

```python
def fallback_agent_focus(impact_direction: str, price_reflection: str) -> dict:
    """
    영향 방향과 가격 반영 수준에 따른 정적 판단 초점.
    """
    if impact_direction == "positive":
        focus = {
            "individual": "테마 기대감과 뉴스 반응 확인",
            "institutional": "실적 개선 가능성 대비 밸류에이션 확인",
            "foreign": "글로벌 산업 흐름과의 부합 여부 확인",
            "short_term": "뉴스 모멘텀과 거래량 변화 확인",
            "long_term": "장기 실적 개선 지속 가능성 확인"
        }
    elif impact_direction == "negative":
        focus = {
            "individual": "공포 심리 확산 가능성 확인",
            "institutional": "리스크 확대 여부와 손절 기준 확인",
            "foreign": "글로벌 자금 이탈 가능성 확인",
            "short_term": "하락 모멘텀 강도와 반등 시점 확인",
            "long_term": "장기 투자 논리 훼손 여부 확인"
        }
    else:
        focus = {
            "individual": "추가 정보 확인 후 판단",
            "institutional": "현재 포지션 유지 여부 검토",
            "foreign": "글로벌 매크로 환경 변화 확인",
            "short_term": "방향성 확정 전 관망",
            "long_term": "기존 투자 논리 재점검"
        }

    if price_reflection == "high":
        focus["individual"] += " 및 추격 매수 위험 확인"
        focus["institutional"] += " 및 주가 선반영 여부 확인"
        focus["short_term"] += " 및 차익 실현·모멘텀 약화 가능성 확인"
        focus["long_term"] += " 및 단기 가격 움직임과 장기 가치 분리"

    return focus
```

---

## 4. 에이전트 반응 Fallback (`agents.py`) — 가장 중요

### 트리거
개별 에이전트 LLM 호출 실패 시. 5개 중 일부만 실패할 수 있으므로 **에이전트별 독립 fallback**.

### Fallback 전략

영향 방향(`impact_direction`)과 에이전트 유형에 따른 **정적 반응 매트릭스** 사용.

```python
# 에이전트별 기본 반응 매트릭스
# key: (impact_direction, agent_type)
# value: reaction_direction, reaction_strength, input_relevance 문자열, comment, key_reasons, risk_factors

FALLBACK_MATRIX = {
    # === POSITIVE ===
    ("positive", "individual_investor"): {
        "reaction_direction": "buy",
        "reaction_strength": "high",
        "input_relevance": "high",
        "key_reasons": ["테마 기대감", "뉴스 주목도"],
        "comment": "긍정적 뉴스에 따른 매수 관심이 높을 수 있습니다.",
        "risk_factors": ["단기 과열 가능성"]
    },
    ("positive", "institutional_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["실적 개선 가능성 확인 필요"],
        "comment": "긍정적이나 밸류에이션 확인이 필요합니다.",
        "risk_factors": ["밸류에이션 부담", "선반영 가능성"]
    },
    ("positive", "foreign_investor"): {
        "reaction_direction": "buy",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["글로벌 투자 흐름 부합"],
        "comment": "글로벌 트렌드에 부합하는 긍정적 정보입니다.",
        "risk_factors": ["환율 변동 리스크"]
    },
    ("positive", "short_term_investor"): {
        "reaction_direction": "buy",
        "reaction_strength": "high",
        "input_relevance": "high",
        "key_reasons": ["뉴스 모멘텀", "거래량 증가 기대"],
        "comment": "단기 모멘텀에 따른 매수 기회입니다.",
        "risk_factors": ["단기 변동성 확대"]
    },
    ("positive", "long_term_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["장기 성장 가능성"],
        "comment": "장기적으로 긍정적이나 지속성 확인이 필요합니다.",
        "risk_factors": ["장기 실적 지속성 불확실"]
    },

    # === NEGATIVE ===
    ("negative", "individual_investor"): {
        "reaction_direction": "sell",
        "reaction_strength": "high",
        "input_relevance": "high",
        "key_reasons": ["부정적 뉴스 확산", "공포 심리"],
        "comment": "부정적 뉴스에 따른 매도 심리가 강할 수 있습니다.",
        "risk_factors": ["과매도 가능성"]
    },
    ("negative", "institutional_investor"): {
        "reaction_direction": "sell",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["리스크 확대", "실적 악화 우려"],
        "comment": "리스크 관리 차원에서 비중 축소를 검토합니다.",
        "risk_factors": ["추가 악재 가능성"]
    },
    ("negative", "foreign_investor"): {
        "reaction_direction": "sell",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["글로벌 리스크 회피"],
        "comment": "부정적 정보에 따른 자금 이탈 가능성이 있습니다.",
        "risk_factors": ["신흥국 자금 유출"]
    },
    ("negative", "short_term_investor"): {
        "reaction_direction": "sell",
        "reaction_strength": "high",
        "input_relevance": "high",
        "key_reasons": ["하락 모멘텀", "손절 기준 도달"],
        "comment": "하락 모멘텀에 따른 빠른 대응이 필요합니다.",
        "risk_factors": ["반등 시 손실 확대"]
    },
    ("negative", "long_term_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "low",
        "input_relevance": "low",
        "key_reasons": ["단기 악재는 장기 영향 제한적"],
        "comment": "장기 투자 논리가 유지되는지 확인합니다.",
        "risk_factors": ["구조적 악화 가능성"]
    },

    # === NEUTRAL ===
    ("neutral", "individual_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "low",
        "input_relevance": "low",
        "key_reasons": ["뚜렷한 방향성 없음"],
        "comment": "추가 정보를 기다리는 관망 구간입니다.",
        "risk_factors": ["방향성 불명확"]
    },
    ("neutral", "institutional_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["현재 포지션 유지"],
        "comment": "중립적 정보로 기존 판단을 유지합니다.",
        "risk_factors": ["예상과 다른 전개 가능성"]
    },
    ("neutral", "foreign_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "low",
        "input_relevance": "low",
        "key_reasons": ["매크로 환경 관찰"],
        "comment": "추가 매크로 데이터 확인이 필요합니다.",
        "risk_factors": ["환율 변동"]
    },
    ("neutral", "short_term_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "low",
        "input_relevance": "low",
        "key_reasons": ["명확한 트리거 없음"],
        "comment": "뚜렷한 진입 시그널이 없는 구간입니다.",
        "risk_factors": ["급변 가능성"]
    },
    ("neutral", "long_term_investor"): {
        "reaction_direction": "hold",
        "reaction_strength": "medium",
        "input_relevance": "normal",
        "key_reasons": ["기존 투자 논리 유지"],
        "comment": "장기 투자 관점에서 큰 변화는 없습니다.",
        "risk_factors": ["거시 환경 변화 가능성"]
    },
}


def build_fallback_agent_output(
    agent_type: str,
    base_weight: float,
    standard_input: dict
) -> dict:
    """
    LLM 실패 시 정적 매트릭스에서 에이전트 반응 생성.
    """
    direction = standard_input.get("impact_direction", "neutral")
    key = (direction, agent_type)

    fallback = FALLBACK_MATRIX.get(key)
    if fallback is None:
        # 매트릭스에도 없는 예외 케이스
        fallback = {
            "reaction_direction": "hold",
            "reaction_strength": "low",
            "input_relevance": "normal",
            "key_reasons": ["분석 정보 부족"],
            "comment": "추가 정보 확인이 필요합니다.",
            "risk_factors": ["분석 불확실성"]
        }

    relevance_map = {
        "low": 0.8,
        "normal": 1.0,
        "high": 1.2,
    }
    fallback = {
        **fallback,
        "input_relevance": relevance_map.get(fallback.get("input_relevance", "normal"), 1.0),
    }

    return {
        "agent_type": agent_type,
        "base_weight": base_weight,
        **fallback
    }
```

---

## 5. 종합 해설 Fallback (`summary.py`)

### 트리거
`generate_summary()` LLM 호출 실패 시.

### Fallback 로직

에이전트 반응과 시장 분위기를 기반으로 **템플릿 조합**.

```python
def fallback_summary(
    stock_name: str,
    event_summary: str,
    agents: list[dict],
    pressure: dict,
    sentiment: dict,
    uncertainty_factors: list[str]
) -> str:
    """
    정적 템플릿 기반 종합 해설 생성.
    """

    # 매수/매도/관망 에이전트 분류
    buy_agents = [a for a in agents if a["reaction_direction"] == "buy"]
    sell_agents = [a for a in agents if a["reaction_direction"] == "sell"]
    hold_agents = [a for a in agents if a["reaction_direction"] == "hold"]

    # 에이전트 이름 매핑
    name_map = {
        "individual_investor": "개인 투자자",
        "institutional_investor": "기관 투자자",
        "foreign_investor": "외국인 투자자",
        "short_term_investor": "단기 투자자",
        "long_term_investor": "장기 투자자"
    }

    # 분위기별 첫 문장 템플릿
    sentiment_templates = {
        "very_positive": f"입력된 정보는 {stock_name}에 매우 강한 긍정적 반응을 유도할 가능성이 높습니다.",
        "positive": f"입력된 정보는 {stock_name}에 전반적으로 긍정적인 반응을 유도할 가능성이 높습니다.",
        "neutral": f"입력된 정보는 {stock_name}에 대해 뚜렷한 방향성 없이 엇갈린 반응을 유도할 수 있습니다.",
        "negative": f"입력된 정보는 {stock_name}에 부정적인 반응을 유도할 가능성이 있습니다.",
        "very_negative": f"입력된 정보는 {stock_name}에 강한 부정적 반응을 유도할 가능성이 높습니다.",
        "uncertain": f"입력된 정보에 대해 시장참여자들의 판단이 유보적인 상태입니다."
    }

    first_sentence = sentiment_templates.get(
        sentiment["code"],
        f"입력된 정보에 대한 {stock_name}의 시장 반응을 분석하였습니다."
    )

    # 두번째 문장: 에이전트 반응 요약
    parts = []
    if buy_agents:
        names = ", ".join([name_map.get(a["agent_type"], a["agent_type"]) for a in buy_agents])
        parts.append(f"{names}은(는) 매수 성향을 보일 수 있으며")
    if hold_agents:
        names = ", ".join([name_map.get(a["agent_type"], a["agent_type"]) for a in hold_agents])
        parts.append(f"{names}은(는) 관망 태도를 보일 수 있습니다")
    if sell_agents:
        names = ", ".join([name_map.get(a["agent_type"], a["agent_type"]) for a in sell_agents])
        parts.append(f"{names}은(는) 매도 성향을 보일 수 있습니다")

    second_sentence = ", ".join(parts) + "."
    if not parts:
        second_sentence = "시장참여자들의 반응이 혼재되어 있습니다."

    # 세번째 문장: 불확실성 안내
    if uncertainty_factors:
        uf_text = ", ".join(uncertainty_factors[:3])
        third_sentence = f"사용자는 {uf_text} 등 주요 불확실성 요소를 함께 고려하여 모의투자 판단을 수행할 필요가 있습니다."
    else:
        third_sentence = "사용자는 주요 불확실성 요소를 함께 고려하여 모의투자 판단을 수행할 필요가 있습니다."

    return f"{first_sentence} {second_sentence} {third_sentence}"
```

---

## 6. 전체 파이프라인 에러 처리 흐름

```
POST /simulate
  │
  ├─ validate_input
  │   ├─ 룰 기반 필터 → 실패 시 422 즉시 반환 (fallback 불필요)
  │   └─ LLM 분류 → 실패 시 fallback_classify_input()
  │
  ├─ analyze_external_context
  │   └─ LLM 호출 → 실패 시 fallback_external_context()
  │
  ├─ analyze_realtime_context
  │   ├─ 시세 stub → 실패 시 DEFAULT_STOCK_DATA 사용
  │   └─ agent_focus LLM → 실패 시 fallback_agent_focus()
  │
  ├─ integrate() → 순수 함수, 실패 없음
  │
  ├─ run_all_agents (asyncio.gather)
  │   ├─ agent 1 → 성공 또는 fallback
  │   ├─ agent 2 → 성공 또는 fallback
  │   ├─ agent 3 → 성공 또는 fallback
  │   ├─ agent 4 → 성공 또는 fallback
  │   └─ agent 5 → 성공 또는 fallback
  │   (각 에이전트 독립 fallback. 전체가 실패해도 파이프라인 계속)
  │
  ├─ compute_market_pressure → 순수 함수, 실패 없음
  ├─ compute_sentiment → 순수 함수, 실패 없음
  ├─ build_confidence → 순수 함수, 실패 없음
  │
  ├─ generate_summary
  │   └─ LLM 호출 → 실패 시 fallback_summary()
  │
  ├─ persist → DB 저장 실패 시 로그 기록, 응답은 정상 반환
  │
  └─ return 200 + JSON
```

> **원칙**: LLM 실패는 파이프라인을 중단시키지 않는다. 모든 LLM 호출 지점에 fallback이 있으므로 Ollama가 완전히 죽어 있어도 200 응답은 반환된다. 단, 출력 품질이 떨어진다.

---

## 7. Fallback 사용 여부 표시

최종 응답 JSON에 fallback 사용 여부를 표시하여 디버깅/모니터링 지원:

```json
{
  "meta": {
    "llm_model": "llama3.1:8b",
    "llm_status": "partial_failure",
    "fallback_used": true,
    "fallback_modules": ["external_context", "agent:institutional_investor"],
    "stock_data_source": "stub",
    "db_save_status": "saved"
  }
}
```

이 `meta` 필드를 최종 응답의 최상위에 추가한다.
`fallback_used`가 `false`이면 `fallback_modules`는 빈 배열, `llm_status`는 `"ok"`.
허용 상태값은 `llm_status`: `"ok"`, `"partial_failure"`, `"fallback"` / `db_save_status`: `"saved"`, `"failed"`이다. Ollama가 완전히 꺼져 fallback만으로 완료된 경우 `fallback_used=true`, `llm_status="fallback"`을 사용한다.
`llm_status`는 LLM fallback 모듈이 없으면 `"ok"`, 일부 LLM 모듈만 fallback이면 `"partial_failure"`, 모든 LLM 호출 모듈(`validator`, `external_context`, `agent_focus`, 5개 `agent:{agent_type}`, `summary`)이 fallback이면 `"fallback"`이다.

---

## 8. 시세 Stub 실패 시 기본값

`stock_data.py`의 시세 조회가 실패(외부 API 미연동 상태)할 경우:

```python
DEFAULT_STOCK_DATA = {
    "current_price": 50000,
    "daily_change_rate": 0.0,
    "volume_trend": "stable",
    "data_source": "stub",
    "is_realtime": False,
    "observed_at": None,
}
```

> 시세 stub 자체가 아직 고정값을 반환하는 단계이므로, stub 내부 에러는 발생 가능성이 낮지만 방어 코드는 넣는다.
> Stub 시세 사용 시 분석 신뢰도에서 Stub 데이터 감점을 적용한다. 실제 시세 연동 시 `data_source="external_api"`로 표시한다.

---

## 9. DB 저장 실패 시

```python
try:
    await repository.save_simulation(result)
except Exception as e:
    logger.error(f"DB save failed: {e}")
    # 저장 실패해도 사용자 응답은 정상 반환
    # meta.db_save_status = "failed" 추가
```

> DB 저장 실패는 사용자 경험에 영향 없어야 한다. 시뮬레이션 결과는 이미 계산 완료 상태.
