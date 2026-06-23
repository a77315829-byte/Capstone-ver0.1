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

export type MilitaryUnitType =
	| "CORPS"
	| "DIVISION"
	| "BRIGADE"
	| "FLEET"
	| "COMMAND"
	| "WING"
	| "GROUP"
	| "EDUCATION"
	| "DIRECT"
	| "OTHER";

export interface IMilitaryProfile extends Document {
	userId: mongoose.Types.ObjectId;

	branch: MilitaryBranch;

	unitType?: MilitaryUnitType | null;
	unitCode?: string | null;
	unitName?: string | null;

	/*
	 * 구버전 데이터 마이그레이션용 필드입니다.
	 * 신규 코드에서는 unitType/unitCode/unitName을 사용합니다.
	 */
	divisionCode?: string | null;
	divisionName?: string | null;

	enlistmentDate: Date;
	dischargeDate: Date;

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
				trim: true,
				maxlength: 50,
				index: true,
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
			},
			divisionName: {
				type: String,
				default: null,
			},

			enlistmentDate: {
				type: Date,
				required: true,
			},
			dischargeDate: {
				type: Date,
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
