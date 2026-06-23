import type {
	CommunityCategory,
	MilitaryBranch,
} from "../types/community.types";

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
	"전체",
	"주식·ETF",
	"저축·적금",
	"전역 준비",
	"금융 질문",
	"사기 예방",
	"자유",
];

export const COMMUNITY_BRANCH_OPTIONS: ReadonlyArray<{
	code: Exclude<MilitaryBranch, "ETC">;
	name: string;
	shortName: string;
}> = [
	{
		code: "ARMY",
		name: "육군",
		shortName: "육군",
	},
	{
		code: "NAVY",
		name: "해군",
		shortName: "해군",
	},
	{
		code: "AIR_FORCE",
		name: "공군",
		shortName: "공군",
	},
	{
		code: "MARINE",
		name: "해병대",
		shortName: "해병대",
	},
	{
		code: "SOCIAL_SERVICE",
		name: "사회복무요원",
		shortName: "사회복무",
	},
] as const;

export const COMMUNITY_BRANCH_LABELS: Record<
	MilitaryBranch,
	string
> = {
	ARMY: "육군",
	NAVY: "해군",
	AIR_FORCE: "공군",
	MARINE: "해병대",
	SOCIAL_SERVICE: "사회복무요원",
	ETC: "기타",
};

export function getCommunityBranchName(
	branch: MilitaryBranch | null | undefined,
): string {
	if (!branch) {
		return "복무 구분 미설정";
	}

	return COMMUNITY_BRANCH_LABELS[branch] ?? "기타";
}
