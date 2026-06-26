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

export type DischargeDateSource =
	| "AUTO"
	| "MANUAL";

export interface MilitaryProfile {
	id: string;
	userId: string;

	branch: MilitaryBranch;

	enlistmentDate: string;
	dischargeDate: string;
	dischargeDateSource: DischargeDateSource;

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
	serviceMonthsByBranch: Partial<
		Record<MilitaryBranch, number>
	>;
}

export interface SaveMilitaryProfileRequest {
	branch: MilitaryBranch;

	enlistmentDate: string;
	dischargeDate: string;
	dischargeDateSource: DischargeDateSource;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;
}
