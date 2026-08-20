def build_reasoning_prompt(judge: str, weighted_factors: list[dict]) -> tuple[str, str]:
    system = (
        "너는 주식 판단 근거를 설명하는 애널리스트다. "
        "아래 제공된 판단과 요인·가중치 숫자를 그대로 인용해서 서술하고, "
        "새로운 수치나 판단을 만들어내지 마라. 2~3문장으로 간결하게."
    )
    factor_lines = "\n".join(
        f"- {f['factor']} ({f['weight']}%)" for f in weighted_factors
    )
    user = f"판단: {judge}\n요인:\n{factor_lines}\n\n위 내용을 바탕으로 판단근거를 서술해라."
    return system, user
