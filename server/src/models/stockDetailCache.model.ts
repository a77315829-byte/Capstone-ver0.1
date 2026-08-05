import mongoose, {
	Schema,
	Document,
} from "mongoose";

export interface FinancialPeriodSummary {
	period: string;
	revenue?: number | null;
	operatingProfit?: number | null;
	netIncome?: number | null;
	operatingMargin?: number | null;
	roe?: number | null;
}

export interface StockDetailCacheDocument
	extends Document {
	symbol: string;
	name: string;
	market: string;
	assetType: string;
	tradable: boolean;

	price: number;
	changePrice: number;
	changeRate: number;
	open: number;
	high: number;
	low: number;
	volume: number;

	marketCap?: number | null;
	per?: number | null;
	pbr?: number | null;
	eps?: number | null;
	bps?: number | null;
	roe?: number | null;
	revenue?: number | null;
	operatingProfit?: number | null;
	netIncome?: number | null;

	listedShares?: number | null;
	foreignOwnershipRate?:
		number | null;
	faceValue?: number | null;

	corpCode?: string | null;
	homepageUrl?: string | null;
	irUrl?: string | null;
	companyNameEng?: string | null;
	ceoName?: string | null;
	address?: string | null;
	industryCode?: string | null;
	establishedDate?: string | null;
	fiscalMonth?: string | null;

	annualFinancials:
		FinancialPeriodSummary[];
	quarterlyFinancials:
		FinancialPeriodSummary[];

	dartConfigured: boolean;
	dataVersion: number;

	summary: string;
	source: string;
	fetchedAt: Date;
	dartFetchedAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const FinancialPeriodSchema =
	new Schema<FinancialPeriodSummary>(
		{
			period: {
				type: String,
				required: true,
			},
			revenue: {
				type: Number,
				default: null,
			},
			operatingProfit: {
				type: Number,
				default: null,
			},
			netIncome: {
				type: Number,
				default: null,
			},
			operatingMargin: {
				type: Number,
				default: null,
			},
			roe: {
				type: Number,
				default: null,
			},
		},
		{
			_id: false,
		},
	);

const StockDetailCacheSchema =
	new Schema<StockDetailCacheDocument>(
		{
			symbol: {
				type: String,
				required: true,
				unique: true,
				index: true,
			},
			name: {
				type: String,
				required: true,
			},
			market: {
				type: String,
				default: "KRX",
			},
			assetType: {
				type: String,
				default: "STOCK",
			},
			tradable: {
				type: Boolean,
				default: true,
			},

			price: {
				type: Number,
				default: 0,
			},
			changePrice: {
				type: Number,
				default: 0,
			},
			changeRate: {
				type: Number,
				default: 0,
			},
			open: {
				type: Number,
				default: 0,
			},
			high: {
				type: Number,
				default: 0,
			},
			low: {
				type: Number,
				default: 0,
			},
			volume: {
				type: Number,
				default: 0,
			},

			marketCap: {
				type: Number,
				default: null,
			},
			per: {
				type: Number,
				default: null,
			},
			pbr: {
				type: Number,
				default: null,
			},
			eps: {
				type: Number,
				default: null,
			},
			bps: {
				type: Number,
				default: null,
			},
			roe: {
				type: Number,
				default: null,
			},
			revenue: {
				type: Number,
				default: null,
			},
			operatingProfit: {
				type: Number,
				default: null,
			},
			netIncome: {
				type: Number,
				default: null,
			},

			listedShares: {
				type: Number,
				default: null,
			},
			foreignOwnershipRate: {
				type: Number,
				default: null,
			},
			faceValue: {
				type: Number,
				default: null,
			},

			corpCode: {
				type: String,
				default: null,
			},
			homepageUrl: {
				type: String,
				default: null,
			},
			irUrl: {
				type: String,
				default: null,
			},
			companyNameEng: {
				type: String,
				default: null,
			},
			ceoName: {
				type: String,
				default: null,
			},
			address: {
				type: String,
				default: null,
			},
			industryCode: {
				type: String,
				default: null,
			},
			establishedDate: {
				type: String,
				default: null,
			},
			fiscalMonth: {
				type: String,
				default: null,
			},

			annualFinancials: {
				type: [
					FinancialPeriodSchema,
				],
				default: [],
			},
			quarterlyFinancials: {
				type: [
					FinancialPeriodSchema,
				],
				default: [],
			},

			dartConfigured: {
				type: Boolean,
				default: false,
			},
			dataVersion: {
				type: Number,
				default: 2,
			},

			summary: {
				type: String,
				default: "",
			},
			source: {
				type: String,
				default: "KIS",
			},
			fetchedAt: {
				type: Date,
				required: true,
				index: true,
			},
			dartFetchedAt: {
				type: Date,
				default: null,
			},
		},
		{
			timestamps: true,
		},
	);

export default mongoose.model<
	StockDetailCacheDocument
>(
	"StockDetailCache",
	StockDetailCacheSchema,
);
