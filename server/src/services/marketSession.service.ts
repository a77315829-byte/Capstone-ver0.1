export type MarketCode = "KRX";

export type MarketPhase =
	| "PRE_OPEN"
	| "OPEN"
	| "CLOSED"
	| "WEEKEND"
	| "HOLIDAY";

export interface MarketStatus {
	market: MarketCode;
	marketName: string;
	timezone: string;

	localDate: string;
	localTime: string;
	weekday: string;

	sessionType: "REGULAR";
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

const KRX_TIMEZONE =
	"Asia/Seoul";

const KRX_OPEN_MINUTES =
	9 * 60;

const KRX_CLOSE_MINUTES =
	15 * 60 + 30;

const WEEKDAY_LABEL: Record<
	string,
	string
> = {
	Mon: "월요일",
	Tue: "화요일",
	Wed: "수요일",
	Thu: "목요일",
	Fri: "금요일",
	Sat: "토요일",
	Sun: "일요일",
};

/*
 * 환경변수 형식:
 *
 * KRX_CLOSED_DATES=2026-01-01,2026-02-16,2026-12-31
 *
 * 선택적으로 이름까지 지정:
 *
 * KRX_CLOSED_DATES=2026-01-01:신정,2026-12-31:연말 휴장
 *
 * 한국거래소의 연도별 공식 휴장 공지에 맞춰 갱신합니다.
 */
function readClosedDateMap():
	Map<string, string> {
	const map = new Map<string, string>();

	const raw =
		process.env.KRX_CLOSED_DATES ?? "";

	for (const token of raw.split(",")) {
		const trimmed = token.trim();

		if (!trimmed) {
			continue;
		}

		const separatorIndex =
			trimmed.indexOf(":");

		const date =
			separatorIndex >= 0
				? trimmed
						.slice(
							0,
							separatorIndex,
						)
						.trim()
				: trimmed;

		const name =
			separatorIndex >= 0
				? trimmed
						.slice(
							separatorIndex + 1,
						)
						.trim()
				: "휴장일";

		if (
			/^\d{4}-\d{2}-\d{2}$/.test(
				date,
			)
		) {
			map.set(
				date,
				name || "휴장일",
			);
		}
	}

	return map;
}

function getSeoulParts(
	now: Date,
): {
	date: string;
	time: string;
	weekday: string;
	hour: number;
	minute: number;
	second: number;
} {
	const formatter =
		new Intl.DateTimeFormat(
			"en-CA",
			{
				timeZone: KRX_TIMEZONE,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				weekday: "short",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hourCycle: "h23",
			},
		);

	const parts =
		formatter.formatToParts(now);

	const values =
		Object.fromEntries(
			parts.map((part) => [
				part.type,
				part.value,
			]),
		);

	const date =
		`${values.year}-${values.month}-${values.day}`;

	const time =
		`${values.hour}:${values.minute}:${values.second}`;

	return {
		date,
		time,
		weekday:
			values.weekday ?? "",
		hour: Number(values.hour),
		minute: Number(values.minute),
		second: Number(values.second),
	};
}

function isWeekend(
	weekday: string,
): boolean {
	return (
		weekday === "Sat" ||
		weekday === "Sun"
	);
}

function addCalendarDays(
	dateText: string,
	days: number,
): string {
	const [
		year,
		month,
		day,
	] = dateText
		.split("-")
		.map(Number);

	const date =
		new Date(
			Date.UTC(
				year,
				month - 1,
				day + days,
			),
		);

	return date
		.toISOString()
		.slice(0, 10);
}

function getWeekdayForDate(
	dateText: string,
): string {
	const date =
		new Date(
			`${dateText}T12:00:00+09:00`,
		);

	return new Intl.DateTimeFormat(
		"en-US",
		{
			timeZone: KRX_TIMEZONE,
			weekday: "short",
		},
	).format(date);
}

function isBusinessDate(
	dateText: string,
	closedDates:
		Map<string, string>,
): boolean {
	const weekday =
		getWeekdayForDate(dateText);

	return (
		!isWeekend(weekday) &&
		!closedDates.has(dateText)
	);
}

function findNextBusinessDate(
	fromDate: string,
	includeFromDate: boolean,
	closedDates:
		Map<string, string>,
): string {
	let candidate =
		includeFromDate
			? fromDate
			: addCalendarDays(
					fromDate,
					1,
				);

	for (
		let attempt = 0;
		attempt < 370;
		attempt += 1
	) {
		if (
			isBusinessDate(
				candidate,
				closedDates,
			)
		) {
			return candidate;
		}

		candidate =
			addCalendarDays(
				candidate,
				1,
			);
	}

	throw new Error(
		"다음 국내시장 영업일을 계산하지 못했습니다.",
	);
}

function toKrxIso(
	dateText: string,
	timeText: string,
): string {
	return `${dateText}T${timeText}:00+09:00`;
}

function getOverrideEnabled():
	boolean {
	return (
		process.env
			.ALLOW_CLOSED_MARKET_ORDERS ===
		"true"
	);
}

export function getKrxMarketStatus(
	now = new Date(),
): MarketStatus {
	const closedDates =
		readClosedDateMap();

	const local =
		getSeoulParts(now);

	const currentMinutes =
		local.hour * 60 +
		local.minute;

	const holidayName =
		closedDates.get(
			local.date,
		) ?? null;

	const weekend =
		isWeekend(local.weekday);

	const beforeOpen =
		currentMinutes <
		KRX_OPEN_MINUTES;

	const duringOpen =
		currentMinutes >=
			KRX_OPEN_MINUTES &&
		currentMinutes <
			KRX_CLOSE_MINUTES;

	let phase: MarketPhase;
	let isOpen = false;
	let message = "";
	let nextOpenAt: string | null =
		null;
	let countdownTargetAt:
		string | null = null;

	if (weekend) {
		phase = "WEEKEND";
		message =
			"주말에는 국내 정규시장이 열리지 않습니다.";

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenAt =
			toKrxIso(
				nextDate,
				"09:00",
			);

		countdownTargetAt =
			nextOpenAt;
	} else if (holidayName) {
		phase = "HOLIDAY";
		message =
			`${holidayName}로 국내 정규시장이 휴장입니다.`;

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenAt =
			toKrxIso(
				nextDate,
				"09:00",
			);

		countdownTargetAt =
			nextOpenAt;
	} else if (beforeOpen) {
		phase = "PRE_OPEN";
		message =
			"국내 정규장 개장 전입니다.";

		nextOpenAt =
			toKrxIso(
				local.date,
				"09:00",
			);

		countdownTargetAt =
			nextOpenAt;
	} else if (duringOpen) {
		phase = "OPEN";
		isOpen = true;
		message =
			"국내 정규장이 운영 중입니다.";

		countdownTargetAt =
			toKrxIso(
				local.date,
				"15:30",
			);
	} else {
		phase = "CLOSED";
		message =
			"국내 정규장이 마감되었습니다.";

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenAt =
			toKrxIso(
				nextDate,
				"09:00",
			);

		countdownTargetAt =
			nextOpenAt;
	}

	return {
		market: "KRX",
		marketName:
			"한국거래소 국내 정규시장",
		timezone: KRX_TIMEZONE,

		localDate: local.date,
		localTime: local.time,
		weekday:
			WEEKDAY_LABEL[
				local.weekday
			] ?? local.weekday,

		sessionType: "REGULAR",
		openTime: "09:00",
		closeTime: "15:30",

		phase,
		isOpen,

		message,

		nextOpenAt,
		countdownTargetAt,

		holidayName,
		orderAllowedByOverride:
			getOverrideEnabled(),
	};
}

export function canSubmitKrxOrder(
	now = new Date(),
): {
	allowed: boolean;
	status: MarketStatus;
} {
	const status =
		getKrxMarketStatus(now);

	return {
		allowed:
			status.isOpen ||
			status
				.orderAllowedByOverride,
		status,
	};
}
