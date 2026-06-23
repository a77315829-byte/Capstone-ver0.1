import {
	Document,
	Schema,
	model,
} from "mongoose";

import type {
	SalaryAiResult,
	SalaryPlannerSnapshot,
} from "../types/salaryPlanner.types";

export interface ISalaryAiPlan
	extends Document {
	userId: Schema.Types.ObjectId;
	snapshot:
		SalaryPlannerSnapshot;
	result:
		SalaryAiResult;
	generatedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const salaryAiPlanSchema =
	new Schema<ISalaryAiPlan>(
		{
			userId: {
				type:
					Schema.Types
						.ObjectId,
				ref: "User",
				required: true,
				unique: true,
				index: true,
			},

			snapshot: {
				type:
					Schema.Types
						.Mixed,
				required: true,
			},

			result: {
				type:
					Schema.Types
						.Mixed,
				required: true,
			},

			generatedAt: {
				type: Date,
				required: true,
				default:
					Date.now,
			},
		},
		{
			timestamps: true,
		},
	);

const SalaryAiPlan =
	model<ISalaryAiPlan>(
		"SalaryAiPlan",
		salaryAiPlanSchema,
	);

export default SalaryAiPlan;
