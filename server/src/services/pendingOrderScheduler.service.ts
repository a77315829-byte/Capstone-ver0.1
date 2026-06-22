import {
	checkAllPendingOrders,
} from "./trading.service";

type SchedulerGlobal =
	typeof globalThis & {
		__krxPendingOrderSchedulerStarted?:
			boolean;
	};

const schedulerGlobal =
	globalThis as SchedulerGlobal;

const DEFAULT_INTERVAL_MS =
	30_000;

function getIntervalMs(): number {
	const configured =
		Number(
			process.env
				.PENDING_ORDER_CHECK_INTERVAL_MS,
		);

	if (
		Number.isFinite(configured) &&
		configured >= 5_000
	) {
		return configured;
	}

	return DEFAULT_INTERVAL_MS;
}

let isSweepRunning = false;

export async function runPendingOrderSweep() {
	if (isSweepRunning) {
		return;
	}

	isSweepRunning = true;

	try {
		const result =
			await checkAllPendingOrders();

		if (
			result.marketOpen &&
			result.checkedCount > 0
		) {
			console.log(
				"[pending-order-scheduler]",
				`users=${result.userCount}`,
				`checked=${result.checkedCount}`,
				`filled=${result.filledCount}`,
			);
		}
	} catch (error) {
		console.error(
			"[pending-order-scheduler] failed:",
			error,
		);
	} finally {
		isSweepRunning = false;
	}
}

export function startPendingOrderScheduler() {
	if (
		schedulerGlobal
			.__krxPendingOrderSchedulerStarted
	) {
		return;
	}

	schedulerGlobal
		.__krxPendingOrderSchedulerStarted =
		true;

	const intervalMs =
		getIntervalMs();

	console.log(
		"[pending-order-scheduler] started:",
		`${intervalMs}ms`,
	);

	void runPendingOrderSweep();

	setInterval(
		() => {
			void runPendingOrderSweep();
		},
		intervalMs,
	);
}
