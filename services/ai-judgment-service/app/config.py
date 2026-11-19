from typing import Literal
from urllib.parse import quote

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 통합 저장소에서는 server/.env의 Atlas 계정 정보를 재사용하고, 서비스별 .env가
    # provider·DB 이름·명시적 MONGO_URI를 덮어쓸 수 있게 한다.
    model_config = SettingsConfigDict(
        env_file=("../../server/.env", ".env"),
        extra="ignore",
    )

    # llm_provider="ollama"로 두면 OpenAI 유료 호출 없이 로컬 Ollama 모델로 테스트할 수 있다.
    llm_provider: Literal["openai", "ollama"] = "openai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3.5:4b"

    mongo_uri: str = ""
    mongo_db_name: str = "anttitude_ai_judgment"
    stotra_mongodb_username: str = ""
    stotra_mongodb_password: str = ""
    stotra_mongodb_cluster: str = ""

    @model_validator(mode="after")
    def resolve_mongo_uri(self):
        if self.mongo_uri:
            return self
        if (
            self.stotra_mongodb_username
            and self.stotra_mongodb_password
            and self.stotra_mongodb_cluster
        ):
            username = quote(self.stotra_mongodb_username, safe="")
            password = quote(self.stotra_mongodb_password, safe="")
            cluster = self.stotra_mongodb_cluster.strip()
            self.mongo_uri = (
                f"mongodb+srv://{username}:{password}@{cluster}/"
                "?authMechanism=DEFAULT&retryWrites=true&w=majority"
            )
            return self
        self.mongo_uri = "mongodb://127.0.0.1:27017"
        return self

    # 프론트엔드 dev 서버 오리진. 개발 단계라 넓게 허용 - 배포 시엔 실제 프론트 도메인으로 좁혀야 한다.
    cors_allow_origins: list[str] = ["*"]

    # 한국투자증권(KIS) 모의투자 Open API. 계좌번호(CANO)가 없는 구성 = 시세 조회 전용, 주문 실행 불가.
    kis_app_key: str = ""
    kis_app_secret: str = ""
    kis_base_url: str = "https://openapivts.koreainvestment.com:29443"  # 모의투자 도메인

    # 고정 5종목 + 패널의 임시 구독. 장중 시세 조회는 기본 60초 간격이다.
    always_watch_symbols: list[str] = Field(
        default_factory=lambda: ["005930", "000660", "005380", "035420", "035720"],
        max_length=10,
    )
    poll_interval_sec: int = Field(default=60, ge=10, le=3600)
    krx_closed_dates: str = ""

    @field_validator("always_watch_symbols")
    @classmethod
    def validate_watch_symbols(cls, symbols: list[str]) -> list[str]:
        import re
        if any(not re.fullmatch(r"\d[A-Z0-9]{5}", symbol) for symbol in symbols):
            raise ValueError("상시 감시에는 국내 종목 코드만 지정할 수 있습니다")
        return list(dict.fromkeys(symbols))

    # 구독 하트비트 TTL(초) - 프론트가 이 시간 안에 /watch를 다시 호출하지 않으면
    # (화면 이탈, 브라우저 종료 등) 감시 대상에서 자동으로 빠진다. 프론트의 하트비트
    # 주기보다 여유 있게 길어야 한다 - 데모 값, 프론트 폴링 주기 확정 후 재조정 필요.
    watch_ttl_sec: float = 60.0

    # 트리거 임계치 (이벤트 발생 조건) - 전부 데모 값, 실데이터로 튜닝 필요
    price_move_threshold_pct: float = 0.5   # 가격 변동 0.5% 이상
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0
    volume_surge_ratio: float = 2.0         # 거래량이 평균 대비 2배 이상이면 급증으로 판정

    # 같은 종목에 대한 판단 파이프라인 재실행 최소 간격(초). 트리거가 짧은 시간에
    # 연달아 발동해도 이 시간 안에는 재실행하지 않는다 - 데모 값, 튜닝 필요.
    trigger_cooldown_sec: float = 300.0

    # 퍼지 판정(fuzzy_judge.py)의 TSK 가중평균에서 "관망"을 나타내는 고정 규칙의
    # 발동강도. 다른 요인의 raw_strength(0~1)와 같은 단위이며, 결론값은 0(중립)으로
    # 고정된다. 매수/매도 요인이 없으면 이 값만 분모에 남아 관망 100%가 되고,
    # 요인의 발동강도 총합이 이 값보다 커질수록 관망의 상대적 비중이 옅어진다 -
    # 데모 값, 실데이터로 튜닝 필요. 0.5에서 0.3으로 낮춰 관망 쪽으로 쏠리던
    # 편향을 줄였다(요인 하나가 raw_strength 0.3 정도만 발동해도 매수/매도가
    # 관망과 동률까지 갈 수 있는 무게).
    fuzzy_hold_baseline: float = 0.3

    # TSK 가중평균(net)을 매수/매도/관망 3-way 확률로 바꾸는 마지막 단계의 softmax
    # 온도. net을 그대로 max(0, net)/max(0, -net)으로 하드 클리핑하면 둘 중 하나가
    # 항상 정확히 0%가 되는 문제가 있어(논문 10절 한계), 대신 세 raw score를
    # softmax에 통과시켜 항상 세 값이 연속 분포하도록 완화한다. 값이 작을수록
    # 원래의 하드 클리핑에 가깝게 날카로워지고, 클수록 균등분포에 가까워진다 -
    # 데모 값, 실데이터로 튜닝 필요.
    softmax_temperature: float = 30.0

    # 이전 이력과 라벨이 같아도, 매수/매도/관망 확률 중 하나라도 이 값(%p) 이상
    # 움직였으면 "변경"으로 기록한다 - 데모 값, 튜닝 필요.
    judge_change_threshold_pct: float = 15.0

settings = Settings()
