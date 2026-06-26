import type {
	MilitaryBranch,
	MilitaryRank,
	MilitaryRankMode,
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
