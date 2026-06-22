export type UsExchangeCode =
	| "NAS"
	| "NYS"
	| "AMS";

export type UsMarketName =
	| "NASDAQ"
	| "NYSE"
	| "AMEX";

export type UsAssetType =
	| "STOCK"
	| "ETF";

export type UsMarketPhase =
	| "PRE_OPEN"
	| "OPEN"
	| "CLOSED"
	| "WEEKEND"
	| "HOLIDAY";

export interface UsMarketStatus {
	market: "US";
	marketName: string;
	timezone:
		"America/New_York";

	localDate: string;
	localTime: string;
	weekday: string;

	sessionType: "REGULAR";
	openTime: string;
	closeTime: string;

	phase: UsMarketPhase;
	isOpen: boolean;

	message: string;
	nextOpenLocal: string | null;

	holidayName: string | null;
	earlyCloseName: string | null;

	orderAllowedByOverride: boolean;
}

export interface UsSearchResult {
	symbol: string;
	name: string;
	shortname: string;
	longname: string;

	exchange:
		UsExchangeCode;
	exchDisp:
		UsMarketName;
	market:
		UsMarketName;

	currency: "USD";
	assetType: UsAssetType;
	category?: string | null;
	summary?: string | null;
	benchmark?: string | null;
	issuer?: string | null;
	tradable: boolean;
}

export interface UsStockQuote {
	symbol: string;
	name: string;
	shortName: string;
	longName: string;

	exchange:
		UsExchangeCode;
	market:
		UsMarketName;
	currency: "USD";
	assetType: UsAssetType;
	category?: string | null;
	summary?: string | null;
	benchmark?: string | null;
	issuer?: string | null;
	tradable?: boolean;

	price: number;
	changePrice: number;
	changeRate: number;
	previousClose: number;

	open: number;
	high: number;
	low: number;
	volume: number;
	tradingValue?: number;

	marketCap?: number;
	per?: number;
	pbr?: number;
	eps?: number;
	bps?: number;
	sharesOutstanding?: number;

	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekHighDate?: string | null;
	fiftyTwoWeekLow?: number;
	fiftyTwoWeekLowDate?: string | null;

	sectorCode?: string | null;
	etpTypeName?: string | null;

	fetchedAt: string;
}

export interface UsChartPoint {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface UsTradingAccount {
	userId: string;

	cash: number;
	reservedCash: number;
	availableCash: number;
	initialCash: number;

	currency: "USD";

	totalAsset?: number;
	totalEvaluationAmount?: number;
	totalBuyAmount?: number;
	totalProfitLoss?: number;
	totalProfitLossRate?: number;
}

export interface UsHolding {
	id: string;

	symbol: string;
	name: string;

	exchange:
		UsExchangeCode;
	market:
		UsMarketName;
	currency: "USD";

	quantity: number;
	reservedQuantity: number;
	availableQuantity: number;

	avgPrice: number;
	currentPrice: number;
	changeRate: number;

	evaluationAmount: number;
	buyAmount: number;
	profitLoss: number;
	profitLossRate: number;
}

export interface UsPortfolio {
	account:
		UsTradingAccount;
	holdings:
		UsHolding[];
}

export type UsOrderSide =
	| "BUY"
	| "SELL";

export type UsOrderType =
	| "MARKET"
	| "LIMIT";

export type UsOrderStatus =
	| "PENDING"
	| "FILLED"
	| "CANCELED"
	| "REJECTED";

export interface UsTradeOrder {
	_id: string;
	userId: string;

	symbol: string;
	name: string;

	exchange:
		UsExchangeCode;
	market:
		UsMarketName;
	currency: "USD";

	side: UsOrderSide;
	orderType: UsOrderType;
	status: UsOrderStatus;

	quantity: number;
	filledQuantity: number;

	orderPrice: number;
	limitPrice?: number | null;
	executedPrice?: number | null;

	reservedAmount: number;
	reservedQuantity: number;

	realizedProfit: number;
	rejectReason?: string;

	createdAt: string;
	executedAt?: string | null;
	canceledAt?: string | null;
}
