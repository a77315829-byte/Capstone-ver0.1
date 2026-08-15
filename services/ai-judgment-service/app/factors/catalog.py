from app.models.db_models import FactorCatalogEntry

# 빌드 타임에 1회 정의하는 요인 카탈로그.
# 실시간 데이터가 들어올 때마다 이 정의를 기준으로 자동 인스턴스화된다 (사람 개입 없음).
#
# 직접/간접 분류 기준:
#   직접 = 해당 종목 고유 시계열(가격/수급/기술지표)에서 즉시 관측되는 신호
#   간접 = 종목 외부(섹터/거시/뉴스 감성)에서 파생되는 신호
# direction은 이 신호가 매수 쪽(긍정)인지 매도 쪽(부정)인지를 나타내며,
# judge.py가 (직접+간접 모두 포함해) positive/negative net을 계산하는 데 쓰인다.
FACTOR_CATALOG: list[FactorCatalogEntry] = [
    {
        "factor_id": "foreign_sell_flip",
        "type": "직접",
        "direction": "부정",
        "feature_key": "foreign_net_flow",
        "description": "외국인 순매도 전환",
        "rule": "foreign_net_flow가 3일 연속 양수에서 음수로 전환",
    },
    {
        "factor_id": "foreign_buy_flip",
        "type": "직접",
        "direction": "긍정",
        "feature_key": "foreign_net_flow",
        "description": "외국인 순매수 전환",
        "rule": "foreign_net_flow가 3일 연속 음수에서 양수로 전환",
    },
    {
        "factor_id": "rsi_overbought_exit",
        "type": "직접",
        "direction": "부정",
        "feature_key": "rsi_14",
        "description": "RSI 과매수 이탈",
        "rule": "rsi_14가 70 이상에서 70 미만으로 하락",
    },
    {
        "factor_id": "rsi_oversold_exit",
        "type": "직접",
        "direction": "긍정",
        "feature_key": "rsi_14",
        "description": "RSI 과매도 이탈",
        "rule": "rsi_14가 30 미만에서 30 이상으로 상승",
    },
    {
        "factor_id": "sector_weakness",
        "type": "간접",
        "direction": "부정",
        "feature_key": "sector_index_change",
        "description": "IT 섹터 전반 약세",
        "rule": "동일 섹터 지수가 당일 -1% 이상 하락",
    },
    {
        "factor_id": "sector_strength",
        "type": "간접",
        "direction": "긍정",
        "feature_key": "sector_index_change",
        "description": "IT 섹터 전반 강세",
        "rule": "동일 섹터 지수가 당일 +1% 이상 상승",
    },
    {
        "factor_id": "news_sentiment_negative",
        "type": "간접",
        "direction": "부정",
        "feature_key": "news_sentiment_score",
        "description": "뉴스 감성 부정",
        "rule": "뉴스 기사가 이 카테고리로 분류되고 sentiment_score < 0 (LLM 분류 결과)",
    },
    {
        "factor_id": "news_sentiment_positive",
        "type": "간접",
        "direction": "긍정",
        "feature_key": "news_sentiment_score",
        "description": "뉴스 감성 긍정",
        "rule": "뉴스 기사가 이 카테고리로 분류되고 sentiment_score > 0 (LLM 분류 결과)",
    },
]


def get_catalog() -> list[FactorCatalogEntry]:
    return FACTOR_CATALOG


def get_factor_by_id(factor_id: str) -> FactorCatalogEntry | None:
    return next((f for f in FACTOR_CATALOG if f["factor_id"] == factor_id), None)
