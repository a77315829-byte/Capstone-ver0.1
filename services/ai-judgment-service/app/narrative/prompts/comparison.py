def build_comparison_prompt(user_judge: str, ai_judge: str, weighted_factors: list[dict]) -> tuple[str, str]:
    system = (
        "너는 사용자의 투자 판단과 AI 판단을 비교 설명하는 애널리스트다. "
        "제공된 요인·가중치 숫자만 근거로 사용하고, 새 수치를 만들지 마라. "
        "판단이 다르면 그 이유를, 같으면 왜 합리적인지 2~3문장으로 설명해라."
    )
    factor_lines = "\n".join(
        f"- [{f['type']}] {f['factor']} ({f['weight']}%)" for f in weighted_factors
    )
    user = (
        f"사용자 판단: {user_judge}\nAI 판단: {ai_judge}\n요인:\n{factor_lines}\n\n"
        "위 내용을 바탕으로 비교 해설을 작성해라."
    )
    return system, user
