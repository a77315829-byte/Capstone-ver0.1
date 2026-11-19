import { checkAllPendingOrders } from "./trading.service";
import { createOrderScheduler } from "./orderScheduler";

const scheduler = createOrderScheduler("pending-order-scheduler", "PENDING_ORDER_CHECK_INTERVAL_MS", checkAllPendingOrders);
export const startPendingOrderScheduler = scheduler.start;
export const stopPendingOrderScheduler = scheduler.stop;
export const runPendingOrderSweep = scheduler.run;
export const pendingOrderSchedulerStatus = scheduler.status;
