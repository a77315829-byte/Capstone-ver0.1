# Market Reaction Simulator (신규)

- 이 폴더는 신규 시장 반응 시뮬레이션 FastAPI 서비스를 위한 위치입니다.
- 기존 `simulator/archive/simulator_hyunwoo/`와 별개의 신규 구현입니다.
- 세부 구현은 `docs/` 명세를 기준으로 단계적으로 진행합니다.

## 저장 정책 (중요)

- 이 서비스는 **저장소를 가지지 않는 stateless 분석 서비스**입니다. (SQLite/MongoDB 등 자체 DB 없음)
- 구현 목표는 `POST /simulate` 요청을 받아 **분석 결과 JSON을 반환**하는 것입니다.
- **결과 저장은 현재 Python 서비스의 범위가 아니며**, 후속 단계에서 **Node backend + MongoDB** 연동으로 처리할 예정입니다.
- 따라서 응답의 `meta.db_save_status`는 현재 Python 서비스에서 `"not_used"`를 사용합니다.
- `GET /simulations/{simulation_id}`는 현재 저장소가 없으므로 `501 Not Implemented`(또는 명확한 not implemented 응답)로 처리할 예정입니다.

## 현재 단계 범위

- 포함: FastAPI skeleton, schemas, 계산 로직, fallback, LLM 파이프라인
- 제외: DB 저장/조회(repository), Node server 연동, React frontend 연동
