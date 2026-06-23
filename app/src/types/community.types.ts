export type MilitaryBranch =
	| "ARMY"
	| "NAVY"
	| "AIR_FORCE"
	| "MARINE"
	| "SOCIAL_SERVICE"
	| "ETC";

export type CommunityScope =
	| "global"
	| "branch";

export type CommunityCategory =
	| "전체"
	| "주식·ETF"
	| "저축·적금"
	| "전역 준비"
	| "금융 질문"
	| "사기 예방"
	| "자유";

export type CommunitySort =
	| "latest"
	| "popular"
	| "comments";

export type CommunityLeaderboardMode =
	| "live"
	| "monthly";

export interface CommunityProfile {
	nickname: string;
	branch: MilitaryBranch | null;
	branchName: string | null;
}

export interface CommunityPostSummary {
	id: string;
	scope: CommunityScope;
	branch: MilitaryBranch | null;
	branchName: string | null;
	category: Exclude<CommunityCategory, "전체">;
	title: string;
	contentPreview: string;
	tags: string[];
	authorNickname: string;
	authorCode: string;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	isFeatured: boolean;
	createdAt: string;
}

export interface CommunityPostDetail
	extends CommunityPostSummary {
	content: string;
	updatedAt: string;
}

export interface CommunityComment {
	id: string;
	postId: string;
	authorNickname: string;
	authorCode: string;
	content: string;
	likeCount: number;
	isPostAuthor: boolean;
	createdAt: string;
}

export interface CommunityPostListResponse {
	posts: CommunityPostSummary[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface CommunityLeaderboardEntry {
	id: string;
	userId?: string;
	month: string;
	branch: MilitaryBranch;
	branchName: string;
	nickname: string;
	authorCode: string;
	currentEquity: number;
	startEquity: number;
	returnRate: number;
	maxDrawdown: number;
	consistencyScore: number;
	activityScore: number;
	totalScore: number;
	filledTradeCount: number;
	activeTradingDays: number;
	isEligible: boolean;
	branchRank: number | null;
	overallRank: number | null;
	badge:
		| "투자왕"
		| "수익왕"
		| "안정왕"
		| null;
}

export interface CommunityLeaderboardResponse {
	mode: CommunityLeaderboardMode;
	month: string;
	branch: MilitaryBranch | null;
	generatedAt: string;
	entries: CommunityLeaderboardEntry[];
}

export interface CommunityBranchWinner {
	branch: MilitaryBranch;
	branchName: string;
	winner: CommunityLeaderboardEntry | null;
}

export interface MyCommunityPerformance {
	branch: MilitaryBranch | null;
	branchName: string | null;
	live: CommunityLeaderboardEntry | null;
	monthly: CommunityLeaderboardEntry | null;
}
