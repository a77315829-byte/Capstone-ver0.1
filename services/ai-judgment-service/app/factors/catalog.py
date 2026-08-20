from app.models.db_models import FactorCatalogEntry

# 빌드 타임에 1회 정의하는 요인 카탈로그.
# 실시간 데이터가 들어올 때마다 이 정의를 기준으로 자동 인스턴스화된다 (사람 개입 없음).
#
# 전부 이 종목 자체의 시세/수급 시계열에서 계산되는 기술적 지표라, 요인을
# 별도 타입으로 구분하지 않고 모두 동등한 TSK 규칙으로 다룬다. direction은
# 이 신호가 매수 쪽(긍정)인지 매도 쪽(부정)인지를 나타내며, fuzzy_judge.py가
# 매수/매도 퍼지 소속도를 계산하는 데 쓰인다.
FACTOR_CATALOG: list[FactorCatalogEntry] = [
    {
        "factor_id": "foreign_sell_flip",
        "direction": "부정",
        "feature_key": "foreign_net_flow",
        "description": "외국인 순매도 전환",
        "rule": "foreign_net_flow가 3일 연속 양수에서 음수로 전환",
    },
    {
        "factor_id": "foreign_buy_flip",
        "direction": "긍정",
        "feature_key": "foreign_net_flow",
        "description": "외국인 순매수 전환",
        "rule": "foreign_net_flow가 3일 연속 음수에서 양수로 전환",
    },
    {
        "factor_id": "rsi_overbought_exit",
        "direction": "부정",
        "feature_key": "rsi_14",
        "description": "RSI 과매수 이탈",
        "rule": "rsi_14가 70 이상에서 70 미만으로 하락",
    },
    {
        "factor_id": "rsi_oversold_exit",
        "direction": "긍정",
        "feature_key": "rsi_14",
        "description": "RSI 과매도 이탈",
        "rule": "rsi_14가 30 미만에서 30 이상으로 상승",
    },
    {
        "factor_id": "volume_surge_up",
        "direction": "긍정",
        "feature_key": "volume_ratio",
        "description": "거래량 급증 (상승)",
        "rule": "거래량이 평균 대비 N배 이상 증가하고 당일 주가 상승",
    },
    {
        "factor_id": "volume_surge_down",
        "direction": "부정",
        "feature_key": "volume_ratio",
        "description": "거래량 급증 (하락)",
        "rule": "거래량이 평균 대비 N배 이상 증가하고 당일 주가 하락",
    },
    {
        "factor_id": "golden_cross",
        "direction": "긍정",
        "feature_key": "ma_cross",
        "description": "단기/장기 이동평균 골든크로스",
        "rule": "단기 이동평균이 장기 이동평균을 상향 돌파",
    },
    {
        "factor_id": "dead_cross",
        "direction": "부정",
        "feature_key": "ma_cross",
        "description": "단기/장기 이동평균 데드크로스",
        "rule": "단기 이동평균이 장기 이동평균을 하향 돌파",
    },
    {
        "factor_id": "week52_high",
        "direction": "긍정",
        "feature_key": "price_52w_extreme",
        "description": "52주 신고가 갱신",
        "rule": "종가가 최근 52주 최고가를 상회",
    },
    {
        "factor_id": "week52_low",
        "direction": "부정",
        "feature_key": "price_52w_extreme",
        "description": "52주 신저가 갱신",
        "rule": "종가가 최근 52주 최저가를 하회",
    },
    {
        "factor_id": "sector_weakness",
        "direction": "부정",
        "feature_key": "sector_index_change",
        "description": "IT 섹터 전반 약세",
        "rule": "동일 섹터 지수가 당일 -1% 이상 하락",
    },
    {
        "factor_id": "sector_strength",
        "direction": "긍정",
        "feature_key": "sector_index_change",
        "description": "IT 섹터 전반 강세",
        "rule": "동일 섹터 지수가 당일 +1% 이상 상승",
    },
]


def get_catalog() -> list[FactorCatalogEntry]:
    return FACTOR_CATALOG


def get_factor_by_id(factor_id: str) -> FactorCatalogEntry | None:
    return next((f for f in FACTOR_CATALOG if f["factor_id"] == factor_id), None)
