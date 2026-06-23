export type SoldierRank =
	| "이병"
	| "일병"
	| "상병"
	| "병장";

export type MilitaryRank =
	| "PRIVATE"
	| "PRIVATE_FIRST_CLASS"
	| "CORPORAL"
	| "SERGEANT";

export type ExpenseKind =
	| "FIXED"
	| "VARIABLE";

export type SpendingRiskLevel =
	| "LOW"
	| "MEDIUM"
	| "HIGH";

export type GoalFeasibilityStatus =
	| "INPUT_REQUIRED"
	| "POSSIBLE"
	| "IMPOSSIBLE";

export type SalaryActionType =
	| "REDUCE_EXPENSE"
	| "GOAL_SAVING"
	| "EMERGENCY"
	| "INVESTMENT_PRACTICE"
	| "KEEP";

export interface ExpenseItem {
	id: string;
	label: string;
	amount: number;
	kind: ExpenseKind;
}

export interface GoalCostItem {
	id: string;
	label: string;
	amount: number;
}

export interface SalaryGoal {
	name: string;
	description: string;
	costItems: GoalCostItem[];
	targetAmount: number;
	currentSaved: number;
	dischargeDate: string;
	monthsLeft: number;

	existingContributions: number;
	futureContributions: number;
	projectedContributions: number;
	projectedMatchingSupport: number;
	projectedMilitarySavings: number;
	projectedAvailableAtDischarge: number;

	goalGap: number;
	monthlyGoalNeeded: number;
}

export interface SalaryRatios {
	savings: number;
	expenses: number;
	remaining: number;
}

export interface SalaryPlannerSnapshot {
	standardYear: 2026;

	rank: SoldierRank;
	salary: number;

	/*
	 * 진급 및 계급별 급여 예측에 사용합니다.
	 */
	enlistmentDate: string;

	/*
	 * 진급으로 늘어나는 급여 중 소비 증가에 사용할 비율입니다.
	 * 0.5는 급여 상승분의 50%만 소비 증가로 반영한다는 뜻입니다.
	 */
	promotionSpendingRate: number;

	/*
	 * 앞으로 매월 납입할 장병내일준비적금 금액
	 */
	militarySavings: number;

	/*
	 * 현재까지 실제로 납입한 누적 원금
	 */
	existingMilitarySavingsPrincipal: number;

	fixedExpenses: number;
	variableExpenses: number;
	totalExpenses: number;

	remainingAmount: number;
	overspendAmount: number;

	fixedItems: ExpenseItem[];
	variableItems: ExpenseItem[];

	topExpense: {
		label: string;
		amount: number;
	};

	actualRatios: SalaryRatios;
	goal: SalaryGoal;
}

export interface SalaryAiDiagnosis {
	patternType: string;
	riskLevel: SpendingRiskLevel;
	summary: string;
	evidence: string[];
}

export interface SalaryGoalAssessment {
	status: GoalFeasibilityStatus;
	label: string;
	summary: string;
	monthlyRequired: number;
	monthlyShortage: number;
}

export interface SalaryAiAllocation {
	emergency: number;
	goal: number;
	investmentPractice: number;
	flexible: number;
}

export interface SalaryMonthlyAction {
	type: SalaryActionType;
	title: string;
	currentAmount: number;
	targetAmount: number;
	monthlyEffect: number;
	reason: string;
}

export interface SalaryMonthlyPlan {
	headline: string;
	summary: string;
	items: SalaryMonthlyAction[];
	expectedMonthlyImprovement: number;
}

export interface RankProjectionSegment {
	rank: SoldierRank;
	months: number;
	monthlySalary: number;
	estimatedMonthlyExpenses: number;
	estimatedMonthlyRemaining: number;
}

export interface SalaryServiceProjection {
	confirmedAssetsAtDischarge: number;
	baselineAssetsAtDischarge: number;
	actionPlanAssetsAtDischarge: number;
	additionalSecured: number;

	baselineGoalBalance: number;
	actionPlanGoalBalance: number;

	promotionSpendingRate: number;
	projectedSalaryIncome: number;
	projectedExpenses: number;
	projectedCashFlow: number;

	rankSegments: RankProjectionSegment[];
}

export interface SalaryAiResult {
	diagnosis: SalaryAiDiagnosis;
	goalAssessment: SalaryGoalAssessment;

	/*
	 * 비율은 보조 정보이며, 사용자에게는 월 행동 플랜을 우선 표시합니다.
	 */
	recommendedRatios: SalaryRatios;
	allocation: SalaryAiAllocation;

	monthlyPlan: SalaryMonthlyPlan;
	projection: SalaryServiceProjection;

	allocationReason: string;
	actions: string[];

	source: "LLM";
}

export interface SavedSalaryPlan {
	snapshot: SalaryPlannerSnapshot;
	result: SalaryAiResult;
	generatedAt: string;
	analysisDurationMs?: number;
}

export interface MilitaryProfileApiData {
	selectedRank?: MilitaryRank;
	calculatedRank?: MilitaryRank;
	displayRank?: MilitaryRank;
	rankMode?: "AUTO" | "MANUAL";

	enlistmentDate?: string;
	dischargeDate?: string;
}
