import {
	Request,
	Response,
} from "express";
import mongoose from "mongoose";

import CommunityProfile from "../models/communityProfile.model";
import CommunityPost from "../models/communityPost.model";
import CommunityComment from "../models/communityComment.model";
import CommunityReaction from "../models/communityReaction.model";
import CommunityMonthlyRank from "../models/communityMonthlyRank.model";
import MilitaryProfile, {
	type MilitaryBranch,
} from "../models/militaryProfile.model";

import {
	createCommunityAuthorCode,
} from "../utils/communityAuthorCode";
import {
	BRANCH_LABELS,
	PUBLIC_BRANCHES,
	getLivePerformanceEntries,
	getMonthKey,
	serializePerformanceEntry,
	syncMonthlyPerformance,
} from "../services/portfolioPerformance.service";

const ALLOWED_CATEGORIES = new Set([
	"주식·ETF",
	"저축·적금",
	"전역 준비",
	"금융 질문",
	"사기 예방",
	"자유",
]);

const ALLOWED_BRANCHES = new Set<MilitaryBranch>([
	"ARMY",
	"NAVY",
	"AIR_FORCE",
	"MARINE",
	"SOCIAL_SERVICE",
	"ETC",
]);

function getUserId(req: Request): string {
	/*
	 * 현재 프로젝트의 authJwt.verifyToken은 req.body.userId에
	 * JWT 사용자 ID를 넣습니다. 다른 미들웨어 형식도 함께 지원해
	 * 커뮤니티 API가 인증 방식 차이로 깨지지 않게 합니다.
	 */
	const userId = String(
		(req as any).userId ??
			req.body?.userId ??
			(req as any).user?.id ??
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

function escapeRegExp(value: string): string {
	return value.replace(
		/[.*+?^${}()|[\]\\]/g,
		"\\$&",
	);
}

function normalizeBranch(
	value: unknown,
): MilitaryBranch | null {
	const branch = String(value || "")
		.trim()
		.toUpperCase() as MilitaryBranch;

	return ALLOWED_BRANCHES.has(branch)
		? branch
		: null;
}

function getBranchName(
	branch: MilitaryBranch | null,
): string | null {
	if (!branch) {
		return null;
	}

	return BRANCH_LABELS[branch] ?? "기타";
}

async function getOrCreateProfile(
	userId: string,
) {
	const militaryProfile =
		await MilitaryProfile.findOne({
			userId,
		})
			.select(
				"branch unitType unitCode unitName",
			)
			.lean();

	const setFields: Record<string, any> = {};

	if (militaryProfile) {
		setFields.branch =
			militaryProfile.branch;
		setFields.unitType =
			militaryProfile.unitType ?? null;
		setFields.unitCode =
			militaryProfile.unitCode ?? null;
		setFields.unitName =
			militaryProfile.unitName ?? null;
	}

	return CommunityProfile.findOneAndUpdate(
		{
			userId,
		},
		{
			...(Object.keys(setFields).length > 0
				? {
						$set: setFields,
					}
				: {}),
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
}

function serializeProfile(profile: any) {
	const branch = normalizeBranch(
		profile?.branch,
	);

	return {
		nickname:
			String(profile?.nickname || "ㅇㅇ"),
		branch,
		branchName:
			getBranchName(branch),
	};
}

function serializePostSummary(
	post: any,
	legacyBranch: MilitaryBranch | null = null,
) {
	const content = String(
		post.content || "",
	);

	const branch =
		normalizeBranch(post.branch) ??
		legacyBranch;

	return {
		id: String(post._id),
		scope:
			post.scope === "global"
				? "global"
				: "branch",
		branch,
		branchName:
			getBranchName(branch) ??
			post.branchName ??
			post.divisionName ??
			null,
		category: post.category,
		title: post.title,
		contentPreview:
			content.length > 120
				? `${content.slice(0, 120)}…`
				: content,
		tags: post.tags || [],
		authorNickname:
			post.authorNickname || "ㅇㅇ",
		authorCode: post.authorCode,
		viewCount: post.viewCount || 0,
		likeCount: post.likeCount || 0,
		commentCount:
			post.commentCount || 0,
		isFeatured:
			Boolean(post.isFeatured),
		createdAt: post.createdAt,
	};
}

function serializePostDetail(
	post: any,
	legacyBranch: MilitaryBranch | null = null,
) {
	return {
		...serializePostSummary(
			post,
			legacyBranch,
		),
		content: post.content,
		updatedAt: post.updatedAt,
	};
}

function serializeComment(
	comment: any,
	postAuthorId: string,
) {
	return {
		id: String(comment._id),
		postId: String(comment.postId),
		authorNickname:
			comment.authorNickname || "ㅇㅇ",
		authorCode: comment.authorCode,
		content: comment.content,
		likeCount: comment.likeCount || 0,
		isPostAuthor:
			String(comment.authorId) ===
			postAuthorId,
		createdAt: comment.createdAt,
	};
}

async function getLegacyBranchByAuthor(
	authorIds: string[],
) {
	const validIds = authorIds.filter(
		(id) =>
			mongoose.Types.ObjectId.isValid(id),
	);

	const [communityProfiles, militaryProfiles] =
		await Promise.all([
			CommunityProfile.find({
				userId: {
					$in: validIds,
				},
			})
				.select("userId branch")
				.lean(),
			MilitaryProfile.find({
				userId: {
					$in: validIds,
				},
			})
				.select("userId branch")
				.lean(),
		]);

	const map = new Map<
		string,
		MilitaryBranch
	>();

	for (const profile of militaryProfiles) {
		const branch = normalizeBranch(
			profile.branch,
		);

		if (branch) {
			map.set(
				String(profile.userId),
				branch,
			);
		}
	}

	for (const profile of communityProfiles) {
		const branch = normalizeBranch(
			profile.branch,
		);

		if (branch) {
			map.set(
				String(profile.userId),
				branch,
			);
		}
	}

	return map;
}

const getProfile = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const profile =
			await getOrCreateProfile(userId);

		return res.status(200).json(
			serializeProfile(profile),
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"getProfile error:",
			error,
		);
		return res.status(500).json({
			message:
				"커뮤니티 프로필 조회에 실패했습니다.",
		});
	}
};

const updateProfile = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);

		const nickname =
			String(
				req.body.nickname || "ㅇㅇ",
			)
				.trim()
				.slice(0, 12) || "ㅇㅇ";

		await getOrCreateProfile(userId);

		const profile =
			await CommunityProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						nickname,
						nicknameChangedAt:
							new Date(),
					},
				},
				{
					new: true,
					runValidators: true,
				},
			);

		return res.status(200).json(
			serializeProfile(profile),
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"updateProfile error:",
			error,
		);
		return res.status(500).json({
			message:
				"커뮤니티 설정 저장에 실패했습니다.",
		});
	}
};

const listPosts = async (
	req: Request,
	res: Response,
) => {
	try {
		const scope =
			req.query.scope === "branch"
				? "branch"
				: "global";

		const branch = normalizeBranch(
			req.query.branch,
		);

		const category =
			req.query.category
				? String(req.query.category)
				: null;

		const search =
			req.query.search
				? String(req.query.search).trim()
				: "";

		const featured =
			req.query.featured === "true" ||
			req.query.featured === "1";

		const page = Math.max(
			1,
			Number(req.query.page) || 1,
		);

		const limit = Math.min(
			50,
			Math.max(
				1,
				Number(req.query.limit) || 20,
			),
		);

		if (scope === "branch" && !branch) {
			return res.status(400).json({
				message:
					"군종 게시판 조회에는 branch가 필요합니다.",
			});
		}

		const andConditions: Record<
			string,
			any
		>[] = [
			{
				status: "active",
			},
		];

		if (scope === "global") {
			andConditions.push({
				scope: "global",
			});
		} else if (branch) {
			const [communityUserIds, militaryUserIds] =
				await Promise.all([
					CommunityProfile.distinct(
						"userId",
						{
							branch,
						},
					),
					MilitaryProfile.distinct(
						"userId",
						{
							branch,
						},
					),
				]);

			const legacyAuthorIds = [
				...communityUserIds,
				...militaryUserIds,
			];

			andConditions.push({
				$or: [
					{
						scope: "branch",
						branch,
					},
					{
						scope: "division",
						authorId: {
							$in: legacyAuthorIds,
						},
					},
				],
			});
		}

		if (
			category &&
			ALLOWED_CATEGORIES.has(category)
		) {
			andConditions.push({
				category,
			});
		}

		if (featured) {
			andConditions.push({
				isFeatured: true,
			});
		}

		if (search) {
			const regex = new RegExp(
				escapeRegExp(search),
				"i",
			);

			andConditions.push({
				$or: [
					{ title: regex },
					{ content: regex },
					{ tags: regex },
				],
			});
		}

		const filter = {
			$and: andConditions,
		};

		const sortName = String(
			req.query.sort || "latest",
		);

		let sort: Record<
			string,
			1 | -1
		> = {
			createdAt: -1,
		};

		if (sortName === "popular") {
			sort = {
				likeCount: -1,
				createdAt: -1,
			};
		} else if (sortName === "comments") {
			sort = {
				commentCount: -1,
				createdAt: -1,
			};
		}

		const [posts, total] =
			await Promise.all([
				CommunityPost.find(filter)
					.sort(sort)
					.skip((page - 1) * limit)
					.limit(limit)
					.lean(),
				CommunityPost.countDocuments(
					filter,
				),
			]);

		const legacyBranchMap =
			await getLegacyBranchByAuthor(
				posts
					.filter(
						(post: any) =>
							post.scope ===
							"division",
					)
					.map((post: any) =>
						String(post.authorId),
					),
			);

		return res.status(200).json({
			posts: posts.map((post: any) =>
				serializePostSummary(
					post,
					legacyBranchMap.get(
						String(post.authorId),
					) ?? null,
				),
			),
			page,
			limit,
			total,
			totalPages: Math.max(
				1,
				Math.ceil(total / limit),
			),
		});
	} catch (error) {
		console.error(
			"listPosts error:",
			error,
		);
		return res.status(500).json({
			message:
				"게시글 목록 조회에 실패했습니다.",
		});
	}
};

const createPost = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const profile =
			await getOrCreateProfile(userId);

		const scope =
			req.body.scope === "branch"
				? "branch"
				: "global";

		const category = String(
			req.body.category || "",
		);
		const title = String(
			req.body.title || "",
		).trim();
		const content = String(
			req.body.content || "",
		).trim();

		const tags = Array.isArray(
			req.body.tags,
		)
			? req.body.tags
					.map((tag: unknown) =>
						String(tag)
							.trim()
							.replace(/^#/, "")
							.slice(0, 20),
					)
					.filter(Boolean)
					.slice(0, 5)
			: [];

		if (!ALLOWED_CATEGORIES.has(category)) {
			return res.status(400).json({
				message:
					"유효하지 않은 카테고리입니다.",
			});
		}

		if (
			title.length < 2 ||
			title.length > 80
		) {
			return res.status(400).json({
				message:
					"제목은 2~80자로 입력하세요.",
			});
		}

		if (
			content.length < 5 ||
			content.length > 5000
		) {
			return res.status(400).json({
				message:
					"내용은 5~5000자로 입력하세요.",
			});
		}

		const branch = normalizeBranch(
			profile.branch,
		);

		if (scope === "branch" && !branch) {
			return res.status(400).json({
				message:
					"마이페이지에서 복무 구분을 먼저 설정하세요.",
			});
		}

		const boardKey =
			scope === "branch"
				? `branch:${branch}`
				: "global";

		const authorCode =
			createCommunityAuthorCode({
				userId,
				boardKey,
			});

		const post =
			await CommunityPost.create({
				authorId: userId,
				authorNickname:
					profile.nickname || "ㅇㅇ",
				authorCode,
				scope,
				branch:
					scope === "branch"
						? branch
						: null,
				branchName:
					scope === "branch"
						? getBranchName(branch)
						: null,
				category,
				title,
				content,
				tags,
			});

		return res.status(201).json(
			serializePostDetail(post),
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"createPost error:",
			error,
		);
		return res.status(500).json({
			message:
				"게시글 등록에 실패했습니다.",
		});
	}
};

const getPost = async (
	req: Request,
	res: Response,
) => {
	try {
		const { postId } = req.params;

		if (
			!mongoose.Types.ObjectId.isValid(
				postId,
			)
		) {
			return res.status(400).json({
				message:
					"잘못된 게시글 ID입니다.",
			});
		}

		const post =
			await CommunityPost.findOneAndUpdate(
				{
					_id: postId,
					status: "active",
				},
				{
					$inc: {
						viewCount: 1,
					},
				},
				{
					new: true,
				},
			).lean();

		if (!post) {
			return res.status(404).json({
				message:
					"게시글을 찾을 수 없습니다.",
			});
		}

		const legacyBranchMap =
			post.scope === "division"
				? await getLegacyBranchByAuthor([
						String(post.authorId),
					])
				: new Map<
						string,
						MilitaryBranch
					>();

		return res.status(200).json(
			serializePostDetail(
				post,
				legacyBranchMap.get(
					String(post.authorId),
				) ?? null,
			),
		);
	} catch (error) {
		console.error(
			"getPost error:",
			error,
		);
		return res.status(500).json({
			message:
				"게시글 조회에 실패했습니다.",
		});
	}
};

const togglePostLike = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const { postId } = req.params;

		if (
			!mongoose.Types.ObjectId.isValid(
				postId,
			)
		) {
			return res.status(400).json({
				message:
					"잘못된 게시글 ID입니다.",
			});
		}

		const post =
			await CommunityPost.findOne({
				_id: postId,
				status: "active",
			});

		if (!post) {
			return res.status(404).json({
				message:
					"게시글을 찾을 수 없습니다.",
			});
		}

		if (String(post.authorId) === userId) {
			return res.status(400).json({
				message:
					"본인 글은 추천할 수 없습니다.",
			});
		}

		const existing =
			await CommunityReaction.findOne({
				userId,
				targetType: "post",
				targetId: postId,
				reactionType: "like",
			});

		let liked: boolean;

		if (existing) {
			await existing.deleteOne();
			liked = false;
		} else {
			await CommunityReaction.create({
				userId,
				targetType: "post",
				targetId: postId,
				reactionType: "like",
			});
			liked = true;
		}

		const likeCount =
			await CommunityReaction.countDocuments(
				{
					targetType: "post",
					targetId: postId,
					reactionType: "like",
				},
			);

		const featuredThreshold = Math.max(
			1,
			Number(
				process.env
					.COMMUNITY_FEATURED_LIKE_THRESHOLD,
			) || 5,
		);

		const isFeatured =
			likeCount >= featuredThreshold &&
			post.reportCount < 2;

		post.likeCount = likeCount;
		post.isFeatured = isFeatured;
		await post.save();

		return res.status(200).json({
			liked,
			likeCount,
			isFeatured,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"togglePostLike error:",
			error,
		);
		return res.status(500).json({
			message:
				"게시글 추천 처리에 실패했습니다.",
		});
	}
};

const listComments = async (
	req: Request,
	res: Response,
) => {
	try {
		const { postId } = req.params;

		if (
			!mongoose.Types.ObjectId.isValid(
				postId,
			)
		) {
			return res.status(400).json({
				message:
					"잘못된 게시글 ID입니다.",
			});
		}

		const post =
			await CommunityPost.findOne({
				_id: postId,
				status: "active",
			})
				.select("authorId")
				.exec();

		if (!post) {
			return res.status(404).json({
				message:
					"게시글을 찾을 수 없습니다.",
			});
		}

		const comments =
			await CommunityComment.find({
				postId,
				status: "active",
			})
				.sort({
					createdAt: 1,
				})
				.lean();

		return res.status(200).json(
			comments.map((comment) =>
				serializeComment(
					comment,
					String(post.authorId),
				),
			),
		);
	} catch (error) {
		console.error(
			"listComments error:",
			error,
		);
		return res.status(500).json({
			message:
				"댓글 조회에 실패했습니다.",
		});
	}
};

const createComment = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const { postId } = req.params;

		if (
			!mongoose.Types.ObjectId.isValid(
				postId,
			)
		) {
			return res.status(400).json({
				message:
					"잘못된 게시글 ID입니다.",
			});
		}

		const content = String(
			req.body.content || "",
		).trim();

		if (
			content.length < 2 ||
			content.length > 1000
		) {
			return res.status(400).json({
				message:
					"댓글은 2~1000자로 입력하세요.",
			});
		}

		const post =
			await CommunityPost.findOne({
				_id: postId,
				status: "active",
			});

		if (!post) {
			return res.status(404).json({
				message:
					"게시글을 찾을 수 없습니다.",
			});
		}

		const profile =
			await getOrCreateProfile(userId);

		const branch =
			normalizeBranch(post.branch) ??
			normalizeBranch(profile.branch);

		const boardKey =
			post.scope === "global"
				? "global"
				: `branch:${branch ?? "ETC"}`;

		const authorCode =
			createCommunityAuthorCode({
				userId,
				boardKey,
			});

		const comment =
			await CommunityComment.create({
				postId,
				authorId: userId,
				authorNickname:
					profile.nickname || "ㅇㅇ",
				authorCode,
				content,
			});

		post.commentCount += 1;
		await post.save();

		return res.status(201).json(
			serializeComment(
				comment,
				String(post.authorId),
			),
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"createComment error:",
			error,
		);
		return res.status(500).json({
			message:
				"댓글 등록에 실패했습니다.",
		});
	}
};

const deletePost = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const { postId } = req.params;

		const post =
			await CommunityPost.findOne({
				_id: postId,
				status: "active",
			});

		if (!post) {
			return res.status(404).json({
				message:
					"게시글을 찾을 수 없습니다.",
			});
		}

		if (String(post.authorId) !== userId) {
			return res.status(403).json({
				message:
					"본인 글만 삭제할 수 있습니다.",
			});
		}

		post.status = "deleted";
		await post.save();

		return res.status(200).json({
			success: true,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"deletePost error:",
			error,
		);
		return res.status(500).json({
			message:
				"게시글 삭제에 실패했습니다.",
		});
	}
};

const getLiveLeaderboard = async (
	req: Request,
	res: Response,
) => {
	try {
		const branch = normalizeBranch(
			req.query.branch,
		);
		const month =
			req.query.month
				? String(req.query.month)
				: getMonthKey();
		const limit = Math.min(
			100,
			Math.max(
				1,
				Number(req.query.limit) || 30,
			),
		);

		const entries =
			await getLivePerformanceEntries(
				month,
			);

		const filtered = entries
			.filter((entry) =>
				branch
					? entry.branch === branch
					: true,
			)
			.sort((a, b) =>
				branch
					? (a.branchRank ?? 9999) -
						(b.branchRank ?? 9999)
					: (a.overallRank ?? 9999) -
						(b.overallRank ?? 9999),
			)
			.slice(0, limit)
			.map(serializePerformanceEntry);

		return res.status(200).json({
			mode: "live",
			month,
			branch,
			generatedAt:
				new Date().toISOString(),
			entries: filtered,
		});
	} catch (error) {
		console.error(
			"getLiveLeaderboard error:",
			error,
		);
		return res.status(500).json({
			message:
				"실시간 수익률 순위 조회에 실패했습니다.",
		});
	}
};

const getMonthlyLeaderboard = async (
	req: Request,
	res: Response,
) => {
	try {
		const branch = normalizeBranch(
			req.query.branch,
		);
		const month =
			req.query.month
				? String(req.query.month)
				: getMonthKey();
		const limit = Math.min(
			100,
			Math.max(
				1,
				Number(req.query.limit) || 30,
			),
		);

		await syncMonthlyPerformance(month);

		const filter: Record<string, any> = {
			month,
			market: "DOMESTIC",
		};

		if (branch) {
			filter.branch = branch;
		}

		const entries =
			await CommunityMonthlyRank.find(
				filter,
			)
				.sort(
					branch
						? {
							isEligible: -1,
							branchRank: 1,
							totalScore: -1,
						}
						: {
							isEligible: -1,
							overallRank: 1,
							totalScore: -1,
						},
				)
				.limit(limit)
				.lean();

		return res.status(200).json({
			mode: "monthly",
			month,
			branch,
			generatedAt:
				new Date().toISOString(),
			entries: entries.map(
				serializePerformanceEntry,
			),
		});
	} catch (error) {
		console.error(
			"getMonthlyLeaderboard error:",
			error,
		);
		return res.status(500).json({
			message:
				"이달의 투자왕 순위 조회에 실패했습니다.",
		});
	}
};

const getBranchWinners = async (
	req: Request,
	res: Response,
) => {
	try {
		const month =
			req.query.month
				? String(req.query.month)
				: getMonthKey();

		await syncMonthlyPerformance(month);

		const winners = await Promise.all(
			PUBLIC_BRANCHES.map(
				async (branch) => {
					const winner =
						await CommunityMonthlyRank.findOne(
							{
								month,
								market:
									"DOMESTIC",
								branch,
								isEligible:
									true,
								branchRank: 1,
							},
						)
							.lean();

					return {
						branch,
						branchName:
							BRANCH_LABELS[branch],
						winner: winner
							? serializePerformanceEntry(
									winner,
								)
							: null,
					};
				},
			),
		);

		return res.status(200).json({
			month,
			generatedAt:
				new Date().toISOString(),
			winners,
		});
	} catch (error) {
		console.error(
			"getBranchWinners error:",
			error,
		);
		return res.status(500).json({
			message:
				"군종별 투자왕 조회에 실패했습니다.",
		});
	}
};

const getMyLeaderboard = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId = getUserId(req);
		const month =
			req.query.month
				? String(req.query.month)
				: getMonthKey();

		const [profile, liveEntries] =
			await Promise.all([
				getOrCreateProfile(userId),
				getLivePerformanceEntries(
					month,
				),
			]);

		await syncMonthlyPerformance(month);

		const monthly =
			await CommunityMonthlyRank.findOne({
				month,
				market: "DOMESTIC",
				userId,
			}).lean();

		const branch = normalizeBranch(
			profile.branch,
		);

		const live = liveEntries.find(
			(entry) =>
				entry.userId === userId,
		);

		return res.status(200).json({
			branch,
			branchName:
				getBranchName(branch),
			live: live
				? serializePerformanceEntry(
						live,
					)
				: null,
			monthly: monthly
				? serializePerformanceEntry(
						monthly,
					)
				: null,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "UNAUTHORIZED"
		) {
			return res.status(401).json({
				message: "로그인이 필요합니다.",
			});
		}

		console.error(
			"getMyLeaderboard error:",
			error,
		);
		return res.status(500).json({
			message:
				"내 투자 순위 조회에 실패했습니다.",
		});
	}
};

/* 기존 /community/leaderboard 경로 호환 */
const getLeaderboard = getMonthlyLeaderboard;

export default {
	getProfile,
	updateProfile,
	listPosts,
	createPost,
	getPost,
	togglePostLike,
	listComments,
	createComment,
	deletePost,
	getLiveLeaderboard,
	getMonthlyLeaderboard,
	getBranchWinners,
	getMyLeaderboard,
	getLeaderboard,
};
