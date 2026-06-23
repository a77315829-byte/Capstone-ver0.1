import mongoose, {
	Document,
	Schema,
} from "mongoose";

import type {
	MilitaryBranch,
} from "./militaryProfile.model";

export type CommunityPostScope =
	| "global"
	| "branch"
	| "division";

export interface ICommunityPost extends Document {
	authorId: mongoose.Types.ObjectId;
	authorNickname: string;
	authorCode: string;

	scope: CommunityPostScope;
	branch?: MilitaryBranch | null;
	branchName?: string | null;

	/* 구버전 데이터 호환용 */
	divisionCode?: string | null;
	divisionName?: string | null;

	category: string;
	title: string;
	content: string;
	tags: string[];

	viewCount: number;
	likeCount: number;
	commentCount: number;
	reportCount: number;

	isFeatured: boolean;
	status: "active" | "hidden" | "deleted";

	createdAt: Date;
	updatedAt: Date;
}

const CommunityPostSchema =
	new Schema<ICommunityPost>(
		{
			authorId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				index: true,
			},
			authorNickname: {
				type: String,
				required: true,
				default: "ㅇㅇ",
			},
			authorCode: {
				type: String,
				required: true,
			},
			scope: {
				type: String,
				enum: ["global", "branch", "division"],
				required: true,
				index: true,
			},
			branch: {
				type: String,
				enum: [
					"ARMY",
					"NAVY",
					"AIR_FORCE",
					"MARINE",
					"SOCIAL_SERVICE",
					"ETC",
					null,
				],
				default: null,
				index: true,
			},
			branchName: {
				type: String,
				default: null,
			},
			divisionCode: {
				type: String,
				default: null,
				index: true,
			},
			divisionName: {
				type: String,
				default: null,
			},
			category: {
				type: String,
				required: true,
				index: true,
			},
			title: {
				type: String,
				required: true,
				trim: true,
				minlength: 2,
				maxlength: 80,
			},
			content: {
				type: String,
				required: true,
				trim: true,
				minlength: 5,
				maxlength: 5000,
			},
			tags: {
				type: [String],
				default: [],
			},
			viewCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			likeCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			commentCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			reportCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			isFeatured: {
				type: Boolean,
				default: false,
				index: true,
			},
			status: {
				type: String,
				enum: ["active", "hidden", "deleted"],
				default: "active",
				index: true,
			},
		},
		{
			timestamps: true,
		},
	);

CommunityPostSchema.index({
	scope: 1,
	branch: 1,
	createdAt: -1,
});

CommunityPostSchema.index({
	isFeatured: 1,
	likeCount: -1,
	createdAt: -1,
});

export default mongoose.models.CommunityPost ||
	mongoose.model<ICommunityPost>(
		"CommunityPost",
		CommunityPostSchema,
	);
