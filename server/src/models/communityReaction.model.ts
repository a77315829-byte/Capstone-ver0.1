import mongoose, {
	Document,
	Schema,
} from "mongoose";

export interface ICommunityReaction extends Document {
	userId: mongoose.Types.ObjectId;
	targetType: "post" | "comment";
	targetId: mongoose.Types.ObjectId;
	reactionType: "like" | "bookmark";
	createdAt: Date;
	updatedAt: Date;
}

const CommunityReactionSchema =
	new Schema<ICommunityReaction>(
		{
			userId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				index: true,
			},
			targetType: {
				type: String,
				enum: ["post", "comment"],
				required: true,
			},
			targetId: {
				type: Schema.Types.ObjectId,
				required: true,
				index: true,
			},
			reactionType: {
				type: String,
				enum: ["like", "bookmark"],
				required: true,
			},
		},
		{
			timestamps: true,
		},
	);

CommunityReactionSchema.index(
	{
		userId: 1,
		targetType: 1,
		targetId: 1,
		reactionType: 1,
	},
	{
		unique: true,
	},
);

export default mongoose.models.CommunityReaction ||
	mongoose.model<ICommunityReaction>(
		"CommunityReaction",
		CommunityReactionSchema,
	);
