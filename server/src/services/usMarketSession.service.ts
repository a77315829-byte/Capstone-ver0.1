export type UsMarketPhase =
	| "PRE_OPEN"
	| "OPEN"
	| "CLOSED"
	| "WEEKEND"
	| "HOLIDAY";

export interface UsMarketStatus {
	market: "US";
	marketName: string;
	timezone: "America/New_York";

	localDate: string;
	localTime: string;
	weekday: string;

	sessionType: "REGULAR";
	openTime: string;
	closeTime: string;

	phase: UsMarketPhase;
	isOpen: boolean;

	message: string;

	nextOpenLocal: string | null;

	holidayName: string | null;
	earlyCloseName: string | null;

	orderAllowedByOverride: boolean;
}

const US_TIMEZONE =
	"America/New_York";

const DEFAULT_OPEN_TIME =
	"09:30";

const DEFAULT_CLOSE_TIME =
	"16:00";

const WEEKDAY_LABEL:
	Record<string, string> = {
	Mon: "월요일",
	Tue: "화요일",
	Wed: "수요일",
	Thu: "목요일",
	Fri: "금요일",
	Sat: "토요일",
	Sun: "일요일",
};

function timeToMinutes(
	time: string,
): number {
	const [hour, minute] =
		time
			.split(":")
			.map(Number);

	return hour * 60 + minute;
}

function getNewYorkParts(
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
				timeZone: US_TIMEZONE,
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

	const values =
		Object.fromEntries(
			formatter
				.formatToParts(now)
				.map((part) => [
					part.type,
					part.value,
				]),
		);

	return {
		date:
			`${values.year}-${values.month}-${values.day}`,
		time:
			`${values.hour}:${values.minute}:${values.second}`,
		weekday:
			values.weekday ?? "",
		hour:
			Number(values.hour),
		minute:
			Number(values.minute),
		second:
			Number(values.second),
	};
}

function readClosedDates():
	Map<string, string> {
	const result =
		new Map<string, string>();

	const raw =
		process.env
			.US_CLOSED_DATES ?? "";

	for (const token of raw.split(",")) {
		const trimmed =
			token.trim();

		if (!trimmed) {
			continue;
		}

		const separator =
			trimmed.indexOf(":");

		const date =
			separator >= 0
				? trimmed
						.slice(
							0,
							separator,
						)
						.trim()
				: trimmed;

		const name =
			separator >= 0
				? trimmed
						.slice(
							separator + 1,
						)
						.trim()
				: "미국 증시 휴장일";

		if (
			/^\d{4}-\d{2}-\d{2}$/.test(
				date,
			)
		) {
			result.set(
				date,
				name ||
					"미국 증시 휴장일",
			);
		}
	}

	return result;
}

/*
 * 환경변수 형식:
 *
 * US_EARLY_CLOSE_DATES=
 * 2026-11-27=13:00=조기 폐장,
 * 2026-12-24=13:00=조기 폐장
 */
function readEarlyCloseDates():
	Map<
		string,
		{
			closeTime: string;
			name: string;
		}
	> {
	const result =
		new Map<
			string,
			{
				closeTime: string;
				name: string;
			}
		>();

	const raw =
		process.env
			.US_EARLY_CLOSE_DATES ?? "";

	for (const token of raw.split(",")) {
		const [
			date,
			closeTime,
			name,
		] = token
			.split("=")
			.map((item) =>
				item.trim(),
			);

		if (
			/^\d{4}-\d{2}-\d{2}$/.test(
				date,
			) &&
			/^\d{2}:\d{2}$/.test(
				closeTime,
			)
		) {
			result.set(date, {
				closeTime,
				name:
					name ||
					"미국 증시 조기 폐장",
			});
		}
	}

	return result;
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

	return new Date(
		Date.UTC(
			year,
			month - 1,
			day + days,
		),
	)
		.toISOString()
		.slice(0, 10);
}

function getWeekdayForNewYorkDate(
	dateText: string,
): string {
	return new Intl.DateTimeFormat(
		"en-US",
		{
			timeZone:
				US_TIMEZONE,
			weekday: "short",
		},
	).format(
		new Date(
			`${dateText}T12:00:00-05:00`,
		),
	);
}

function isBusinessDate(
	dateText: string,
	closedDates:
		Map<string, string>,
): boolean {
	const weekday =
		getWeekdayForNewYorkDate(
			dateText,
		);

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
		"다음 미국시장 영업일을 계산하지 못했습니다.",
	);
}

function getOverrideEnabled():
	boolean {
	return (
		process.env
			.ALLOW_CLOSED_US_MARKET_ORDERS ===
		"true"
	);
}

export function getUsMarketStatus(
	now = new Date(),
): UsMarketStatus {
	const local =
		getNewYorkParts(now);

	const closedDates =
		readClosedDates();

	const earlyCloseDates =
		readEarlyCloseDates();

	const holidayName =
		closedDates.get(
			local.date,
		) ?? null;

	const earlyClose =
		earlyCloseDates.get(
			local.date,
		) ?? null;

	const closeTime =
		earlyClose?.closeTime ??
		DEFAULT_CLOSE_TIME;

	const currentMinutes =
		local.hour * 60 +
		local.minute;

	const openMinutes =
		timeToMinutes(
			DEFAULT_OPEN_TIME,
		);

	const closeMinutes =
		timeToMinutes(closeTime);

	const weekend =
		isWeekend(local.weekday);

	let phase:
		UsMarketPhase;

	let isOpen = false;
	let message = "";
	let nextOpenLocal:
		string | null = null;

	if (weekend) {
		phase = "WEEKEND";
		message =
			"주말에는 미국 정규시장이 열리지 않습니다.";

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenLocal =
			`${nextDate} ${DEFAULT_OPEN_TIME} ET`;
	} else if (holidayName) {
		phase = "HOLIDAY";
		message =
			`${holidayName}로 미국 정규시장이 휴장입니다.`;

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenLocal =
			`${nextDate} ${DEFAULT_OPEN_TIME} ET`;
	} else if (
		currentMinutes <
		openMinutes
	) {
		phase = "PRE_OPEN";
		message =
			"미국 정규장 개장 전입니다.";

		nextOpenLocal =
			`${local.date} ${DEFAULT_OPEN_TIME} ET`;
	} else if (
		currentMinutes <
		closeMinutes
	) {
		phase = "OPEN";
		isOpen = true;

		message =
			earlyClose
				? `${earlyClose.name} 일정으로 미국 정규장이 운영 중입니다.`
				: "미국 정규장이 운영 중입니다.";
	} else {
		phase = "CLOSED";
		message =
			"미국 정규장이 마감되었습니다.";

		const nextDate =
			findNextBusinessDate(
				local.date,
				false,
				closedDates,
			);

		nextOpenLocal =
			`${nextDate} ${DEFAULT_OPEN_TIME} ET`;
	}

	return {
		market: "US",
		marketName:
			"미국 정규시장",
		timezone:
			US_TIMEZONE,

		localDate:
			local.date,
		localTime:
			local.time,
		weekday:
			WEEKDAY_LABEL[
				local.weekday
			] ??
			local.weekday,

		sessionType:
			"REGULAR",
		openTime:
			DEFAULT_OPEN_TIME,
		closeTime,

		phase,
		isOpen,

		message,

		nextOpenLocal,

		holidayName,
		earlyCloseName:
			earlyClose?.name ??
			null,

		orderAllowedByOverride:
			getOverrideEnabled(),
	};
}
