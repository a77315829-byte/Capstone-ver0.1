import {
	Request,
	Response,
} from "express";

import SalaryAiPlan from "../models/salaryAiPlan.model";

import salaryAiService from "../services/salaryAi.service";

const getRequestUserId = (
	req: Request,
): string | undefined => {
	return (
		req.body?.userId ??
		(req as any).userId
	);
};

const analyze = async (
	req: Request,
	res: Response,
) => {
	const startedAt =
		Date.now();

	try {
		const userId =
			getRequestUserId(req);

		if (!userId) {
			return res.status(401).json({
				message:
					"로그인이 필요합니다.",
			});
		}

		const {
			userId:
				_unusedUserId,
			...snapshot
		} = req.body;

		if (
			!snapshot ||
			typeof snapshot.salary !==
				"number" ||
			!snapshot.goal ||
			!Array.isArray(
				snapshot.fixedItems,
			) ||
			!Array.isArray(
				snapshot.variableItems,
			)
		) {
			return res.status(400).json({
				message:
					"급여 분석 입력값이 올바르지 않습니다.",
			});
		}

		const analysis =
			await salaryAiService.analyzeSalaryPlan(
				snapshot,
			);

		const generatedAt =
			new Date();

		const analysisDurationMs =
			Date.now() -
			startedAt;

		const savedPlan =
			await SalaryAiPlan.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						snapshot,
						result:
							analysis.result,
						generatedAt,
					},
				},
				{
					new: true,
					upsert: true,
					setDefaultsOnInsert:
						true,
				},
			).lean();

		console.log(
			`[salary-ai] LLM completed in ${analysisDurationMs}ms`,
		);

		return res.status(200).json({
			success: true,
			plan: {
				snapshot:
					savedPlan?.snapshot ??
					snapshot,
				result:
					savedPlan?.result ??
					analysis.result,
				generatedAt:
					savedPlan?.generatedAt ??
					generatedAt,
				analysisDurationMs,
			},
		});
	} catch (error: any) {
		const analysisDurationMs =
			Date.now() -
			startedAt;

		console.error(
			`[salary-ai] LLM failed after ${analysisDurationMs}ms`,
			error,
		);

		return res.status(503).json({
			message:
				"AI 분석 서버에 연결하지 못했습니다. 서버 설정과 모델 실행 상태를 확인해 주세요.",
			detail:
				process.env.NODE_ENV ===
				"development"
					? String(
							error?.message ??
								error,
						)
					: undefined,
		});
	}
};

const getLatest = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getRequestUserId(req);

		if (!userId) {
			return res.status(401).json({
				message:
					"로그인이 필요합니다.",
			});
		}

		const savedPlan =
			await SalaryAiPlan.findOne({
				userId,
			})
				.select(
					"snapshot result generatedAt",
				)
				.lean();

		if (!savedPlan) {
			return res.status(404).json({
				message:
					"저장된 급여 플랜이 없습니다.",
			});
		}

		return res.status(200).json({
			success: true,
			plan: {
				snapshot:
					savedPlan.snapshot,
				result:
					savedPlan.result,
				generatedAt:
					savedPlan.generatedAt,
			},
		});
	} catch (error) {
		console.error(
			"latest salary plan error:",
			error,
		);

		return res.status(500).json({
			message:
				"최근 급여 플랜 조회 중 오류가 발생했습니다.",
		});
	}
};

export default {
	analyze,
	getLatest,
};
