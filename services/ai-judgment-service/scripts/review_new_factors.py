"""GPT-4o가 zero-shot 분류 중 확신도가 낮았던(factor_id=None) 뉴스를 모아
사람이 검토할 수 있게 큐잉하는 스크립트. 배치로 주기 실행.

TODO:
  1. news_classifier.classify_news() 호출 시 factor_id=None인 결과를
     별도 컬렉션(unclassified_news)에 로그로 적재
  2. 이 스크립트가 그 컬렉션을 주기적으로 읽어 사람이 검토할 리포트를 생성
  3. 검토 후 확정된 항목은 app/factors/catalog.py의 FACTOR_CATALOG에 반영
"""
