import {
	checkAllUsPendingOrders,
} from "./usTrading.service";

type SchedulerGlobal =
	typeof globalThis & {
		__usPendingOrderSchedulerStarted?:
			boolean;
	};

const schedulerGlobal =
	globalThis as SchedulerGlobal;

const DEFAULT_INTERVAL_MS =
	30_000;

function getIntervalMs():
	number {
	const configured =
		Number(
			process.env
				.US_PENDING_ORDER_CHECK_INTERVAL_MS,
		);

	if (
		Number.isFinite(configured) &&
		configured >= 5_000
	) {
		return configured;
	}

	return DEFAULT_INTERVAL_MS;
}

let isRunning = false;

export async function runUsPendingOrderSweep() {
	if (isRunning) {
		return;
	}

	isRunning = true;

	try {
		const result =
			await checkAllUsPendingOrders();

		if (
			result.marketOpen &&
			result.checkedCount > 0
		) {
			console.log(
				"[us-pending-order-scheduler]",
				`users=${result.userCount}`,
				`checked=${result.checkedCount}`,
				`filled=${result.filledCount}`,
			);
		}
	} catch (error) {
		console.error(
			"[us-pending-order-scheduler] failed:",
			error,
		);
	} finally {
		isRunning = false;
	}
}

export function startUsPendingOrderScheduler() {
	if (
		schedulerGlobal
			.__usPendingOrderSchedulerStarted
	) {
		return;
	}

	schedulerGlobal
		.__usPendingOrderSchedulerStarted =
		true;

	const intervalMs =
		getIntervalMs();

	console.log(
		"[us-pending-order-scheduler] started:",
		`${intervalMs}ms`,
	);

	void runUsPendingOrderSweep();

	setInterval(
		() => {
			void runUsPendingOrderSweep();
		},
		intervalMs,
	);
}
