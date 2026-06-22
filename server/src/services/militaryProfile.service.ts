import type {
	IMilitaryProfile,
	MilitaryRank,
} from "../models/militaryProfile.model";

/*
 * 프로젝트에서 사용하는 예상 계급 일정입니다.
 * 실제 행정상 진급일과 다를 수 있으므로 화면에는
 * 반드시 "예상 계급"으로 표시합니다.
 *
 * 입대일 기준:
 * 0개월  : 이병
 * 2개월  : 일병
 * 8개월  : 상병
 * 14개월 : 병장
 */
const RANK_SCHEDULE: Array<{
	rank: MilitaryRank;
	monthsFromEnlistment: number;
}> = [
	{
		rank: "PRIVATE",
		monthsFromEnlistment: 0,
	},
	{
		rank: "PRIVATE_FIRST_CLASS",
		monthsFromEnlistment: 2,
	},
	{
		rank: "CORPORAL",
		monthsFromEnlistment: 8,
	},
	{
		rank: "SERGEANT",
		monthsFromEnlistment: 14,
	},
];

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
		),
	);
}

function addUtcMonths(
	date: Date,
	months: number,
): Date {
	const result = startOfUtcDay(date);
	const originalDay = result.getUTCDate();

	result.setUTCDate(1);
	result.setUTCMonth(
		result.getUTCMonth() + months,
	);

	const lastDayOfTargetMonth =
		new Date(
			Date.UTC(
				result.getUTCFullYear(),
				result.getUTCMonth() + 1,
				0,
			),
		).getUTCDate();

	result.setUTCDate(
		Math.min(
			originalDay,
			lastDayOfTargetMonth,
		),
	);

	return result;
}

function toDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function differenceInDays(
	from: Date,
	to: Date,
): number {
	const millisecondsPerDay =
		24 * 60 * 60 * 1000;

	return Math.ceil(
		(
			startOfUtcDay(to).getTime() -
			startOfUtcDay(from).getTime()
		) / millisecondsPerDay,
	);
}

function calculateExpectedRank(
	enlistmentDate: Date,
	now: Date,
): MilitaryRank {
	const enlistment =
		startOfUtcDay(enlistmentDate);
	const current = startOfUtcDay(now);

	let rank: MilitaryRank = "PRIVATE";

	for (const schedule of RANK_SCHEDULE) {
		const promotionDate =
			addUtcMonths(
				enlistment,
				schedule.monthsFromEnlistment,
			);

		if (current >= promotionDate) {
			rank = schedule.rank;
		}
	}

	return rank;
}

function getNextPromotion(
	enlistmentDate: Date,
	now: Date,
): {
	rank: MilitaryRank | null;
	date: Date | null;
} {
	const enlistment =
		startOfUtcDay(enlistmentDate);
	const current = startOfUtcDay(now);

	for (const schedule of RANK_SCHEDULE) {
		if (schedule.monthsFromEnlistment === 0) {
			continue;
		}

		const promotionDate =
			addUtcMonths(
				enlistment,
				schedule.monthsFromEnlistment,
			);

		if (promotionDate > current) {
			return {
				rank: schedule.rank,
				date: promotionDate,
			};
		}
	}

	return {
		rank: null,
		date: null,
	};
}

function calculateServiceProgress(
	enlistmentDate: Date,
	dischargeDate: Date,
	now: Date,
): number {
	const enlistment =
		startOfUtcDay(enlistmentDate);
	const discharge =
		startOfUtcDay(dischargeDate);
	const current =
		startOfUtcDay(now);

	const total =
		discharge.getTime() -
		enlistment.getTime();

	if (total <= 0) {
		return 0;
	}

	const elapsed =
		current.getTime() -
		enlistment.getTime();

	const progress =
		(elapsed / total) * 100;

	return Math.min(
		100,
		Math.max(0, progress),
	);
}

export function serializeMilitaryProfile(
	profile: IMilitaryProfile | any,
	now = new Date(),
) {
	const enlistmentDate =
		new Date(profile.enlistmentDate);
	const dischargeDate =
		new Date(profile.dischargeDate);

	const calculatedRank =
		calculateExpectedRank(
			enlistmentDate,
			now,
		);

	const displayRank =
		profile.rankMode === "MANUAL"
			? profile.selectedRank
			: calculatedRank;

	const nextPromotion =
		getNextPromotion(
			enlistmentDate,
			now,
		);

	const daysUntilDischarge =
		Math.max(
			0,
			differenceInDays(
				now,
				dischargeDate,
			),
		);

	const isDischarged =
		startOfUtcDay(now) >=
		startOfUtcDay(dischargeDate);

	const serviceProgress =
		Math.round(
			calculateServiceProgress(
				enlistmentDate,
				dischargeDate,
				now,
			) * 10,
		) / 10;

	return {
		id: String(profile._id),
		userId: String(profile.userId),

		branch: profile.branch,

		unitType:
			profile.unitType ??
			(profile.divisionCode || profile.divisionName
				? "DIVISION"
				: null),
		unitCode:
			profile.unitCode ??
			profile.divisionCode ??
			null,
		unitName:
			profile.unitName ??
			profile.divisionName ??
			null,

		enlistmentDate:
			toDateOnly(enlistmentDate),
		dischargeDate:
			toDateOnly(dischargeDate),

		selectedRank:
			profile.selectedRank,
		rankMode:
			profile.rankMode,

		calculatedRank,
		displayRank,

		nextPromotionRank:
			isDischarged
				? null
				: nextPromotion.rank,
		nextPromotionDate:
			isDischarged ||
			!nextPromotion.date
				? null
				: toDateOnly(
						nextPromotion.date,
					),

		daysUntilDischarge,
		serviceProgress,
		isDischarged,

		createdAt:
			profile.createdAt,
		updatedAt:
			profile.updatedAt,
	};
}
