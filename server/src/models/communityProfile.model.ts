import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

import type {
	MilitaryBranch,
	MilitaryUnitType,
} from "./militaryProfile.model";

export interface ICommunityProfile extends Document {
	userId: mongoose.Types.ObjectId;
	nickname: string;

	branch?: MilitaryBranch | null;

	unitType?: MilitaryUnitType | null;
	unitCode?: string | null;
	unitName?: string | null;

	/*
	 * 기존 사단 라운지 코드의 임시 호환 필드입니다.
	 * 커뮤니티를 unitCode 기반으로 전환한 뒤 삭제할 수 있습니다.
	 */
	divisionCode?: string | null;
	divisionName?: string | null;

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
					"ETC",
				],
				default: null,
				index: true,
			},
			unitType: {
				type: String,
				enum: [
					"CORPS",
					"DIVISION",
					"BRIGADE",
					"FLEET",
					"COMMAND",
					"WING",
					"GROUP",
					"EDUCATION",
					"DIRECT",
					"OTHER",
				],
				default: null,
				index: true,
			},
			unitCode: {
				type: String,
				default: null,
				index: true,
				trim: true,
				maxlength: 50,
			},
			unitName: {
				type: String,
				default: null,
				trim: true,
				maxlength: 30,
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
