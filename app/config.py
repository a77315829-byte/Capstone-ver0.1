from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # llm_provider="ollama"로 두면 OpenAI 유료 호출 없이 로컬 Ollama 모델로 테스트할 수 있다.
    llm_provider: Literal["openai", "ollama"] = "openai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5"

    mongo_uri: str
    mongo_db_name: str = "entitude"

    # 프론트엔드 dev 서버 오리진. 개발 단계라 넓게 허용 - 배포 시엔 실제 프론트 도메인으로 좁혀야 한다.
    cors_allow_origins: list[str] = ["*"]

    # 한국투자증권(KIS) 모의투자 Open API. 계좌번호(CANO)가 없는 구성 = 시세 조회 전용, 주문 실행 불가.
    kis_app_key: str = ""
    kis_app_secret: str = ""
    kis_base_url: str = "https://openapivts.koreainvestment.com:29443"  # 모의투자 도메인

    # 실시간 연동 대상 종목과 REST 폴링 주기. 프론트엔드 시연 종목(LG이노텍)에 맞춤.
    watch_symbols: list[str] = ["011070"]
    poll_interval_sec: int = 10

    # newsapi.org - 무료 플랜은 하루 100req 제한이라, 시세처럼 짧은 주기로 폴링하면 안 된다.
    # 기본 1800초(30분) = 하루 48회 호출로, 한도 대비 여유를 크게 남겨둔다.
    newsapi_api_key: str = ""
    news_poll_interval_sec: int = 1800

    # 트리거 임계치 (이벤트 발생 조건)
    price_move_threshold_pct: float = 0.5   # 가격 변동 0.5% 이상
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0

    # 요인 타입별 기본 가중치 (직접요인이 간접요인보다 판단에 더 크게 반영) - 데모 값, 실데이터로 튜닝 필요
    direct_factor_weight: float = 1.0
    indirect_factor_weight: float = 0.6

    # 판단 결정 임계치: (직접+간접 포함) 긍정-부정 net이 이 값 이하로 내려가면 관망/매도로 전환.
    # 여전히 실데이터 백테스트 값은 아니다(실 연동 후 재튜닝 필요) - 다만 이전 120/60은
    # rubric.py가 배치-상대 정규화(이번 실행 중 최댓값=100 기준)일 때 나온 값이라, 절대
    # 정규화(직접요인 raw_strength=1.0=100 기준)로 바뀐 지금 그대로 쓰면 sell에 도달하기
    # 훨씬 어려워진다. scripts/run_local.py의 기준 시나리오(직접부정 2건+간접부정 1건)로
    # 신/구 net을 비교하면 배율이 0.6875(=110/160)이므로, 기존 threshold가 의도했던
    # 민감도를 유지하도록 동일 배율로 재산정하고 2:1 비율은 그대로 유지했다
    # (120*0.6875=82.5→80, 60*0.6875=41.25→40).
    judge_sell_threshold: float = 80.0
    judge_hold_threshold: float = 40.0

    class Config:
        env_file = ".env"


settings = Settings()
