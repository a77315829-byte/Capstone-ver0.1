import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

export interface UsTradingAccountDocument
	extends Document {
	userId: string;

	cash: number;
	reservedCash: number;
	initialCash: number;

	currency: "USD";

	createdAt: Date;
	updatedAt: Date;
}

const UsTradingAccountSchema =
	new Schema<UsTradingAccountDocument>(
		{
			userId: {
				type: String,
				required: true,
				unique: true,
				index: true,
			},
			cash: {
				type: Number,
				required: true,
				default: 10_000,
			},
			reservedCash: {
				type: Number,
				required: true,
				default: 0,
			},
			initialCash: {
				type: Number,
				required: true,
				default: 10_000,
			},
			currency: {
				type: String,
				enum: ["USD"],
				default: "USD",
				required: true,
			},
		},
		{
			timestamps: true,
		},
	);

const UsTradingAccount =
	(mongoose.models
		.UsTradingAccount as Model<UsTradingAccountDocument>) ||
	mongoose.model<UsTradingAccountDocument>(
		"UsTradingAccount",
		UsTradingAccountSchema,
	);

export default UsTradingAccount;
