import StockDetailCache from "../models/stockDetailCache.model";

import {
	fetchStockData,
	fetchStockFinancialData,
	normalizeStockSymbol,
} from "../utils/requests";

import {
	fetchDartStockDetail,
	isDartConfigured,
	FinancialPeriodSummary,
} from "./dartStockDetail.service";

const DETAIL_TTL_MS =
	6 * 60 * 60 * 1000;

const DATA_VERSION = 2;

const isFresh = (
	fetchedAt: Date,
	ttlMs: number,
): boolean =>
	Date.now() -
		fetchedAt.getTime() <
	ttlMs;

const toNumberOrNull = (
	value: any,
): number | null => {
	if (
		value === undefined ||
		value === null ||
		value === ""
	) {
		return null;
	}

	const parsed =
		Number(
			String(value).replace(
				/,/g,
				"",
			),
		);

	return Number.isFinite(parsed)
		? parsed
		: null;
};

const buildSummary = (
	detail: {
		name: string;
		market: string;
		assetType: string;
		changeRate: number;
		volume: number;
	},
) => {
	const direction =
		detail.changeRate > 0
			? "상승"
			: detail.changeRate < 0
				? "하락"
				: "보합";

	return `${detail.name}은(는) ${detail.market} 시장의 ${detail.assetType} 종목입니다. 현재 등락률 기준으로 ${direction} 흐름을 보이고 있으며, 거래량은 ${detail.volume.toLocaleString(
		"ko-KR",
	)}주입니다.`;
};

const mergeLatestRoe = (
	periods:
		FinancialPeriodSummary[],
	roe: number | null,
): FinancialPeriodSummary[] => {
	if (
		periods.length === 0 ||
		roe === null
	) {
		return periods;
	}

	return periods.map(
		(period, index) =>
			index === 0 &&
			period.roe === null
				? {
					...period,
					roe,
				}
				: period,
	);
};

export const getStockDetailWithCache =
	async (
		symbol: string,
	) => {
		const normalizedSymbol =
			normalizeStockSymbol(
				symbol,
			);

		const cached =
			await StockDetailCache.findOne({
				symbol:
					normalizedSymbol,
			}).lean();

		const dartEnabled =
			isDartConfigured();

		const cacheCanBeUsed =
			Boolean(
				cached &&
				cached.fetchedAt &&
				isFresh(
					cached.fetchedAt,
					DETAIL_TTL_MS,
				) &&
				Number(
					cached.dataVersion ||
						0,
				) >= DATA_VERSION &&
				(
					!dartEnabled ||
					cached.dartConfigured ===
						true
				),
			);

		if (cacheCanBeUsed) {
			return {
				source: "cache",
				detail: cached,
			};
		}

		const stock =
			await fetchStockData(
				normalizedSymbol,
			);

		const [
			financial,
			dartDetail,
		] = await Promise.all([
			fetchStockFinancialData(
				normalizedSymbol,
			).catch(
				(error) => {
					console.error(
						`financial detail fetch failed: ${normalizedSymbol}`,
						error.message ||
							error,
					);

					return {};
				},
			),
			fetchDartStockDetail(
				normalizedSymbol,
			),
		]);

		const now =
			new Date();

		const roe =
			toNumberOrNull(
				financial.roe ??
					stock.roe,
			);

		const annualFinancials =
			mergeLatestRoe(
				dartDetail
					?.annualFinancials ??
					[],
				roe,
			);

		const quarterlyFinancials =
			mergeLatestRoe(
				dartDetail
					?.quarterlyFinancials ??
					[],
				roe,
			);

		const detailData = {
			symbol:
				stock.symbol ??
				normalizedSymbol,
			name:
				stock.name ??
				stock.longName ??
				stock.shortName ??
				normalizedSymbol,
			market:
				stock.market ??
				"KRX",
			assetType:
				stock.assetType ??
				"STOCK",
			tradable:
				stock.tradable ??
				true,

			price:
				Number(
					stock.price ??
						stock.regularMarketPrice ??
						0,
				),
			changePrice:
				Number(
					stock.changePrice ??
						stock.regularMarketChange ??
						0,
				),
			changeRate:
				Number(
					stock.changeRate ??
						stock.regularMarketChangePercent ??
						0,
				),
			open:
				Number(
					stock.open ??
						stock.regularMarketOpen ??
						0,
				),
			high:
				Number(
					stock.high ??
						stock.regularMarketDayHigh ??
						0,
				),
			low:
				Number(
					stock.low ??
						stock.regularMarketDayLow ??
						0,
				),
			volume:
				Number(
					stock.volume ??
						stock.regularMarketVolume ??
						0,
				),

			marketCap:
				toNumberOrNull(
					financial.marketCap ??
						stock.marketCap,
				),
			per:
				toNumberOrNull(
					financial.per ??
						stock.per,
				),
			pbr:
				toNumberOrNull(
					financial.pbr ??
						stock.pbr,
				),
			eps:
				toNumberOrNull(
					financial.eps ??
						stock.eps,
				),
			bps:
				toNumberOrNull(
					financial.bps ??
						stock.bps,
				),
			roe,
			revenue:
				toNumberOrNull(
					financial.revenue ??
						stock.revenue,
				),
			operatingProfit:
				toNumberOrNull(
					financial.operatingProfit ??
						stock.operatingProfit,
				),
			netIncome:
				toNumberOrNull(
					financial.netIncome ??
						stock.netIncome,
				),

			listedShares:
				dartDetail
					?.listedShares ??
				toNumberOrNull(
					stock.listedShares,
				),
			foreignOwnershipRate:
				toNumberOrNull(
					stock.foreignOwnershipRate,
				),
			faceValue:
				toNumberOrNull(
					stock.faceValue,
				),

			corpCode:
				dartDetail?.corpCode ??
				null,
			homepageUrl:
				dartDetail?.homepageUrl ??
				null,
			irUrl:
				dartDetail?.irUrl ??
				null,
			companyNameEng:
				dartDetail?.companyNameEng ??
				null,
			ceoName:
				dartDetail?.ceoName ??
				null,
			address:
				dartDetail?.address ??
				null,
			industryCode:
				dartDetail?.industryCode ??
				null,
			establishedDate:
				dartDetail?.establishedDate ??
				null,
			fiscalMonth:
				dartDetail?.fiscalMonth ??
				null,

			annualFinancials,
			quarterlyFinancials,

			dartConfigured:
				Boolean(
					dartDetail,
				),
			dataVersion:
				DATA_VERSION,

			source:
				dartDetail
					? "KIS+DART"
					: "KIS",
			fetchedAt: now,
			dartFetchedAt:
				dartDetail?.fetchedAt ??
				null,
		};

		const summary =
			buildSummary({
				name:
					detailData.name,
				market:
					detailData.market,
				assetType:
					detailData.assetType,
				changeRate:
					detailData.changeRate,
				volume:
					detailData.volume,
			});

		const saved =
			await StockDetailCache.findOneAndUpdate(
				{
					symbol:
						normalizedSymbol,
				},
				{
					$set: {
						...detailData,
						summary,
					},
				},
				{
					upsert: true,
					new: true,
					setDefaultsOnInsert:
						true,
				},
			).lean();

		return {
			source:
				dartDetail
					? "kis+dart"
					: "kis",
			detail: saved,
		};
	};
