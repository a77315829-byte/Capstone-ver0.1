export type MilitaryBranch =
	| "ARMY"
	| "NAVY"
	| "AIR_FORCE"
	| "MARINE"
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

export interface MilitaryProfile {
	id: string;
	userId: string;

	branch: MilitaryBranch;

	unitType: MilitaryUnitType | null;
	unitCode: string | null;
	unitName: string | null;

	enlistmentDate: string;
	dischargeDate: string;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;

	calculatedRank: MilitaryRank;
	displayRank: MilitaryRank;

	nextPromotionRank: MilitaryRank | null;
	nextPromotionDate: string | null;

	daysUntilDischarge: number;
	serviceProgress: number;
	isDischarged: boolean;

	createdAt: string;
	updatedAt: string;
}

export interface MilitaryProfileResponse {
	configured: boolean;
	profile: MilitaryProfile | null;
}

export interface SaveMilitaryProfileRequest {
	branch: MilitaryBranch;

	unitType: MilitaryUnitType | null;
	unitCode: string | null;
	unitName: string | null;

	enlistmentDate: string;
	dischargeDate: string;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;
}
