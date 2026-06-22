import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

type SoldierRank = "이병" | "일병" | "상병" | "병장";
type AdviceSource = "ollama" | "fallback";

interface AssetAdviceRequestBody {
	rank?: string;
	savingsAmount?: number;
	fixedExpense?: number;
	variableExpense?: number;
}

interface RawAdvice {
	summary: string;
	spendingDiagnosis: string[];
	allocationPercentages: {
		emergencyFund: number;
		additionalSavings: number;
		learningInvestment: number;
	};
	monthlyActions: string[];
	riskWarning: string;
}

interface AllocationItem {
	category: string;
	percentage: number;
	amount: number;
	reason: string;
}

const SALARY_BY_RANK: Record<SoldierRank, number> = {
	이병: 750_000,
	일병: 900_000,
	상병: 1_200_000,
	병장: 1_500_000,
};

const SOLDIER_RANKS: SoldierRank[] = [
	"이병",
	"일병",
	"상병",
	"병장",
];

const OLLAMA_BASE_URL =
	process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_MODEL =
	process.env.OLLAMA_ASSET_MODEL ||
	process.env.OLLAMA_MODEL ||
	"qwen2.5:7b";

function toSafeNumber(value: unknown): number {
	const numberValue = Number(value);

	if (!Number.isFinite(numberValue)) {
		return 0;
	}

	return Math.max(0, Math.round(numberValue));
}

function clampPercentage(value: unknown): number {
	const numberValue = Number(value);

	if (!Number.isFinite(numberValue)) {
		return 0;
	}

	return Math.max(0, Math.min(100, numberValue));
}

function normalizePercentages(rawAdvice: RawAdvice) {
	let emergencyFund = clampPercentage(
		rawAdvice.allocationPercentages?.emergencyFund,
	);

	let additionalSavings = clampPercentage(
		rawAdvice.allocationPercentages?.additionalSavings,
	);

	let learningInvestment = clampPercentage(
		rawAdvice.allocationPercentages?.learningInvestment,
	);

	const total =
		emergencyFund +
		additionalSavings +
		learningInvestment;

	if (total <= 0) {
		return {
			emergencyFund: 50,
			additionalSavings: 35,
			learningInvestment: 15,
		};
	}

	emergencyFund = Math.round(
		(emergencyFund / total) * 100,
	);

	additionalSavings = Math.round(
		(additionalSavings / total) * 100,
	);

	learningInvestment =
		100 - emergencyFund - additionalSavings;

	if (learningInvestment < 0) {
		learningInvestment = 0;
		additionalSavings = 100 - emergencyFund;
	}

	return {
		emergencyFund,
		additionalSavings,
		learningInvestment,
	};
}

function removeMarkdownCodeFence(value: string): string {
	return value
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();
}

function buildFallbackAdvice(params: {
	savingsRate: number;
	expenseRate: number;
	fixedExpenseRate: number;
	variableExpenseRate: number;
	remainingAmount: number;
}): RawAdvice {
	const {
		savingsRate,
		expenseRate,
		fixedExpenseRate,
		variableExpenseRate,
	} = params;

	let emergencyFund = 50;
	let additionalSavings = 35;
	let learningInvestment = 15;

	const spendingDiagnosis: string[] = [];

	if (savingsRate < 20) {
		additionalSavings = 40;
		learningInvestment = 10;

		spendingDiagnosis.push(
			"현재 월급 대비 적금 비율이 낮아 추가 저축 비중을 높일 필요가 있습니다.",
		);
	} else if (savingsRate >= 40) {
		spendingDiagnosis.push(
			"현재 월급 대비 적금 납입 비율은 높은 편으로 저축 중심의 안정적인 구조입니다.",
		);
	} else {
		spendingDiagnosis.push(
			"현재 적금 납입 비율은 비교적 균형적인 범위입니다.",
		);
	}

	if (variableExpenseRate >= 25) {
		emergencyFund = 60;
		additionalSavings = 30;
		learningInvestment = 10;

		spendingDiagnosis.push(
			"변동지출 비중이 높아 PX, 외출, 간식, 쇼핑 등의 소비를 우선 점검해야 합니다.",
		);
	} else {
		spendingDiagnosis.push(
			"변동지출은 비교적 안정적인 수준으로 관리되고 있습니다.",
		);
	}

	if (fixedExpenseRate >= 25) {
		spendingDiagnosis.push(
			"고정지출 비중이 높아 통신 요금제와 정기결제 항목을 확인하는 것이 좋습니다.",
		);
	}

	if (
		savingsRate >= 35 &&
		expenseRate <= 25
	) {
		emergencyFund = 45;
		additionalSavings = 30;
		learningInvestment = 25;
	}

	return {
		summary:
			"현재 월급과 소비 구조를 바탕으로 잔여금의 안정성, 저축 수준, 변동지출을 분석했습니다.",
		spendingDiagnosis,
		allocationPercentages: {
			emergencyFund,
			additionalSavings,
			learningInvestment,
		},
		monthlyActions: [
			"월 초에 적금과 고정지출을 먼저 분리하세요.",
			"변동지출의 주간 한도를 설정하고 소비 내역을 기록하세요.",
			"금융학습용 투자는 잃어도 생활에 영향이 없는 소액으로 제한하세요.",
		],
		riskWarning:
			"본 결과는 금융 교육을 위한 참고 자료이며 수익을 보장하는 투자 권유가 아닙니다.",
	};
}

async function generateAdvice(
	req: Request,
	res: Response,
): Promise<void> {
	/*
	#swagger.tags = ['AI']
	#swagger.description = '장병 월급과 지출 정보를 분석하여 자산관리 추천을 생성합니다.'
	*/

	const body = req.body as AssetAdviceRequestBody;
	const rankText = String(body.rank || "").trim();

	if (!SOLDIER_RANKS.includes(rankText as SoldierRank)) {
		res.status(400).json({
			message: "올바른 계급을 선택해야 합니다.",
		});
		return;
	}

	const rank = rankText as SoldierRank;
	const monthlySalary = SALARY_BY_RANK[rank];

	const savingsAmount = toSafeNumber(
		body.savingsAmount,
	);

	const fixedExpense = toSafeNumber(
		body.fixedExpense,
	);

	const variableExpense = toSafeNumber(
		body.variableExpense,
	);

	const totalExpense =
		fixedExpense + variableExpense;

	const totalOutflow =
		savingsAmount + totalExpense;

	const remainingAmount =
		monthlySalary - totalOutflow;

	if (totalOutflow > monthlySalary) {
		res.status(400).json({
			message:
				"적금과 지출 합계가 월급을 초과할 수 없습니다.",
		});
		return;
	}

	if (remainingAmount <= 0) {
		res.status(400).json({
			message:
				"AI 추천을 받으려면 월 잔여금이 0원보다 커야 합니다.",
		});
		return;
	}

	const savingsRate =
		(savingsAmount / monthlySalary) * 100;

	const fixedExpenseRate =
		(fixedExpense / monthlySalary) * 100;

	const variableExpenseRate =
		(variableExpense / monthlySalary) * 100;

	const expenseRate =
		(totalExpense / monthlySalary) * 100;

	const remainingRate =
		(remainingAmount / monthlySalary) * 100;

	const fallbackAdvice = buildFallbackAdvice({
		savingsRate,
		expenseRate,
		fixedExpenseRate,
		variableExpenseRate,
		remainingAmount,
	});

	const prompt = `
너는 대한민국 병사를 위한 금융 교육용 자산관리 분석 모델이다.

사용자의 월급과 소비 정보를 분석하되, 특정 금융상품의 매수를 강요하거나 수익을 보장해서는 안 된다.
추천은 금융 교육, 비상금 확보, 추가 저축, 소액 투자 학습 관점에서 작성한다.

[사용자 정보]
계급: ${rank}
월 급여: ${monthlySalary}원
장병내일준비적금 납입액: ${savingsAmount}원
고정지출: ${fixedExpense}원
기타 변동지출: ${variableExpense}원
총지출: ${totalExpense}원
월 잔여금: ${remainingAmount}원

[계산된 비율]
적금 비율: ${savingsRate.toFixed(1)}%
고정지출 비율: ${fixedExpenseRate.toFixed(1)}%
변동지출 비율: ${variableExpenseRate.toFixed(1)}%
전체 지출 비율: ${expenseRate.toFixed(1)}%
잔여금 비율: ${remainingRate.toFixed(1)}%

다음 기준을 지켜라.

1. 월 잔여금 전체를 비상금, 추가 저축, 금융학습용 투자로 분배한다.
2. 세 비율의 합계는 반드시 100이어야 한다.
3. 금융학습용 투자 비율은 최대 30%로 제한한다.
4. 변동지출이 높으면 비상금 또는 추가 저축 비율을 높인다.
5. 사용자에게 실행 가능한 다음 달 행동을 3개 제시한다.
6. 모든 설명은 짧고 명확한 한국어로 작성한다.
7. JSON 외의 문장은 절대 출력하지 않는다.

반드시 아래 JSON 형식으로만 응답하라.

{
  "summary": "전체 소비패턴 요약",
  "spendingDiagnosis": [
    "소비패턴 진단 1",
    "소비패턴 진단 2",
    "소비패턴 진단 3"
  ],
  "allocationPercentages": {
    "emergencyFund": 50,
    "additionalSavings": 35,
    "learningInvestment": 15
  },
  "monthlyActions": [
    "다음 달 행동 1",
    "다음 달 행동 2",
    "다음 달 행동 3"
  ],
  "riskWarning": "교육용 참고 자료라는 경고"
}
`;

	let source: AdviceSource = "fallback";
	let rawAdvice: RawAdvice = fallbackAdvice;

	try {
		const ollamaResponse = await fetch(
			`${OLLAMA_BASE_URL}/api/generate`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: OLLAMA_MODEL,
					prompt,
					stream: false,
					format: "json",
					options: {
						temperature: 0.2,
					},
				}),
			},
		);

		const ollamaData = (await ollamaResponse.json()) as {
			response?: string;
			error?: string;
		};

		if (!ollamaResponse.ok) {
			throw new Error(
				ollamaData.error ||
					"Ollama 응답에 실패했습니다.",
			);
		}

		if (!ollamaData.response) {
			throw new Error(
				"Ollama 응답 내용이 없습니다.",
			);
		}

		const parsed = JSON.parse(
			removeMarkdownCodeFence(
				ollamaData.response,
			),
		) as RawAdvice;

		if (
			!parsed.summary ||
			!parsed.allocationPercentages
		) {
			throw new Error(
				"AI 응답 형식이 올바르지 않습니다.",
			);
		}

		rawAdvice = parsed;
		source = "ollama";
	} catch (error) {
		console.error(
			"자산관리 LLM 호출 실패, 규칙 기반 결과 사용:",
			error,
		);
	}

	const percentages =
		normalizePercentages(rawAdvice);

	const allocation: AllocationItem[] = [
		{
			category: "비상금",
			percentage:
				percentages.emergencyFund,
			amount: Math.round(
				remainingAmount *
					(percentages.emergencyFund / 100),
			),
			reason:
				"예상하지 못한 외출비, 의료비, 생활비에 대비합니다.",
		},
		{
			category: "추가 저축",
			percentage:
				percentages.additionalSavings,
			amount: Math.round(
				remainingAmount *
					(percentages.additionalSavings / 100),
			),
			reason:
				"전역 후 사용할 수 있는 목돈을 추가로 확보합니다.",
		},
		{
			category: "금융학습용 투자",
			percentage:
				percentages.learningInvestment,
			amount: Math.round(
				remainingAmount *
					(percentages.learningInvestment / 100),
			),
			reason:
				"생활에 영향을 주지 않는 범위에서 ETF와 투자 원리를 학습합니다.",
		},
	];

	res.status(200).json({
		source,
		model:
			source === "ollama"
				? OLLAMA_MODEL
				: "rule-based-fallback",
		calculated: {
			rank,
			monthlySalary,
			savingsAmount,
			fixedExpense,
			variableExpense,
			totalExpense,
			remainingAmount,
			savingsRate,
			expenseRate,
			remainingRate,
		},
		advice: {
			summary: rawAdvice.summary,
			spendingDiagnosis:
				Array.isArray(
					rawAdvice.spendingDiagnosis,
				)
					? rawAdvice.spendingDiagnosis.slice(0, 5)
					: fallbackAdvice.spendingDiagnosis,
			allocation,
			monthlyActions:
				Array.isArray(
					rawAdvice.monthlyActions,
				)
					? rawAdvice.monthlyActions.slice(0, 5)
					: fallbackAdvice.monthlyActions,
			riskWarning:
				rawAdvice.riskWarning ||
				fallbackAdvice.riskWarning,
		},
		generatedAt: new Date().toISOString(),
	});
}

export default {
	generateAdvice,
};