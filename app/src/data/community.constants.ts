import type {
	CommunityCategory,
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

/*
 * 시연용 선택지입니다.
 * 실제 배포 전 운영 대상 부대 목록에 맞게 수정하세요.
 */
export const DIVISION_OPTIONS = [
	{ code: "DIV_01", name: "1사단" },
	{ code: "DIV_03", name: "3사단" },
	{ code: "DIV_05", name: "5사단" },
	{ code: "DIV_07", name: "7사단" },
	{ code: "DIV_09", name: "9사단" },
	{ code: "DIV_11", name: "11사단" },
	{ code: "DIV_15", name: "15사단" },
	{ code: "DIV_21", name: "21사단" },
	{ code: "DIV_22", name: "22사단" },
	{ code: "DIV_25", name: "25사단" },
	{ code: "DIV_ETC", name: "기타" },
] as const;
