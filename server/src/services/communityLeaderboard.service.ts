interface MonthlyPerformanceInput {
	returnRate: number;
	maxDrawdown: number;
	dailyVolatility: number;
	activeTradingDays: number;
	reasonEntryCount: number;
}

export interface MonthlyInvestmentScore {
	returnScore: number;
	drawdownScore: number;
	consistencyScore: number;
	activityScore: number;
	totalScore: number;
}

function clamp(
	value: number,
	min = 0,
	max = 100,
): number {
	return Math.min(max, Math.max(min, value));
}

/*
 * 실시간 모의투자 계좌의 월간 성과를
 * 교육 목적의 위험조정 점수로 변환합니다.
 *
 * 추후 같은 사단 사용자의 수익률 백분위로
 * returnScore를 대체하면 더욱 공정한 상대평가가 됩니다.
 */
export function calculateMonthlyInvestmentScore({
	returnRate,
	maxDrawdown,
	dailyVolatility,
	activeTradingDays,
	reasonEntryCount,
}: MonthlyPerformanceInput): MonthlyInvestmentScore {
	const returnScore = clamp(
		50 + returnRate * 3,
	);

	const drawdownScore = clamp(
		100 - Math.abs(maxDrawdown) * 5,
	);

	const consistencyScore = clamp(
		100 - Math.abs(dailyVolatility) * 12,
	);

	const activityScore = clamp(
		activeTradingDays * 4 +
			reasonEntryCount * 3,
	);

	const totalScore =
		returnScore * 0.45 +
		drawdownScore * 0.25 +
		consistencyScore * 0.2 +
		activityScore * 0.1;

	return {
		returnScore:
			Math.round(returnScore * 10) / 10,
		drawdownScore:
			Math.round(drawdownScore * 10) / 10,
		consistencyScore:
			Math.round(consistencyScore * 10) / 10,
		activityScore:
			Math.round(activityScore * 10) / 10,
		totalScore:
			Math.round(totalScore * 10) / 10,
	};
}
