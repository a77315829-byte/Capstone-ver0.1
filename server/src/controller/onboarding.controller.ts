import {
	Request,
	Response,
} from "express";
import mongoose from "mongoose";

import MilitaryProfile from "../models/militaryProfile.model";
import SalaryAiPlan from "../models/salaryAiPlan.model";

function getAuthenticatedUserId(
	req: Request,
): string {
	const userId = String(
		(req as any).userId ??
			req.body?.userId ??
			"",
	);

	if (
		!mongoose.Types.ObjectId.isValid(
			userId,
		)
	) {
		throw new Error("UNAUTHORIZED");
	}

	return userId;
}

const getOnboardingStatus = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const [
			militaryProfile,
			salaryPlan,
		] = await Promise.all([
			MilitaryProfile.exists({
				userId,
			}),
			SalaryAiPlan.exists({
				userId,
			}),
		]);

		const militaryProfileConfigured =
			Boolean(militaryProfile);
		const salaryPlanConfigured =
			Boolean(salaryPlan);

		let nextRoute = "/exchange";

		if (!militaryProfileConfigured) {
			nextRoute = "/mypage";
		} else if (!salaryPlanConfigured) {
			nextRoute = "/salary";
		}

		return res.status(200).json({
			militaryProfileConfigured,
			salaryPlanConfigured,
			nextRoute,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message:
					"로그인이 필요합니다.",
			});
		}

		console.error(
			"onboarding status error:",
			error,
		);

		return res.status(500).json({
			message:
				"온보딩 상태를 확인하지 못했습니다.",
		});
	}
};

export default {
	getOnboardingStatus,
};
