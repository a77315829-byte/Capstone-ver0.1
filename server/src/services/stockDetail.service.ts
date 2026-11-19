import { fetchNaverFinancials } from "./naverFinancial.service";
import StockDetailCache from "../models/stockDetailCache.model";
import { financialCacheTtlMs, mergeReportedPeriods } from "../utils/financialData";

import {
	fetchStockData,
	fetchStockFinancialData,
	normalizeStockSymbol,
} from "../utils/requests";

import {
	fetchDartStockDetail,
	isDartConfigured,
} from "./dartStockDetail.service";

const DATA_VERSION = 5;

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
					financialCacheTtlMs(cached),
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

        const supplemental = !dartDetail?.annualFinancials?.length || !dartDetail?.quarterlyFinancials?.length || financial.roe == null || financial.revenue == null
            ? await fetchNaverFinancials(normalizedSymbol) : null;
        const latestReported = supplemental?.annualFinancials[0];
        const providerSource = ["KIS", ...(dartDetail ? ["DART"] : []), ...(supplemental ? ["NAVER"] : [])].join("+");

		const now =
			new Date();

		const roe =
			toNumberOrNull(
				financial.roe ?? latestReported?.roe ??
					stock.roe,
			);

        const annualFinancials = mergeReportedPeriods(dartDetail?.annualFinancials ?? [], supplemental?.annualFinancials ?? []);
        const quarterlyFinancials = mergeReportedPeriods(dartDetail?.quarterlyFinancials ?? [], supplemental?.quarterlyFinancials ?? []);

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
						(stock.marketCap == null ? null : stock.marketCap * 100_000_000),
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
					dartDetail?.annualFinancials[0]?.revenue ?? financial.revenue ?? latestReported?.revenue ??
						stock.revenue,
				),
			operatingProfit:
				toNumberOrNull(
					dartDetail?.annualFinancials[0]?.operatingProfit ?? financial.operatingProfit ?? latestReported?.operatingProfit ??
						stock.operatingProfit,
				),
			netIncome:
				toNumberOrNull(
					dartDetail?.annualFinancials[0]?.netIncome ?? financial.netIncome ?? latestReported?.netIncome ??
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
				providerSource,
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
				providerSource.toLowerCase(),
			detail: saved,
		};
	};
