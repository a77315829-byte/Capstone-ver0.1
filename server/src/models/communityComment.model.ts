import mongoose, {
	Document,
	Schema,
} from "mongoose";

export interface ICommunityComment extends Document {
	postId: mongoose.Types.ObjectId;
	authorId: mongoose.Types.ObjectId;
	authorNickname: string;
	authorCode: string;
	content: string;
	likeCount: number;
	status: "active" | "hidden" | "deleted";
	createdAt: Date;
	updatedAt: Date;
}

const CommunityCommentSchema =
	new Schema<ICommunityComment>(
		{
			postId: {
				type: Schema.Types.ObjectId,
				ref: "CommunityPost",
				required: true,
				index: true,
			},
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
			content: {
				type: String,
				required: true,
				trim: true,
				minlength: 2,
				maxlength: 1000,
			},
			likeCount: {
				type: Number,
				default: 0,
				min: 0,
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

CommunityCommentSchema.index({
	postId: 1,
	createdAt: 1,
});

export default mongoose.models.CommunityComment ||
	mongoose.model<ICommunityComment>(
		"CommunityComment",
		CommunityCommentSchema,
	);
