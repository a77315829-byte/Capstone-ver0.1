import { checkAllUsPendingOrders } from "./usTrading.service";
import { createOrderScheduler } from "./orderScheduler";

const scheduler = createOrderScheduler("us-pending-order-scheduler", "US_PENDING_ORDER_CHECK_INTERVAL_MS", checkAllUsPendingOrders);
export const startUsPendingOrderScheduler = scheduler.start;
export const stopUsPendingOrderScheduler = scheduler.stop;
export const runUsPendingOrderSweep = scheduler.run;
export const usPendingOrderSchedulerStatus = scheduler.status;
