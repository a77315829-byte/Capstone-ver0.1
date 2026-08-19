# 과거시장시뮬(market_reaction) RAG 저장소 MongoDB 이전 결과보고

- 대상 서비스: `simulator/market_reaction` (Market Reaction Simulator — 과거 공시/뉴스 기반 시장 반응 분석)
- 작성일: 2026-08-19
- 작성자: 현우
- 관련 문서: `docs/superpowers/specs/2026-08-14-market-reaction-rag-mongodb-design.md`(설계),
  `docs/superpowers/plans/2026-08-14-market-reaction-rag-mongodb.md`(구현 계획)

## 1. 요약

과거시장시뮬은 종목별 참고문서 검색(RAG)으로 DART(한국 공시)·SEC EDGAR(미국 공시)
문서를 검색해 LLM 분석 프롬프트에 근거 자료로 붙여준다. 기존에는 이 RAG 데이터(벡터
인덱스 + 문서 청크)가 **서버 로컬 디스크 파일**로만 존재해 배포 시 유실되고 팀/여러
서버 인스턴스 간 공유가 안 됐다. 이번 작업으로 저장소를 **MongoDB**(server가 쓰는
것과 동일한 Atlas 클러스터)로 이전하고, 실제 40종목 데이터까지 적재 완료했다.

- 구현: 8단계 계획 + TDD, 단계별 코드 리뷰 + 최종 전체 리뷰 완료
- 테스트: 247개 전부 통과
- 배포: `main` 브랜치 merge + push 완료
- 데이터: 한국 20종목(DART) + 미국 20종목(EDGAR), 39,145개 청크, MongoDB Atlas에 실제 적재 완료
- 저장 용량: 254.3MB / 512MB(Atlas 무료 티어 한도) — 임베딩을 float32 압축 포맷으로
  저장해 애초 추산 대비 절반 이하로 줄임(4번 참고)

## 2. 배경 / 문제

기존 구조(2026-08-11 1차 구현):

```
scripts/build_rag_index.py (수동 실행)
  → DART/EDGAR 문서 수집·청킹·임베딩 → 종목별 FAISS 인덱스 파일 + JSON 메타데이터를
    로컬 디스크(data/rag_index/)에 저장

app/services/document_retrieval.py (런타임)
  → 로컬 디스크에서 FAISS 인덱스 파일을 읽어 검색
```

문제점:
- 서버가 재배포되면 로컬 디스크 내용이 사라져 매번 DART/EDGAR 재수집이 필요했음
- 인덱스를 만든 사람의 로컬 컴퓨터에만 있어 팀원/다른 서버 인스턴스가 공유 못 함
- `server`가 이미 MongoDB Atlas를 쓰고 있는데 RAG 데이터만 별도 저장 방식이라 백업/
  버전관리 지점이 하나 더 필요했음

## 3. 한 일 — 아키텍처

RAG 데이터의 **영속 저장소를 MongoDB로 이전**하고, FAISS는 **런타임 검색 캐시**로만
남기는 구조로 재설계했다.

```
scripts/build_rag_index.py (오프라인 배치, 수동 실행)
  DART/EDGAR 수집 → 청킹 → bge-m3 임베딩(Ollama 로컬)
  → 종목 단위 "restart-safe versioned rebuild"로 MongoDB 저장 (5번 참고)

MongoDB (server와 동일 Atlas 클러스터/DB, 새 컬렉션 2개)
  rag_chunks     청크 텍스트 + 메타데이터 + 임베딩 벡터 (문서 1건 = 청크 1개)
  rag_manifest   종목별 최신 빌드 정보(버전, 임베딩 모델/차원, 청크 수, 빌드 시각)

app/services/document_retrieval.py (런타임, /simulate 요청마다)
  query_text 임베딩
  → FaissVectorStore.search(stock_code, query_vector, top_k)
     cache hit  → 메모리에 이미 있는 FAISS 인덱스로 바로 검색 (MongoDB 접근 없음)
     cache miss → RagRepository로 해당 종목 청크+임베딩을 MongoDB에서 읽어와
                  FAISS 인덱스를 메모리에 새로 만들고 캐시에 저장
  → 유사도 순 청크를 글자수 예산(4000자) 내에서 선택해 반환
```

핵심 설계 포인트:
- **저장소(RagRepository)와 검색 캐시(FaissVectorStore)를 분리**했다. 검색은 항상
  메모리 상의 FAISS로 하고, MongoDB는 종목이 처음 검색될 때(cache miss)만 접근한다 →
  요청마다 DB를 치지 않아 성능 영향이 없다.
- 향후 다른 검색 엔진(예: MongoDB Atlas Vector Search)으로 교체할 수 있도록
  `VectorStore` 프로토콜로 추상화해 뒀다(이번 범위에서는 FAISS 구현체만 존재).
- 실패 시 항상 빈 리스트를 반환하고 예외를 던지지 않는 기존 계약을 그대로 유지했다
  (MongoDB 연결 실패, 데이터 없음, 임베딩 모델/차원 불일치 등 모두 동일하게 처리).

## 4. 저장 용량 최적화 (float32 압축)

임베딩 벡터(1024차원)를 Python 기본 실수 타입(float64) 리스트로 저장하면 BSON 배열
오버헤드까지 겹쳐 문서 하나가 약 16.4KB였다(그중 80%가 임베딩 필드). 40종목 전체를
이 포맷으로 저장하면 약 600MB로 추산되어, 지금 쓰고 있는 MongoDB Atlas **무료(M0,
512MB 한도)** 티어를 초과할 상황이었다.

해결: 임베딩을 **float32로 packing한 바이너리(`bson.Binary`)**로 저장하도록 변경.

- 문서당 임베딩 필드: 13.2KB → 4.1KB (69% 감소)
- 문서 전체 평균 크기: 16.4KB → 6.8KB (58% 감소)
- **정확도 영향 없음**: FAISS 인덱스는 애초에 검색 시점에 float32로 변환해서 코사인
  유사도를 계산한다(`rag_index.py`의 `build_index()`가 `dtype="float32"`로 변환).
  즉 지금까지도 실제 검색은 float32 정밀도로 하고 있었고, MongoDB에만 쓸데없이
  float64로 저장하고 있었을 뿐이다. 저장 포맷을 검색 시점 정밀도에 맞춘 것뿐이라
  검색 결과는 단 하나도 달라지지 않는다.

이 최적화 덕분에 40종목 39,145개 청크를 전부 저장하고도 **254.3MB(한도의 49.7%)**에
그쳐, 여유 있게 free tier 안에서 운영 가능하다.

## 5. Restart-safe versioned rebuild

인덱스 재구축 스크립트(`build_rag_index.py`)는 "idempotent"(재실행해도 항상 같은
결과)가 아니라, **재실행마다 버전이 증가하며 중간 실패 후 재실행해도 중복·손상 없이
복구되는** 절차로 만들었다. 종목별로:

1. 현재 버전 확인 → 새 버전 번호 결정
2. (이전 실행이 이 새 버전으로 쓰다 죽어서 남긴 잔여 데이터가 있으면 먼저 정리)
3. 새 청크 저장
4. 매니페스트를 새 버전으로 갱신 — 이 시점부터 서비스가 새 버전을 봄
5. 구버전 데이터 정리

이 순서 덕분에 스크립트가 어느 단계에서 죽어도 서비스에 지장이 없고, 재실행하면
자동으로 정상 상태로 수렴한다(자세한 검증은 관련 plan/spec 문서 참고).

## 6. 검증

- **단위/통합 테스트**: 8개 구현 단계 각각 TDD로 작성, 총 247개 테스트 전부 통과
  (`pytest tests -v`)
- **코드 리뷰**: 8단계 각각 spec 준수·코드 품질 리뷰 + 최종 전체 브랜치 리뷰 진행,
  발견된 이슈(누락된 MongoDB 인덱스, 저장소 용량, 에러 처리 등) 전부 수정
- **실제 Atlas 연동 스모크 테스트**: 실제 MongoDB Atlas에 연결해 종목 검색 정상 동작
  확인 (예: `005930` 검색 시 실제 저장된 공시 문서 2건 반환)
- **실제 데이터 적재**: 한국 20종목 + 미국 20종목 전체를 대상으로 DART/EDGAR 수집 →
  청킹 → bge-m3 임베딩 → MongoDB 저장까지 전체 파이프라인을 실행해 39,145개 청크
  적재 완료, 에러 없음

## 7. 배포 상태

- `main` 브랜치에 merge 완료, `origin/main`에 push 완료
- MongoDB Atlas에 실제 40종목 데이터 적재 완료 (2026-08-19 기준)

## 8. 남은 작업 / 참고 사항

- 이번 범위에서 다루지 않은 것: 자동/주기적 재수집(cron), DART/EDGAR 외 추가 소스,
  40종목 외 확장(스크립트 대상 목록만 늘리면 재사용 가능), Atlas Vector Search로
  검색까지 이전(현재 free tier에서는 지원 여부 불확실해 FAISS 캐시 방식 유지)
- 새 종목을 추가하거나 기존 데이터를 갱신하려면 `.env`에 `DART_API_KEY`,
  MongoDB 접속 정보를 설정하고 `python -m scripts.build_rag_index` 실행
- 저장 용량은 현재 49.7% 사용 중 — 종목을 추가로 늘릴 경우 사전에 용량 추산 필요
