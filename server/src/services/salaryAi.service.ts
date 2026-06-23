import type {
	GoalFeasibilityStatus,
	SoldierRank,
	SalaryActionType,
	SalaryAiResult,
	SalaryMonthlyAction,
	SalaryPlannerSnapshot,
	SpendingRiskLevel,
} from "../types/salaryPlanner.types";

const AI_PROVIDER_URL =
	process.env.SALARY_AI_URL ??
	process.env.OLLAMA_URL ??
	"http://localhost:11434";

const AI_MODEL =
	process.env.SALARY_AI_MODEL ??
	process.env.OLLAMA_SALARY_MODEL;

const REQUEST_TIMEOUT_MS =
	Number(
		process.env.SALARY_AI_TIMEOUT_MS ??
			90_000,
	);


const SALARY_BY_RANK:
	Record<
		SoldierRank,
		number
	> = {
	이병: 750_000,
	일병: 900_000,
	상병: 1_200_000,
	병장: 1_500_000,
};

const RANK_ORDER:
	SoldierRank[] = [
		"이병",
		"일병",
		"상병",
		"병장",
	];

/*
 * 육군 18개월 복무를 기준으로 한 표준 예상 구간입니다.
 * 실제 조기진급·진급누락·군별 복무기간 차이는 사용자 프로필과
 * 향후 군별 설정으로 보정해야 합니다.
 */
function getStandardRankForServiceMonth(
	serviceMonth: number,
): SoldierRank {
	if (serviceMonth < 3) {
		return "이병";
	}

	if (serviceMonth < 9) {
		return "일병";
	}

	if (serviceMonth < 15) {
		return "상병";
	}

	return "병장";
}

function getMonthsBetween(
	fromDate: Date,
	toDate: Date,
): number {
	const yearDiff =
		toDate.getFullYear() -
		fromDate.getFullYear();

	const monthDiff =
		toDate.getMonth() -
		fromDate.getMonth();

	const dayAdjustment =
		toDate.getDate() <
		fromDate.getDate()
			? -1
			: 0;

	return Math.max(
		0,
		yearDiff * 12 +
			monthDiff +
			dayAdjustment,
	);
}

function buildRankBasedProjection(
	snapshot:
		SalaryPlannerSnapshot,
	monthlyImprovement = 0,
) {
	const currentRankIndex =
		Math.max(
			0,
			RANK_ORDER.indexOf(
				snapshot.rank,
			),
		);

	const enlistmentDate =
		snapshot.enlistmentDate
			? new Date(
					`${snapshot.enlistmentDate}T00:00:00`,
				)
			: null;

	const today = new Date();

	const currentServiceMonth =
		enlistmentDate &&
		!Number.isNaN(
			enlistmentDate.getTime(),
		)
			? getMonthsBetween(
					enlistmentDate,
					today,
				)
			: null;

	const spendingRate =
		clamp(
			snapshot.promotionSpendingRate ??
				0.5,
			0,
			1,
		);

	let projectedSalaryIncome = 0;
	let projectedExpenses = 0;
	let projectedCashFlow = 0;

	const grouped =
		new Map<
			SoldierRank,
			{
				months: number;
				salaryTotal: number;
				expenseTotal: number;
				remainingTotal: number;
			}
		>();

	for (
		let monthOffset = 0;
		monthOffset <
		snapshot.goal.monthsLeft;
		monthOffset += 1
	) {
		const standardRank =
			currentServiceMonth ===
			null
				? snapshot.rank
				: getStandardRankForServiceMonth(
						currentServiceMonth +
							monthOffset,
					);

		/*
		 * 입대일 계산상 계급이 현재 선택 계급보다 낮더라도
		 * 미래 예측에서 계급이 뒤로 내려가지는 않게 합니다.
		 */
		const projectedRankIndex =
			Math.max(
				currentRankIndex,
				RANK_ORDER.indexOf(
					standardRank,
				),
			);

		const projectedRank =
			RANK_ORDER[
				projectedRankIndex
			];

		const monthlySalary =
			SALARY_BY_RANK[
				projectedRank
			];

		const salaryIncrease =
			Math.max(
				0,
				monthlySalary -
					snapshot.salary,
			);

		const estimatedExpenses =
			snapshot.totalExpenses +
			salaryIncrease *
				spendingRate;

		const monthlyRemaining =
			monthlySalary -
			snapshot.militarySavings -
			estimatedExpenses +
			monthlyImprovement;

		projectedSalaryIncome +=
			monthlySalary;

		projectedExpenses +=
			estimatedExpenses;

		projectedCashFlow +=
			monthlyRemaining;

		const previous =
			grouped.get(
				projectedRank,
			) ?? {
				months: 0,
				salaryTotal: 0,
				expenseTotal: 0,
				remainingTotal: 0,
			};

		grouped.set(
			projectedRank,
			{
				months:
					previous.months +
					1,
				salaryTotal:
					previous.salaryTotal +
					monthlySalary,
				expenseTotal:
					previous.expenseTotal +
					estimatedExpenses,
				remainingTotal:
					previous.remainingTotal +
					monthlyRemaining,
			},
		);
	}

	const rankSegments =
		RANK_ORDER
			.map((rank) => {
				const group =
					grouped.get(rank);

				if (!group) {
					return null;
				}

				return {
					rank,
					months:
						group.months,
					monthlySalary:
						Math.round(
							group.salaryTotal /
								group.months,
						),
					estimatedMonthlyExpenses:
						Math.round(
							group.expenseTotal /
								group.months,
						),
					estimatedMonthlyRemaining:
						Math.round(
							group.remainingTotal /
								group.months,
						),
				};
			})
			.filter(
				(
					item,
				): item is NonNullable<
					typeof item
				> => Boolean(item),
			);

	return {
		promotionSpendingRate:
			spendingRate,
		projectedSalaryIncome:
			Math.round(
				projectedSalaryIncome,
			),
		projectedExpenses:
			Math.round(
				projectedExpenses,
			),
		projectedCashFlow:
			Math.round(
				projectedCashFlow,
			),
		rankSegments,
	};
}

function clamp(
	value: number,
	min: number,
	max: number,
): number {
	return Math.min(
		max,
		Math.max(min, value),
	);
}

function toNonNegativeNumber(
	value: unknown,
): number {
	const parsed = Number(value);

	return Number.isFinite(parsed)
		? Math.max(0, parsed)
		: 0;
}

function normalizeRiskLevel(
	value: unknown,
): SpendingRiskLevel {
	return value === "HIGH" ||
		value === "MEDIUM" ||
		value === "LOW"
		? value
		: "MEDIUM";
}

function normalizeActionType(
	value: unknown,
): SalaryActionType {
	return value ===
			"REDUCE_EXPENSE" ||
		value ===
			"GOAL_SAVING" ||
		value ===
			"EMERGENCY" ||
		value ===
			"INVESTMENT_PRACTICE" ||
		value === "KEEP"
		? value
		: "KEEP";
}

function buildGoalAssessment(
	snapshot: SalaryPlannerSnapshot,
) {
	const {
		goal,
		remainingAmount,
	} = snapshot;

	let status:
		GoalFeasibilityStatus =
		"INPUT_REQUIRED";

	let label =
		"목표 금액 입력 필요";

	let summary =
		"목표 비용 항목을 조사해 입력하면 달성 가능성을 계산합니다.";

	if (
		goal.targetAmount > 0
	) {
		if (
			goal.goalGap === 0 ||
			goal.monthlyGoalNeeded <=
				remainingAmount
		) {
			status = "POSSIBLE";
			label = "달성 가능";

			summary =
				goal.goalGap === 0
					? `현재 저축액과 예상 장병적금으로 ${goal.name} 목표를 충족할 수 있습니다.`
					: `매월 ${goal.monthlyGoalNeeded.toLocaleString(
							"ko-KR",
						)}원을 목표 자금으로 분리하면 전역 전 달성이 가능합니다.`;
		} else {
			status =
				"IMPOSSIBLE";
			label =
				"현재 계획으로 달성 불가능";

			const shortage =
				Math.max(
					0,
					goal.monthlyGoalNeeded -
						remainingAmount,
				);

			summary =
				`현재 월 잔여금보다 ${shortage.toLocaleString(
					"ko-KR",
				)}원이 더 필요합니다. 지출, 목표 비용 또는 목표 시점을 조정해야 합니다.`;
		}
	}

	return {
		status,
		label,
		summary,
		monthlyRequired:
			goal.monthlyGoalNeeded,
		monthlyShortage:
			Math.max(
				0,
				goal.monthlyGoalNeeded -
					remainingAmount,
			),
	};
}

function normalizeMonthlyActions(
	rawItems: unknown,
	snapshot: SalaryPlannerSnapshot,
): SalaryMonthlyAction[] {
	if (!Array.isArray(rawItems)) {
		throw new Error(
			"LLM 월 행동 항목이 없습니다.",
		);
	}

	const items =
		rawItems
			.slice(0, 4)
			.map(
				(raw: any) => {
					const type =
						normalizeActionType(
							raw?.type,
						);

					const currentAmount =
						toNonNegativeNumber(
							raw?.currentAmount,
						);

					const targetAmount =
						toNonNegativeNumber(
							raw?.targetAmount,
						);

					let monthlyEffect =
						toNonNegativeNumber(
							raw?.monthlyEffect,
						);

					if (
						type ===
						"REDUCE_EXPENSE"
					) {
						monthlyEffect =
							Math.max(
								monthlyEffect,
								currentAmount -
									targetAmount,
							);
					} else {
						monthlyEffect = 0;
					}

					return {
						type,
						title:
							String(
								raw?.title ??
									"이번 달 행동",
							),
						currentAmount,
						targetAmount,
						monthlyEffect,
						reason:
							String(
								raw?.reason ??
									"현재 입력값을 기준으로 제안했습니다.",
							),
					};
				},
			)
			.filter(
				(item) =>
					item.title.trim()
						.length > 0,
			);

	if (items.length < 2) {
		throw new Error(
			"LLM 월 행동 플랜이 충분하지 않습니다.",
		);
	}

	/*
	 * 절감 효과는 사용자가 입력한 월 변동지출의 40%를 넘지 않도록 검증합니다.
	 * 비현실적인 절감액을 방지하기 위한 안전장치입니다.
	 */
	const improvementCap =
		Math.min(
			snapshot.variableExpenses *
				0.4,
			snapshot.salary * 0.2,
		);

	let usedImprovement = 0;

	return items.map(
		(item) => {
			if (
				item.type !==
				"REDUCE_EXPENSE"
			) {
				return item;
			}

			const available =
				Math.max(
					0,
					improvementCap -
						usedImprovement,
				);

			const monthlyEffect =
				Math.min(
					item.monthlyEffect,
					available,
				);

			usedImprovement +=
				monthlyEffect;

			return {
				...item,
				monthlyEffect,
			};
		},
	);
}

function normalizeResult(
	raw: any,
	snapshot: SalaryPlannerSnapshot,
): SalaryAiResult {
	if (
		!raw?.diagnosis ||
		!raw?.recommendedRatios ||
		!raw?.allocation ||
		!raw?.monthlyPlan
	) {
		throw new Error(
			"LLM 응답 필수 필드가 누락되었습니다.",
		);
	}

	const goalAssessment =
		buildGoalAssessment(
			snapshot,
		);

	const safeRemaining =
		Math.max(
			0,
			snapshot.remainingAmount,
		);

	const monthlyPlanItems =
		normalizeMonthlyActions(
			raw.monthlyPlan.items,
			snapshot,
		);

	const expectedMonthlyImprovement =
		monthlyPlanItems.reduce(
			(total, item) =>
				item.type ===
				"REDUCE_EXPENSE"
					? total +
						item.monthlyEffect
					: total,
			0,
		);

	let allocation = {
		emergency:
			toNonNegativeNumber(
				raw.allocation
					.emergency,
			),

		goal:
			toNonNegativeNumber(
				raw.allocation.goal,
			),

		investmentPractice:
			toNonNegativeNumber(
				raw.allocation
					.investmentPractice,
			),

		flexible:
			toNonNegativeNumber(
				raw.allocation
					.flexible,
			),
	};

	const investmentPracticeCap =
		goalAssessment.status ===
			"IMPOSSIBLE" ||
		snapshot.overspendAmount > 0
			? 0
			: snapshot.actualRatios
						.savings >= 30
				? safeRemaining * 0.35
				: safeRemaining * 0.15;

	allocation.investmentPractice =
		Math.min(
			allocation
				.investmentPractice,
			investmentPracticeCap,
		);

	const allocationTotal =
		allocation.emergency +
		allocation.goal +
		allocation.investmentPractice +
		allocation.flexible;

	if (
		allocationTotal >
			safeRemaining &&
		allocationTotal > 0
	) {
		const scale =
			safeRemaining /
			allocationTotal;

		allocation = {
			emergency:
				Math.round(
					allocation
						.emergency *
						scale,
				),

			goal:
				Math.round(
					allocation.goal *
						scale,
				),

			investmentPractice:
				Math.round(
					allocation
						.investmentPractice *
						scale,
				),

			flexible: 0,
		};

		allocation.flexible =
			Math.max(
				0,
				safeRemaining -
					allocation.emergency -
					allocation.goal -
					allocation
						.investmentPractice,
			);
	}

	const savings =
		clamp(
			Number(
				raw.recommendedRatios
					.savings,
			),
			0,
			100,
		);

	const expenses =
		clamp(
			Number(
				raw.recommendedRatios
					.expenses,
			),
			0,
			100 - savings,
		);

	const remaining =
		clamp(
			100 -
				savings -
				expenses,
			0,
			100,
		);

	const evidence =
		Array.isArray(
			raw.diagnosis
				.evidence,
		)
			? raw.diagnosis.evidence
					.map(String)
					.filter(Boolean)
					.slice(0, 4)
			: [];

	if (
		evidence.length < 2
	) {
		throw new Error(
			"LLM 소비패턴 근거가 부족합니다.",
		);
	}

	const actions =
		Array.isArray(raw.actions)
			? raw.actions
					.map(String)
					.filter(Boolean)
					.slice(0, 5)
			: [];

	if (actions.length < 2) {
		throw new Error(
			"LLM 실행 제안이 부족합니다.",
		);
	}

	const confirmedAssetsAtDischarge =
		snapshot.goal
			.projectedAvailableAtDischarge;

	const baselineProjection =
		buildRankBasedProjection(
			snapshot,
			0,
		);

	const actionProjection =
		buildRankBasedProjection(
			snapshot,
			expectedMonthlyImprovement,
		);

	/*
	 * 계급별 봉급 상승과 사용자가 선택한 급여 상승분 소비율을
	 * 월 단위로 반영합니다.
	 */
	const baselineAssetsAtDischarge =
		Math.max(
			0,
			confirmedAssetsAtDischarge +
				baselineProjection
					.projectedCashFlow,
		);

	const actionPlanAssetsAtDischarge =
		Math.max(
			0,
			confirmedAssetsAtDischarge +
				actionProjection
					.projectedCashFlow,
		);

	return {
		diagnosis: {
			patternType:
				String(
					raw.diagnosis
						.patternType,
				),

			riskLevel:
				normalizeRiskLevel(
					raw.diagnosis
						.riskLevel,
				),

			summary:
				String(
					raw.diagnosis
						.summary,
				),

			evidence,
		},

		goalAssessment,

		recommendedRatios: {
			savings,
			expenses,
			remaining,
		},

		allocation,

		monthlyPlan: {
			headline:
				String(
					raw.monthlyPlan
						.headline ??
						"이번 달 실행 플랜",
				),

			summary:
				String(
					raw.monthlyPlan
						.summary ??
						"현재 소비와 목표를 기준으로 우선순위를 정했습니다.",
				),

			items:
				monthlyPlanItems,

			expectedMonthlyImprovement,
		},

		projection: {
			confirmedAssetsAtDischarge,
			baselineAssetsAtDischarge,
			actionPlanAssetsAtDischarge,
			additionalSecured:
				Math.max(
					0,
					actionPlanAssetsAtDischarge -
						baselineAssetsAtDischarge,
				),

			baselineGoalBalance:
				baselineAssetsAtDischarge -
				snapshot.goal
					.targetAmount,

			actionPlanGoalBalance:
				actionPlanAssetsAtDischarge -
				snapshot.goal
					.targetAmount,

			promotionSpendingRate:
				baselineProjection
					.promotionSpendingRate,

			projectedSalaryIncome:
				baselineProjection
					.projectedSalaryIncome,

			projectedExpenses:
				baselineProjection
					.projectedExpenses,

			projectedCashFlow:
				baselineProjection
					.projectedCashFlow,

			rankSegments:
				baselineProjection
					.rankSegments,
		},

		allocationReason:
			String(
				raw.allocationReason ??
					"현재 저축 수준과 목표 달성 가능성을 기준으로 잔여금을 나누었습니다.",
			),

		actions,
		source: "LLM",
	};
}

export async function analyzeSalaryPlan(
	snapshot: SalaryPlannerSnapshot,
): Promise<{
	result: SalaryAiResult;
	source: "LLM";
}> {
	if (!AI_MODEL) {
		throw new Error(
			"SALARY_AI_MODEL 환경변수가 설정되지 않았습니다.",
		);
	}

	const activeFixed =
		snapshot.fixedItems.filter(
			(item) => item.amount > 0,
		);

	const activeVariable =
		snapshot.variableItems.filter(
			(item) => item.amount > 0,
		);

	const prompt = `
너는 군 복무 중인 사용자의 소비 습관과 전역 목표를 분석하는 금융교육용 자금 설계 AI다.

핵심 역할:
- 지출 항목을 단순 나열하지 않는다.
- 고정비 압력, 변동지출 집중도, 선택소비 성격, 저축 우선 여부를 종합해 소비패턴을 설명한다.
- 비율보다 사용자가 이번 달 바로 실행할 수 있는 구체적인 금액 행동을 우선 제안한다.
- existingMilitarySavingsPrincipal은 사용자가 이미 납입한 장병내일준비적금 원금이다.
  이 금액은 이미 확보한 적금 경로로 보고 월 현금흐름에서 다시 차감하지 않는다.
- militarySavings는 앞으로 남은 복무기간 동안 매월 납입할 금액이다.
- 이미 납입한 원금과 예상 매칭지원금으로 전역 목표 달성 기반이 충분하고,
  월 잔여금도 안정적이라면 잔여금 전부를 추가 저축하라고 하지 않는다.
  일부를 앱의 모의투자·금융학습 연습 예산으로 제안할 수 있다.
- 목표 달성이 불가능하거나 예산이 초과되면 모의투자 연습 예산은 0원으로 둔다.
- 실제 주식, ETF, 코인 또는 금융상품을 추천하지 않는다.
- investmentPractice는 실제 투자 권유가 아니라 앱의 모의투자 학습에 사용할 가상 기준금이다.
- enlistmentDate와 현재 계급은 복무기간 중 계급별 봉급 상승을 예측하는 데 사용한다.
- promotionSpendingRate는 진급으로 늘어나는 급여 중 소비 증가로 반영할 비율이다.
  이 값을 사용자의 소비성향 자체로 단정하지 말고 시뮬레이션 가정으로만 해석한다.
- 장병적금 누적 원금과 앞으로의 적금·매칭 예상액이 목표를 충분히 충족한다면,
  "저축을 더 늘리기보다 일정 금액으로 모의투자를 연습해 금융 판단 경험을 쌓는다"는 방향을 제안할 수 있다.

월 행동 플랜 작성 원칙:
1. 2~4개의 행동을 작성한다.
2. 가능하면 사용자가 입력한 실제 항목명을 활용한다.
3. REDUCE_EXPENSE는 currentAmount와 targetAmount를 모두 숫자로 작성한다.
4. REDUCE_EXPENSE의 monthlyEffect는 currentAmount-targetAmount와 일치하도록 한다.
5. 목표가 있다면 GOAL_SAVING 항목에 월 목표 저축액을 구체적으로 제시한다.
6. 저축이 충분하고 목표가 가능한 경우에만 INVESTMENT_PRACTICE를 제안한다.
7. "아껴 쓰세요" 같은 추상 문장보다 "PX·마트를 120,000원에서 90,000원으로 제한"처럼 작성한다.

사용자 입력:
${JSON.stringify(
	activeFixed.length +
		activeVariable.length >
	0
		? snapshot
		: {
				...snapshot,
				notice:
					"실제 지출 금액이 아직 입력되지 않음",
			},
	null,
	2,
)}

출력 규칙:
- 반드시 JSON만 출력한다.
- diagnosis.summary는 2~4문장으로 작성한다.
- diagnosis.evidence는 입력 수치에서 계산 가능한 근거를 2~4개 작성한다.
- recommendedRatios의 합은 100이어야 한다.
- allocation의 합은 remainingAmount를 초과하면 안 된다.
- projection과 goalAssessment는 출력하지 않는다. 서버가 숫자로 계산한다.

출력 JSON:
{
  "diagnosis": {
    "patternType": "예: 선택소비 집중형, 고정비 부담형, 목표 중심 저축형",
    "riskLevel": "LOW | MEDIUM | HIGH",
    "summary": "항목을 나열하지 않고 소비 행동의 성격, 강점, 위험을 설명",
    "evidence": [
      "수치 근거 1",
      "수치 근거 2"
    ]
  },
  "monthlyPlan": {
    "headline": "사용자가 바로 이해할 한 문장",
    "summary": "이번 달에 무엇을 우선해야 하는지 설명",
    "items": [
      {
        "type": "REDUCE_EXPENSE | GOAL_SAVING | EMERGENCY | INVESTMENT_PRACTICE | KEEP",
        "title": "구체적인 행동 이름",
        "currentAmount": 0,
        "targetAmount": 0,
        "monthlyEffect": 0,
        "reason": "이 행동이 필요한 이유"
      }
    ]
  },
  "recommendedRatios": {
    "savings": 0,
    "expenses": 0,
    "remaining": 0
  },
  "allocation": {
    "emergency": 0,
    "goal": 0,
    "investmentPractice": 0,
    "flexible": 0
  },
  "allocationReason": "왜 이런 잔여금 배분을 제안했는지 설명",
  "actions": [
    "다음 달 확인할 행동",
    "목표 달성을 위해 유지할 행동"
  ]
}
`;

	const abortController =
		new AbortController();

	const timeout =
		setTimeout(
			() =>
				abortController.abort(),
			REQUEST_TIMEOUT_MS,
		);

	try {
		const response =
			await fetch(
				`${AI_PROVIDER_URL}/api/generate`,
				{
					method: "POST",
					headers: {
						"Content-Type":
							"application/json",
					},
					signal:
						abortController.signal,
					body: JSON.stringify({
						model:
							AI_MODEL,
						prompt,
						stream: false,
						format: "json",
						options: {
							temperature:
								0.35,
						},
					}),
				},
			);

		if (!response.ok) {
			const detail =
				await response.text();

			throw new Error(
				`AI provider HTTP ${response.status}: ${detail}`,
			);
		}

		const data =
			await response.json();

		if (
			typeof data.response !==
			"string"
		) {
			throw new Error(
				"AI 응답 본문이 없습니다.",
			);
		}

		const parsed =
			JSON.parse(
				data.response,
			);

		return {
			result:
				normalizeResult(
					parsed,
					snapshot,
				),
			source: "LLM",
		};
	} finally {
		clearTimeout(timeout);
	}
}

export default {
	analyzeSalaryPlan,
};
