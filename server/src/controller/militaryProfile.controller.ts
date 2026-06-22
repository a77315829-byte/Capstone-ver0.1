import {
	Request,
	Response,
} from "express";
import mongoose from "mongoose";

import MilitaryProfile, {
	MilitaryBranch,
	MilitaryRank,
	MilitaryRankMode,
	MilitaryUnitType,
} from "../models/militaryProfile.model";
import CommunityProfile from "../models/communityProfile.model";
import {
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

const ALLOWED_UNIT_TYPES =
	new Set<MilitaryUnitType>([
		"CORPS",
		"DIVISION",
		"BRIGADE",
		"FLEET",
		"COMMAND",
		"WING",
		"GROUP",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	]);

const UNIT_TYPES_BY_BRANCH:
	Record<MilitaryBranch, MilitaryUnitType[]> = {
	ARMY: [
		"CORPS",
		"DIVISION",
		"BRIGADE",
		"COMMAND",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	],
	NAVY: [
		"FLEET",
		"COMMAND",
		"GROUP",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	],
	AIR_FORCE: [
		"WING",
		"COMMAND",
		"GROUP",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	],
	MARINE: [
		"DIVISION",
		"BRIGADE",
		"COMMAND",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	],
	ETC: [
		"COMMAND",
		"GROUP",
		"EDUCATION",
		"DIRECT",
		"OTHER",
	],
};

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

function normalizeOptionalText(
	value: unknown,
	maxLength: number,
): string | null {
	const text =
		String(value ?? "").trim();

	if (!text) {
		return null;
	}

	return text.slice(0, maxLength);
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
			});
		}

		return res.status(200).json({
			configured: true,
			profile:
				serializeMilitaryProfile(
					profile,
				),
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

		const unitTypeText =
			String(
				req.body.unitType ?? "",
			).trim();

		const unitType =
			unitTypeText
				? unitTypeText as MilitaryUnitType
				: null;

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
			unitType &&
			!ALLOWED_UNIT_TYPES.has(unitType)
		) {
			return res.status(400).json({
				message:
					"올바른 부대 유형을 선택하세요.",
			});
		}

		if (
			unitType &&
			!UNIT_TYPES_BY_BRANCH[
				branch
			].includes(unitType)
		) {
			return res.status(400).json({
				message:
					"선택한 군종과 부대 유형이 맞지 않습니다.",
			});
		}

		const enlistmentDate =
			parseDateOnly(
				req.body.enlistmentDate,
				"입대일",
			);

		const dischargeDate =
			parseDateOnly(
				req.body.dischargeDate,
				"전역일",
			);

		if (
			dischargeDate <= enlistmentDate
		) {
			return res.status(400).json({
				message:
					"전역일은 입대일보다 뒤여야 합니다.",
			});
		}

		const unitCode =
			normalizeOptionalText(
				req.body.unitCode,
				50,
			);

		const unitName =
			normalizeOptionalText(
				req.body.unitName,
				30,
			);

		/*
		 * 현재 커뮤니티는 divisionCode 기반입니다.
		 * 기존 사단 라운지와의 호환을 위해 사단 선택일 때만
		 * 구버전 필드에 값을 복사합니다.
		 */
		const legacyDivisionCode =
			unitType === "DIVISION"
				? unitCode
				: null;

		const legacyDivisionName =
			unitType === "DIVISION"
				? unitName
				: null;

		const profile =
			await MilitaryProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						branch,

						unitType,
						unitCode,
						unitName,

						divisionCode:
							legacyDivisionCode,
						divisionName:
							legacyDivisionName,

						enlistmentDate,
						dischargeDate,
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

					unitType,
					unitCode,
					unitName,

					divisionCode:
						legacyDivisionCode,
					divisionName:
						legacyDivisionName,
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
