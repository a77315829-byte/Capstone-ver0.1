export type CommunityScope = "global" | "division";

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

export interface CommunityProfile {
	nickname: string;
	divisionCode: string | null;
	divisionName: string | null;
}

export interface CommunityPostSummary {
	id: string;
	scope: CommunityScope;
	divisionCode: string | null;
	divisionName: string | null;
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
	month: string;
	divisionCode: string;
	divisionName: string;
	nickname: string;
	authorCode: string;
	returnRate: number;
	maxDrawdown: number;
	consistencyScore: number;
	activityScore: number;
	totalScore: number;
	divisionRank: number;
	overallRank: number;
	badge:
		| "투자왕"
		| "수익왕"
		| "안정왕"
		| null;
}
