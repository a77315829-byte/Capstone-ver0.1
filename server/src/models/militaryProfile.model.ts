import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

export type MilitaryBranch =
	| "ARMY"
	| "NAVY"
	| "AIR_FORCE"
	| "MARINE"
	| "SOCIAL_SERVICE"
	| "ETC";

export type MilitaryRank =
	| "PRIVATE"
	| "PRIVATE_FIRST_CLASS"
	| "CORPORAL"
	| "SERGEANT";

export type MilitaryRankMode =
	| "AUTO"
	| "MANUAL";

export type DischargeDateSource =
	| "AUTO"
	| "MANUAL";

export interface IMilitaryProfile extends Document {
	userId: mongoose.Types.ObjectId;

	branch: MilitaryBranch;

	enlistmentDate: Date;
	dischargeDate: Date;
	dischargeDateSource: DischargeDateSource;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;

	createdAt: Date;
	updatedAt: Date;
}

const militaryProfileSchema =
	new Schema<IMilitaryProfile>(
		{
			userId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				unique: true,
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
				],
				default: "ARMY",
				required: true,
			},
			enlistmentDate: {
				type: Date,
				required: true,
			},
			dischargeDate: {
				type: Date,
				required: true,
			},
			dischargeDateSource: {
				type: String,
				enum: ["AUTO", "MANUAL"],
				/*
				 * 기존 데이터는 사용자가 직접 입력한 날짜로 간주합니다.
				 * 새 프로필은 프론트에서 AUTO를 명시해 저장합니다.
				 */
				default: "MANUAL",
				required: true,
			},
			selectedRank: {
				type: String,
				enum: [
					"PRIVATE",
					"PRIVATE_FIRST_CLASS",
					"CORPORAL",
					"SERGEANT",
				],
				default: "PRIVATE",
				required: true,
			},
			rankMode: {
				type: String,
				enum: ["AUTO", "MANUAL"],
				default: "AUTO",
				required: true,
			},
		},
		{
			timestamps: true,
		},
	);

militaryProfileSchema.index(
	{
		userId: 1,
	},
	{
		unique: true,
	},
);

const MilitaryProfile =
	(mongoose.models
		.MilitaryProfile as Model<IMilitaryProfile>) ||
	mongoose.model<IMilitaryProfile>(
		"MilitaryProfile",
		militaryProfileSchema,
	);

export default MilitaryProfile;
