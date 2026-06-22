import type {
	MilitaryBranch,
	MilitaryRank,
	MilitaryRankMode,
	MilitaryUnitType,
} from "../types/militaryProfile.types";

export const MILITARY_BRANCH_OPTIONS: Array<{
	value: MilitaryBranch;
	label: string;
}> = [
	{ value: "ARMY", label: "육군" },
	{ value: "NAVY", label: "해군" },
	{ value: "AIR_FORCE", label: "공군" },
	{ value: "MARINE", label: "해병대" },
	{ value: "ETC", label: "기타" },
];

export const MILITARY_RANK_OPTIONS: Array<{
	value: MilitaryRank;
	label: string;
}> = [
	{ value: "PRIVATE", label: "이병" },
	{
		value: "PRIVATE_FIRST_CLASS",
		label: "일병",
	},
	{ value: "CORPORAL", label: "상병" },
	{ value: "SERGEANT", label: "병장" },
];

export const MILITARY_RANK_MODE_OPTIONS: Array<{
	value: MilitaryRankMode;
	label: string;
	description: string;
}> = [
	{
		value: "AUTO",
		label: "날짜 기준 자동 계산",
		description:
			"입대일을 기준으로 예상 계급을 자동 변경합니다.",
	},
	{
		value: "MANUAL",
		label: "직접 설정",
		description:
			"선택한 계급을 그대로 표시합니다.",
	},
];

const ALL_UNIT_TYPE_OPTIONS: Array<{
	value: MilitaryUnitType;
	label: string;
}> = [
	{ value: "CORPS", label: "군단" },
	{ value: "DIVISION", label: "사단" },
	{ value: "BRIGADE", label: "여단" },
	{ value: "FLEET", label: "함대" },
	{ value: "COMMAND", label: "사령부" },
	{ value: "WING", label: "비행단" },
	{ value: "GROUP", label: "전단·단" },
	{ value: "EDUCATION", label: "교육부대" },
	{ value: "DIRECT", label: "직할부대" },
	{ value: "OTHER", label: "기타" },
];

const UNIT_TYPES_BY_BRANCH: Record<
	MilitaryBranch,
	MilitaryUnitType[]
> = {
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

export function getUnitTypeOptions(
	branch: MilitaryBranch,
) {
	const allowed =
		new Set(UNIT_TYPES_BY_BRANCH[branch]);

	return ALL_UNIT_TYPE_OPTIONS.filter(
		(option) => allowed.has(option.value),
	);
}

export function isUnitTypeAllowed(
	branch: MilitaryBranch,
	unitType: MilitaryUnitType | null,
): boolean {
	if (!unitType) {
		return true;
	}

	return UNIT_TYPES_BY_BRANCH[
		branch
	].includes(unitType);
}

/*
 * 실제 공개 상위 부대 목록을 추가할 때 사용할 데이터 구조입니다.
 * 지금은 구조만 준비하고, 잘못된 목록을 넣지 않기 위해 비워 둡니다.
 *
 * 예:
 * {
 *   code: "ARMY_DIV_03",
 *   branch: "ARMY",
 *   unitType: "DIVISION",
 *   name: "3사단",
 * }
 */
export interface PublicMilitaryUnitOption {
	code: string;
	branch: MilitaryBranch;
	unitType: MilitaryUnitType;
	name: string;
	isActive: boolean;
}

export const PUBLIC_MILITARY_UNIT_OPTIONS:
	PublicMilitaryUnitOption[] = [];

export function getPublicUnitOptions(
	branch: MilitaryBranch,
	unitType: MilitaryUnitType | null,
) {
	if (!unitType) {
		return [];
	}

	return PUBLIC_MILITARY_UNIT_OPTIONS.filter(
		(option) =>
			option.isActive &&
			option.branch === branch &&
			option.unitType === unitType,
	);
}

export const BRANCH_LABEL: Record<
	MilitaryBranch,
	string
> = {
	ARMY: "육군",
	NAVY: "해군",
	AIR_FORCE: "공군",
	MARINE: "해병대",
	ETC: "기타",
};

export const RANK_LABEL: Record<
	MilitaryRank,
	string
> = {
	PRIVATE: "이병",
	PRIVATE_FIRST_CLASS: "일병",
	CORPORAL: "상병",
	SERGEANT: "병장",
};

export const RANK_MODE_LABEL: Record<
	MilitaryRankMode,
	string
> = {
	AUTO: "자동 계산",
	MANUAL: "직접 설정",
};

export const UNIT_TYPE_LABEL: Record<
	MilitaryUnitType,
	string
> = {
	CORPS: "군단",
	DIVISION: "사단",
	BRIGADE: "여단",
	FLEET: "함대",
	COMMAND: "사령부",
	WING: "비행단",
	GROUP: "전단·단",
	EDUCATION: "교육부대",
	DIRECT: "직할부대",
	OTHER: "기타",
};
