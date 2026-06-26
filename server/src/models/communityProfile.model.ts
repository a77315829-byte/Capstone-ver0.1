import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

import type {
	MilitaryBranch,
} from "./militaryProfile.model";

export interface ICommunityProfile extends Document {
	userId: mongoose.Types.ObjectId;
	nickname: string;

	branch?: MilitaryBranch | null;

	nicknameChangedAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const CommunityProfileSchema =
	new Schema<ICommunityProfile>(
		{
			userId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				unique: true,
				index: true,
			},
			nickname: {
				type: String,
				default: "ㅇㅇ",
				trim: true,
				maxlength: 12,
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
				],
				default: null,
				index: true,
			},
			nicknameChangedAt: {
				type: Date,
				default: null,
			},
		},
		{
			timestamps: true,
		},
	);

const CommunityProfile =
	(mongoose.models
		.CommunityProfile as Model<ICommunityProfile>) ||
	mongoose.model<ICommunityProfile>(
		"CommunityProfile",
		CommunityProfileSchema,
	);

export default CommunityProfile;
