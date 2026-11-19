import type { SalaryPlannerSnapshot } from "../types/salaryPlanner.types";
const money = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e12;
export function validSalarySnapshot(s: any): s is SalaryPlannerSnapshot {
 if (!s || !["이병", "일병", "상병", "병장"].includes(s.rank) || !s.goal || !s.actualRatios) return false;
 if (!["salary", "militarySavings", "existingMilitarySavingsPrincipal", "fixedExpenses", "variableExpenses",
  "totalExpenses", "overspendAmount"].every(k => money(s[k]))) return false;
 if (typeof s.remainingAmount !== "number" || !Number.isFinite(s.remainingAmount) || Math.abs(s.remainingAmount) > 1e12) return false;
 if (!Number.isInteger(s.goal.monthsLeft) || s.goal.monthsLeft < 0 || s.goal.monthsLeft > 120) return false;
 if (!["targetAmount", "goalGap", "monthlyGoalNeeded", "projectedAvailableAtDischarge"].every(k => money(s.goal[k]))) return false;
 if (!["savings", "expenses", "remaining"].every(k => typeof s.actualRatios[k] === "number" && Number.isFinite(s.actualRatios[k]) && Math.abs(s.actualRatios[k]) <= 1e12)) return false;
 if (s.promotionSpendingRate !== undefined && (!money(s.promotionSpendingRate) || s.promotionSpendingRate > 1)) return false;
 return [s.fixedItems, s.variableItems].every(items => Array.isArray(items) && items.length <= 100 &&
  items.every((item: any) => item && money(item.amount) && typeof item.label === "string" && item.label.length <= 200));
}
