import mongoose, {
	Document,
	Schema,
} from "mongoose";

export interface ICommunityMonthlyRank extends Document {
	month: string;
	userId?: mongoose.Types.ObjectId | null;
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

	createdAt: Date;
	updatedAt: Date;
}

const CommunityMonthlyRankSchema =
	new Schema<ICommunityMonthlyRank>(
		{
			month: {
				type: String,
				required: true,
				index: true,
			},
			userId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				default: null,
				index: true,
			},
			divisionCode: {
				type: String,
				required: true,
				index: true,
			},
			divisionName: {
				type: String,
				required: true,
			},
			nickname: {
				type: String,
				required: true,
				default: "ㅇㅇ",
			},
			authorCode: {
				type: String,
				required: true,
			},
			returnRate: {
				type: Number,
				required: true,
			},
			maxDrawdown: {
				type: Number,
				required: true,
			},
			consistencyScore: {
				type: Number,
				required: true,
			},
			activityScore: {
				type: Number,
				required: true,
			},
			totalScore: {
				type: Number,
				required: true,
				index: true,
			},
			divisionRank: {
				type: Number,
				required: true,
			},
			overallRank: {
				type: Number,
				required: true,
			},
			badge: {
				type: String,
				enum: [
					"투자왕",
					"수익왕",
					"안정왕",
					null,
				],
				default: null,
			},
		},
		{
			timestamps: true,
		},
	);

CommunityMonthlyRankSchema.index(
	{
		month: 1,
		userId: 1,
	},
	{
		unique: true,
		sparse: true,
	},
);

CommunityMonthlyRankSchema.index({
	month: 1,
	divisionCode: 1,
	divisionRank: 1,
});

export default mongoose.models.CommunityMonthlyRank ||
	mongoose.model<ICommunityMonthlyRank>(
		"CommunityMonthlyRank",
		CommunityMonthlyRankSchema,
	);
