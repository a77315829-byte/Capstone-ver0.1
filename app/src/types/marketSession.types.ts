export type MarketPhase =
	| "PRE_OPEN"
	| "OPEN"
	| "CLOSED"
	| "WEEKEND"
	| "HOLIDAY";

export interface MarketStatus {
	market: "KRX";
	marketName: string;
	timezone: "Asia/Seoul";

	localDate: string;
	localTime: string;
	weekday: string;

	sessionType: "PRE" | "REGULAR" | "POST" | "CLOSED";
	limitOrderAllowed: boolean;
	sessionLabel: string;
	sessionStartTime: string | null;
	sessionEndTime: string | null;
	openTime: string;
	closeTime: string;

	phase: MarketPhase;
	isOpen: boolean;

	message: string;

	nextOpenAt: string | null;
	countdownTargetAt: string | null;

	holidayName: string | null;
	orderAllowedByOverride: boolean;
}
