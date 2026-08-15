from data import repository as repo
from data.models import UserDecision, Holding, QuestionAnswer, Action
from scoring import engine

rubric = repo.get_rubric("semiconductor", 3)

# 답안 A (모범) — 객관식 + 자유서술 다 포함
decision = UserDecision(
    scenario_id="semiconductor", turn_no=3,
    holdings=[Holding("SK_HYNIX", Action.BUY, 15)],
    cash_pct=50,
    answers=[
        QuestionAnswer("Q1", ["시장 수급", "가격 수준", "공급망"]),
        QuestionAnswer("Q5", ["대부분 반영"]),
        QuestionAnswer("Q6", ["긍정적"]),
        QuestionAnswer("Q13", ["변동성 확대", "심리 위축"]),
        QuestionAnswer("Q36", ["단계적 대응"]),
        QuestionAnswer("Q39", text="HBM 수요는 늘지만 이미 올라서 밸류 부담이 있어 분할로 소량만 담았다."),
    ],
)

card = engine.score_turn(decision, rubric)
print("상태:", card.status.value)
print("turn_score:", card.turn_score)
for m in card.metrics:
    print(f"  {m.metric.value}: {m.score}점", f"({m.reason})" if m.reason else "")