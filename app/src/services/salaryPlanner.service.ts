import api from "./api.service";

import type {
	SavedSalaryPlan,
	SalaryPlannerSnapshot,
} from "../types/salaryPlanner.types";

function isCurrentSalaryPlan(
	value: unknown,
): value is SavedSalaryPlan {
	const plan =
		value as
			| SavedSalaryPlan
			| null
			| undefined;

	return Boolean(
		plan?.snapshot &&
			plan?.result &&
			plan.result.source ===
				"LLM" &&
			plan.result.diagnosis &&
			plan.result.goalAssessment &&
			plan.result.monthlyPlan &&
			typeof plan.result
				.monthlyPlan
				.headline ===
				"string" &&
			Array.isArray(
				plan.result
					.monthlyPlan.items,
			) &&
			plan.result.projection &&
			Array.isArray(
				plan.result
					.projection
					.rankSegments,
			) &&
			typeof plan.result
				.projection
				.projectedSalaryIncome ===
				"number" &&
			typeof plan.result
				.projection
				.promotionSpendingRate ===
				"number" &&
			plan.result.allocation &&
			typeof plan.result
				.allocation
				.investmentPractice ===
				"number" &&
			typeof plan.result
				.allocationReason ===
				"string",
	);
}

export async function analyzeSalaryPlan(
	snapshot: SalaryPlannerSnapshot,
): Promise<SavedSalaryPlan> {
	const response =
		await api.post(
			"/salary-ai/analyze",
			snapshot,
		);

	const plan =
		response.data?.plan ??
		response.data?.data ??
		response.data;

	if (
		!isCurrentSalaryPlan(
			plan,
		)
	) {
		throw new Error(
			"AI 분석 결과가 현재 시뮬레이션 형식과 맞지 않습니다.",
		);
	}

	return plan;
}

export async function getLatestSalaryPlan():
	Promise<SavedSalaryPlan | null> {
	try {
		const response =
			await api.get(
				"/salary-ai/latest",
				{
					params: {
						planVersion: 7,
						_: Date.now(),
					},
				},
			);

		const plan =
			response.data?.plan ??
			response.data?.data ??
			response.data;

		if (
			!isCurrentSalaryPlan(
				plan,
			)
		) {
			console.warn(
				"계급별 예측 필드가 없는 이전 급여 플랜을 무시합니다.",
			);

			return null;
		}

		return plan;
	} catch (error: any) {
		if (
			error?.response?.status !==
			404
		) {
			console.warn(
				"최근 급여 플랜 조회 실패:",
				error,
			);
		}

		return null;
	}
}
