import {
	Request,
	Response,
} from "express";
import mongoose from "mongoose";

import MilitaryProfile, {
	DischargeDateSource,
	MilitaryBranch,
	MilitaryRank,
	MilitaryRankMode,
} from "../models/militaryProfile.model";
import CommunityProfile from "../models/communityProfile.model";
import {
	calculateAutomaticDischargeDate,
	SERVICE_MONTHS_BY_BRANCH,
	serializeMilitaryProfile,
} from "../services/militaryProfile.service";

const ALLOWED_BRANCHES =
	new Set<MilitaryBranch>([
		"ARMY",
		"NAVY",
		"AIR_FORCE",
		"MARINE",
		"ETC",
	]);

const ALLOWED_RANKS =
	new Set<MilitaryRank>([
		"PRIVATE",
		"PRIVATE_FIRST_CLASS",
		"CORPORAL",
		"SERGEANT",
	]);

const ALLOWED_RANK_MODES =
	new Set<MilitaryRankMode>([
		"AUTO",
		"MANUAL",
	]);

const ALLOWED_DISCHARGE_DATE_SOURCES =
	new Set<DischargeDateSource>([
		"AUTO",
		"MANUAL",
	]);


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

function parseDateOnly(
	value: unknown,
	fieldName: string,
): Date {
	const text = String(value ?? "");

	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(text)
	) {
		const error =
			new Error(
				`${fieldName} 형식이 올바르지 않습니다.`,
			) as Error & {
				statusCode?: number;
			};

		error.statusCode = 400;
		throw error;
	}

	const date =
		new Date(`${text}T00:00:00.000Z`);

	if (Number.isNaN(date.getTime())) {
		const error =
			new Error(
				`${fieldName}을 확인하세요.`,
			) as Error & {
				statusCode?: number;
			};

		error.statusCode = 400;
		throw error;
	}

	return date;
}


function sendError(
	res: Response,
	error: unknown,
	fallbackMessage: string,
) {
	if (
		error instanceof Error &&
		error.message === "UNAUTHORIZED"
	) {
		return res.status(401).json({
			message: "로그인이 필요합니다.",
		});
	}

	const statusCode =
		error instanceof Error &&
		"statusCode" in error
			? Number(
					(error as Error & {
						statusCode?: number;
					}).statusCode,
				) || 500
			: 500;

	console.error(
		fallbackMessage,
		error,
	);

	return res.status(statusCode).json({
		message:
			error instanceof Error
				? error.message
				: fallbackMessage,
	});
}

const getMilitaryProfile = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const profile =
			await MilitaryProfile.findOne({
				userId,
			});

		if (!profile) {
			return res.status(200).json({
				configured: false,
				profile: null,
				serviceMonthsByBranch:
					SERVICE_MONTHS_BY_BRANCH,
			});
		}

		return res.status(200).json({
			configured: true,
			profile:
				serializeMilitaryProfile(
					profile,
				),
			serviceMonthsByBranch:
				SERVICE_MONTHS_BY_BRANCH,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"군 프로필 조회에 실패했습니다.",
		);
	}
};

const saveMilitaryProfile = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const branch =
			String(
				req.body.branch ?? "",
			) as MilitaryBranch;

		const selectedRank =
			String(
				req.body.selectedRank ?? "",
			) as MilitaryRank;

		const rankMode =
			String(
				req.body.rankMode ?? "",
			) as MilitaryRankMode;

		const dischargeDateSource =
			String(
				req.body.dischargeDateSource ??
					"MANUAL",
			) as DischargeDateSource;


		if (!ALLOWED_BRANCHES.has(branch)) {
			return res.status(400).json({
				message:
					"올바른 군종을 선택하세요.",
			});
		}

		if (!ALLOWED_RANKS.has(selectedRank)) {
			return res.status(400).json({
				message:
					"올바른 계급을 선택하세요.",
			});
		}

		if (
			!ALLOWED_RANK_MODES.has(
				rankMode,
			)
		) {
			return res.status(400).json({
				message:
					"올바른 계급 표시 방식을 선택하세요.",
			});
		}

		if (
			!ALLOWED_DISCHARGE_DATE_SOURCES.has(
				dischargeDateSource,
			)
		) {
			return res.status(400).json({
				message:
					"올바른 전역일 설정 방식을 선택하세요.",
			});
		}


		const enlistmentDate =
			parseDateOnly(
				req.body.enlistmentDate,
				"입대일",
			);

		let dischargeDate: Date;

		if (dischargeDateSource === "AUTO") {
			const calculatedDischargeDate =
				calculateAutomaticDischargeDate(
					enlistmentDate,
					branch,
				);

			if (!calculatedDischargeDate) {
				return res.status(400).json({
					message:
						"해당 군종은 전역일 자동 계산을 지원하지 않습니다. 전역일을 직접 입력하세요.",
				});
			}

			dischargeDate =
				calculatedDischargeDate;
		} else {
			dischargeDate = parseDateOnly(
				req.body.dischargeDate,
				"전역일",
			);
		}

		if (
			dischargeDate <= enlistmentDate
		) {
			return res.status(400).json({
				message:
					"전역일은 입대일보다 뒤여야 합니다.",
			});
		}


		const profile =
			await MilitaryProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						branch,
						enlistmentDate,
						dischargeDate,
						dischargeDateSource,
						selectedRank,
						rankMode,
					},
					$setOnInsert: {
						userId,
					},
				},
				{
					upsert: true,
					new: true,
					runValidators: true,
				},
			);

		await CommunityProfile.findOneAndUpdate(
			{
				userId,
			},
			{
				$set: {
					branch,
				},
				$setOnInsert: {
					userId,
					nickname: "ㅇㅇ",
				},
			},
			{
				upsert: true,
				new: true,
				runValidators: true,
			},
		);

		return res.status(200).json(
			serializeMilitaryProfile(
				profile,
			),
		);
	} catch (error) {
		return sendError(
			res,
			error,
			"군 프로필 저장에 실패했습니다.",
		);
	}
};

export default {
	getMilitaryProfile,
	saveMilitaryProfile,
};
