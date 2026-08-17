import os
try:
    from dotenv import load_dotenv
except ImportError:  # 표준 라이브러리 기반 단위 테스트 지원
    def load_dotenv() -> bool:
        return False

# .env 파일을 읽어서 환경변수로 로드
load_dotenv()

# LLM 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 앞 모델이 실패하면 다음 모델을 한 번씩 시도한다.
SCORING_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]
FEEDBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
]

# 채점 설정
LLM_TEMPERATURE = 0
LLM_TIMEOUT_SECONDS = 15

# 데이터베이스 설정
# - 실제 실행: DATA_BACKEND=mongodb
# - 자동 테스트: DATA_BACKEND=memory
DATA_BACKEND = os.getenv("DATA_BACKEND", "mongodb").strip().lower()
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "anttitude_scenario")
MONGODB_CONNECT_TIMEOUT_MS = int(os.getenv("MONGODB_CONNECT_TIMEOUT_MS", "3000"))

# 시나리오 실행 기본값
DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "beta-user")
SCHEMA_VERSION = 1
EVALUATOR_VERSION = "beta-v3-cross-turn-coaching"

# 한국투자증권 과거 일봉 수집 설정
KIS_APP_KEY = os.getenv("KIS_APP_KEY", "")
KIS_APP_SECRET = os.getenv("KIS_APP_SECRET", "")
KIS_ENV = os.getenv("KIS_ENV", "real").strip().lower()
