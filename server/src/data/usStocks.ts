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

export interface UsStockCatalogItem {
	symbol: string;
	name: string;
	nameKo: string;
	exchange: UsExchangeCode;
	market: UsMarketName;
	keywords: string[];

	assetType?: UsAssetType;
	category?: string;
	summary?: string;
	benchmark?: string;
	issuer?: string;
}

export const US_EXCHANGE_NAME:
	Record<UsExchangeCode, UsMarketName> = {
	NAS: "NASDAQ",
	NYS: "NYSE",
	AMS: "AMEX",
};

export const US_PRODUCT_TYPE_CODE:
	Record<UsExchangeCode, string> = {
	NAS: "512",
	NYS: "513",
	AMS: "529",
};

/*
 * MVP용 대표 종목 검색 목록입니다.
 * 전체 미국 종목 마스터를 매번 내려받지 않고,
 * 사용 빈도가 높은 종목과 교육용 주목 종목을 빠르게 검색합니다.
 *
 * 목록에 없는 티커도 영문 티커를 정확히 입력하면
 * KIS 종목정보 API로 NASDAQ → NYSE → AMEX 순서로 확인합니다.
 */
export const US_STOCK_CATALOG:
	UsStockCatalogItem[] = [

	{
		symbol: "SPY",
		name: "SPDR S&P 500 ETF Trust",
		nameKo: "SPDR S&P 500 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"S&P 500",
			"SP500",
			"미국 대표지수",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 대형주 지수 ETF",
		benchmark: "S&P 500 Index",
		issuer: "State Street Global Advisors",
		summary:
			"미국 대형주 시장을 대표하는 S&P 500 지수의 흐름을 추종하도록 설계된 ETF입니다.",
	},
	{
		symbol: "VOO",
		name: "Vanguard S&P 500 ETF",
		nameKo: "뱅가드 S&P 500 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"S&P 500",
			"SP500",
			"VANGUARD",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 대형주 지수 ETF",
		benchmark: "S&P 500 Index",
		issuer: "Vanguard",
		summary:
			"미국 대형주로 구성된 S&P 500 지수의 성과를 추종하는 장기 투자형 ETF입니다.",
	},
	{
		symbol: "IVV",
		name: "iShares Core S&P 500 ETF",
		nameKo: "아이셰어즈 코어 S&P 500 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"S&P 500",
			"SP500",
			"ISHARES",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 대형주 지수 ETF",
		benchmark: "S&P 500 Index",
		issuer: "BlackRock",
		summary:
			"미국 대형주에 폭넓게 투자하도록 S&P 500 지수를 추종하는 ETF입니다.",
	},
	{
		symbol: "QQQ",
		name: "Invesco QQQ Trust",
		nameKo: "인베스코 QQQ",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: [
			"NASDAQ 100",
			"나스닥100",
			"기술주",
			"ETF",
		],
		assetType: "ETF",
		category: "나스닥 대형 성장주 ETF",
		benchmark: "Nasdaq-100 Index",
		issuer: "Invesco",
		summary:
			"나스닥에 상장된 대형 비금융 기업 중심의 Nasdaq-100 지수를 추종하는 ETF입니다.",
	},
	{
		symbol: "DIA",
		name: "SPDR Dow Jones Industrial Average ETF Trust",
		nameKo: "SPDR 다우존스 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"DOW",
			"다우존스",
			"미국 우량주",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 우량주 지수 ETF",
		benchmark: "Dow Jones Industrial Average",
		issuer: "State Street Global Advisors",
		summary:
			"미국 대표 우량주 30개로 구성된 다우존스 산업평균지수를 추종하는 ETF입니다.",
	},
	{
		symbol: "IWM",
		name: "iShares Russell 2000 ETF",
		nameKo: "아이셰어즈 러셀 2000 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"RUSSELL 2000",
			"러셀2000",
			"미국 중소형주",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 중소형주 지수 ETF",
		benchmark: "Russell 2000 Index",
		issuer: "BlackRock",
		summary:
			"미국 중소형주 시장을 대표하는 Russell 2000 지수를 추종하는 ETF입니다.",
	},
	{
		symbol: "VTI",
		name: "Vanguard Total Stock Market ETF",
		nameKo: "뱅가드 미국 전체시장 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"TOTAL MARKET",
			"미국 전체시장",
			"VANGUARD",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 전체시장 ETF",
		benchmark: "CRSP US Total Market Index",
		issuer: "Vanguard",
		summary:
			"미국 대형주부터 중소형주까지 주식시장 전반에 분산 투자하는 ETF입니다.",
	},
	{
		symbol: "SCHD",
		name: "Schwab U.S. Dividend Equity ETF",
		nameKo: "슈왑 미국 배당주 ETF",
		exchange: "AMS",
		market: "AMEX",
		keywords: [
			"DIVIDEND",
			"배당",
			"SCHWAB",
			"ETF",
		],
		assetType: "ETF",
		category: "미국 배당주 ETF",
		benchmark: "Dow Jones U.S. Dividend 100 Index",
		issuer: "Charles Schwab",
		summary:
			"배당의 지속성과 재무 건전성을 고려한 미국 배당주 지수를 추종하는 ETF입니다.",
	},
	{
		symbol: "RKLB",
		name: "Rocket Lab USA, Inc.",
		nameKo: "로켓랩",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["ROCKET LAB", "우주", "로켓"],
	},
	{
		symbol: "AAPL",
		name: "Apple Inc.",
		nameKo: "애플",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["APPLE", "아이폰"],
	},
	{
		symbol: "MSFT",
		name: "Microsoft Corporation",
		nameKo: "마이크로소프트",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["MICROSOFT", "윈도우", "클라우드"],
	},
	{
		symbol: "NVDA",
		name: "NVIDIA Corporation",
		nameKo: "엔비디아",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["NVIDIA", "GPU", "AI", "반도체"],
		assetType: "STOCK",
		category: "반도체·AI 인프라",
		summary:
			"GPU와 AI 가속기, 데이터센터 플랫폼을 중심으로 성장한 글로벌 반도체 기업입니다.",
	},
	{
		symbol: "TSLA",
		name: "Tesla, Inc.",
		nameKo: "테슬라",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["TESLA", "전기차"],
	},
	{
		symbol: "AMZN",
		name: "Amazon.com, Inc.",
		nameKo: "아마존",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["AMAZON", "AWS", "이커머스"],
	},
	{
		symbol: "GOOGL",
		name: "Alphabet Inc. Class A",
		nameKo: "알파벳 A",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["GOOGLE", "구글", "ALPHABET"],
	},
	{
		symbol: "META",
		name: "Meta Platforms, Inc.",
		nameKo: "메타",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["FACEBOOK", "인스타그램", "META"],
	},
	{
		symbol: "NFLX",
		name: "Netflix, Inc.",
		nameKo: "넷플릭스",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["NETFLIX", "스트리밍"],
	},
	{
		symbol: "AMD",
		name: "Advanced Micro Devices, Inc.",
		nameKo: "AMD",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["ADVANCED MICRO DEVICES", "CPU", "GPU", "반도체"],
	},
	{
		symbol: "INTC",
		name: "Intel Corporation",
		nameKo: "인텔",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["INTEL", "CPU", "반도체"],
	},
	{
		symbol: "AVGO",
		name: "Broadcom Inc.",
		nameKo: "브로드컴",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["BROADCOM", "반도체"],
	},
	{
		symbol: "QCOM",
		name: "QUALCOMM Incorporated",
		nameKo: "퀄컴",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["QUALCOMM", "모바일", "반도체"],
	},
	{
		symbol: "PLTR",
		name: "Palantir Technologies Inc.",
		nameKo: "팔란티어",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["PALANTIR", "AI", "데이터"],
	},
	{
		symbol: "COIN",
		name: "Coinbase Global, Inc.",
		nameKo: "코인베이스",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["COINBASE", "암호화폐"],
	},
	{
		symbol: "ADBE",
		name: "Adobe Inc.",
		nameKo: "어도비",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["ADOBE", "포토샵"],
	},
	{
		symbol: "COST",
		name: "Costco Wholesale Corporation",
		nameKo: "코스트코",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["COSTCO", "유통"],
	},
	{
		symbol: "PEP",
		name: "PepsiCo, Inc.",
		nameKo: "펩시코",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["PEPSI", "음료"],
	},
	{
		symbol: "SBUX",
		name: "Starbucks Corporation",
		nameKo: "스타벅스",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["STARBUCKS", "커피"],
	},
	{
		symbol: "MU",
		name: "Micron Technology, Inc.",
		nameKo: "마이크론",
		exchange: "NAS",
		market: "NASDAQ",
		keywords: ["MICRON", "메모리", "반도체"],
	},
	{
		symbol: "KO",
		name: "The Coca-Cola Company",
		nameKo: "코카콜라",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["COCA COLA", "콜라", "음료"],
	},
	{
		symbol: "DIS",
		name: "The Walt Disney Company",
		nameKo: "월트디즈니",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["DISNEY", "디즈니", "미디어"],
	},
	{
		symbol: "JPM",
		name: "JPMorgan Chase & Co.",
		nameKo: "JP모건",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["JPMORGAN", "은행", "금융"],
	},
	{
		symbol: "V",
		name: "Visa Inc.",
		nameKo: "비자",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["VISA", "결제"],
	},
	{
		symbol: "MA",
		name: "Mastercard Incorporated",
		nameKo: "마스터카드",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["MASTERCARD", "결제"],
	},
	{
		symbol: "NKE",
		name: "NIKE, Inc.",
		nameKo: "나이키",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["NIKE", "스포츠"],
	},
	{
		symbol: "BA",
		name: "The Boeing Company",
		nameKo: "보잉",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["BOEING", "항공"],
	},
	{
		symbol: "IBM",
		name: "International Business Machines Corporation",
		nameKo: "IBM",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["IBM", "클라우드"],
	},
	{
		symbol: "UBER",
		name: "Uber Technologies, Inc.",
		nameKo: "우버",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["UBER", "모빌리티"],
	},
	{
		symbol: "WMT",
		name: "Walmart Inc.",
		nameKo: "월마트",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["WALMART", "유통"],
	},
	{
		symbol: "MCD",
		name: "McDonald's Corporation",
		nameKo: "맥도날드",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["MCDONALDS", "패스트푸드"],
	},
	{
		symbol: "XOM",
		name: "Exxon Mobil Corporation",
		nameKo: "엑슨모빌",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["EXXON", "에너지", "석유"],
	},
	{
		symbol: "LLY",
		name: "Eli Lilly and Company",
		nameKo: "일라이릴리",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["ELI LILLY", "제약", "바이오"],
	},
	{
		symbol: "ORCL",
		name: "Oracle Corporation",
		nameKo: "오라클",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["ORACLE", "데이터베이스", "클라우드"],
	},
	{
		symbol: "CRM",
		name: "Salesforce, Inc.",
		nameKo: "세일즈포스",
		exchange: "NYS",
		market: "NYSE",
		keywords: ["SALESFORCE", "CRM", "클라우드"],
	},
];
