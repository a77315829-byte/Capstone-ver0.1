import { Request, Response } from "express";
import mongoose from "mongoose";

import CommunityProfile from "../models/communityProfile.model";
import CommunityPost from "../models/communityPost.model";
import CommunityComment from "../models/communityComment.model";
import CommunityReaction from "../models/communityReaction.model";
import CommunityMonthlyRank from "../models/communityMonthlyRank.model";
import { createCommunityAuthorCode } from "../utils/communityAuthorCode";

const ALLOWED_CATEGORIES = new Set([
	"주식·ETF",
	"저축·적금",
	"전역 준비",
	"금융 질문",
	"사기 예방",
	"자유",
]);

function getUserId(req: Request): string {
	const userId = String((req as any).userId || "");

	if (!mongoose.Types.ObjectId.isValid(userId)) {
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

function getMonthKey(date = new Date()): string {
	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
	].join("-");
}

async function getOrCreateProfile(
	userId: string,
) {
	return CommunityProfile.findOneAndUpdate(
		{
			userId,
		},
		{
			$setOnInsert: {
				userId,
				nickname: "ㅇㅇ",
				divisionCode: null,
				divisionName: null,
			},
		},
		{
			upsert: true,
			new: true,
		},
	);
}

function serializeProfile(profile: any) {
	return {
		nickname: profile.nickname || "ㅇㅇ",
		divisionCode:
			profile.divisionCode || null,
		divisionName:
			profile.divisionName || null,
	};
}

function serializePostSummary(post: any) {
	const content = String(post.content || "");

	return {
		id: String(post._id),
		scope: post.scope,
		divisionCode:
			post.divisionCode || null,
		divisionName:
			post.divisionName || null,
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

function serializePostDetail(post: any) {
	return {
		...serializePostSummary(post),
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

		console.error("getProfile error:", error);
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
			String(req.body.nickname || "ㅇㅇ")
				.trim()
				.slice(0, 12) || "ㅇㅇ";

		const divisionCode =
			req.body.divisionCode
				? String(req.body.divisionCode)
				: null;

		const divisionName =
			req.body.divisionName
				? String(req.body.divisionName)
				: null;

		const profile =
			await CommunityProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						nickname,
						divisionCode,
						divisionName,
						nicknameChangedAt:
							new Date(),
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

		console.error("updateProfile error:", error);
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
			req.query.scope === "division"
				? "division"
				: "global";

		const divisionCode =
			req.query.divisionCode
				? String(req.query.divisionCode)
				: null;

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

		const filter: Record<string, any> = {
			status: "active",
			scope,
		};

		if (scope === "division") {
			if (!divisionCode) {
				return res.status(400).json({
					message:
						"사단 게시판 조회에는 divisionCode가 필요합니다.",
				});
			}

			filter.divisionCode = divisionCode;
		}

		if (
			category &&
			ALLOWED_CATEGORIES.has(category)
		) {
			filter.category = category;
		}

		if (featured) {
			filter.isFeatured = true;
		}

		if (search) {
			const regex = new RegExp(
				escapeRegExp(search),
				"i",
			);

			filter.$or = [
				{ title: regex },
				{ content: regex },
				{ tags: regex },
			];
		}

		const sortName =
			String(req.query.sort || "latest");

		let sort: Record<string, 1 | -1> = {
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

		return res.status(200).json({
			posts: posts.map(
				serializePostSummary,
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
		console.error("listPosts error:", error);
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
			req.body.scope === "division"
				? "division"
				: "global";

		const category =
			String(req.body.category || "");

		const title =
			String(req.body.title || "").trim();

		const content =
			String(req.body.content || "").trim();

		const tags = Array.isArray(req.body.tags)
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

		if (
			scope === "division" &&
			!profile.divisionCode
		) {
			return res.status(400).json({
				message:
					"사단을 설정한 뒤 작성할 수 있습니다.",
			});
		}

		const boardKey =
			scope === "division"
				? `division:${profile.divisionCode}`
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
				divisionCode:
					scope === "division"
						? profile.divisionCode
						: null,
				divisionName:
					scope === "division"
						? profile.divisionName
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

		console.error("createPost error:", error);
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

		return res.status(200).json(
			serializePostDetail(post),
		);
	} catch (error) {
		console.error("getPost error:", error);
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

		if (
			String(post.authorId) === userId
		) {
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

		const featuredThreshold =
			Math.max(
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

		const post = await CommunityPost.findOne({
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

		const content =
			String(req.body.content || "").trim();

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

		const boardKey =
			post.scope === "division"
				? `division:${post.divisionCode}`
				: "global";

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

		if (
			String(post.authorId) !== userId
		) {
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

		console.error("deletePost error:", error);
		return res.status(500).json({
			message:
				"게시글 삭제에 실패했습니다.",
		});
	}
};

const getLeaderboard = async (
	req: Request,
	res: Response,
) => {
	try {
		const month =
			req.query.month
				? String(req.query.month)
				: getMonthKey();

		const divisionCode =
			req.query.divisionCode
				? String(req.query.divisionCode)
				: null;

		const filter: Record<string, any> = {
			month,
		};

		if (divisionCode) {
			filter.divisionCode =
				divisionCode;
		}

		const query =
			CommunityMonthlyRank.find(filter);

		if (divisionCode) {
			query.sort({
				divisionRank: 1,
			});
		} else {
			query.sort({
				overallRank: 1,
			});
		}

		const entries = await query
			.limit(20)
			.lean();

		return res.status(200).json(
			entries.map((entry) => ({
				id: String(entry._id),
				month: entry.month,
				divisionCode:
					entry.divisionCode,
				divisionName:
					entry.divisionName,
				nickname: entry.nickname,
				authorCode:
					entry.authorCode,
				returnRate:
					entry.returnRate,
				maxDrawdown:
					entry.maxDrawdown,
				consistencyScore:
					entry.consistencyScore,
				activityScore:
					entry.activityScore,
				totalScore:
					entry.totalScore,
				divisionRank:
					entry.divisionRank,
				overallRank:
					entry.overallRank,
				badge: entry.badge,
			})),
		);
	} catch (error) {
		console.error(
			"getLeaderboard error:",
			error,
		);
		return res.status(500).json({
			message:
				"투자왕 순위 조회에 실패했습니다.",
		});
	}
};

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
	getLeaderboard,
};
