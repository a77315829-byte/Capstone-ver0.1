// Bound structured output so small local models finish with complete JSON.
const text = (maxLength = 60) => ({ type: "string", minLength: 1, maxLength });
const amount = { type: "integer", minimum: 0 };
const list = (items: object, count = 2) => ({ type: "array", items, minItems: count, maxItems: count });
const object = (properties: Record<string, object>) => ({
 type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

export const salaryPlanSchema = object({
 diagnosis: object({ patternType: text(20), riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, summary: text(100), evidence: list(text()) }),
 monthlyPlan: object({ headline: text(35), summary: text(60), items: list(object({
  type: { type: "string", enum: ["REDUCE_EXPENSE", "GOAL_SAVING", "EMERGENCY", "INVESTMENT_PRACTICE", "KEEP"] },
  title: text(25), currentAmount: amount, targetAmount: amount, monthlyEffect: amount, reason: text(50),
 })) }),
 recommendedRatios: object({ savings: amount, expenses: amount, remaining: amount }),
 allocation: object({ emergency: amount, goal: amount, investmentPractice: amount, flexible: amount }),
 allocationReason: text(80), actions: list(text(45)),
});

export const assetAdviceSchema = object({
 summary: text(100), spendingDiagnosis: list(text(60)),
 allocationPercentages: object({ emergencyFund: amount, additionalSavings: amount, learningInvestment: { type: "integer", minimum: 0, maximum: 30 } }),
 monthlyActions: list(text(60), 3), riskWarning: text(80),
});
