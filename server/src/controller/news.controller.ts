import { Request, Response } from "express";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();

console.log("=== NAVER news.controller.ts loaded ===", __filename);

interface NaverNewsItem {
	title: string;
	originallink?: string;
	link?: string;
	description: string;
	pubDate: string;
}

interface NaverNewsResponse {
	lastBuildDate?: string;
	total?: number;
	start?: number;
	display?: number;
	items?: NaverNewsItem[];
}

interface NewsItem {
	title: string;
	description: string;
	publishedAt: string;
	source: string;
	sourceUrl: string;
	symbols: string[];
}

// 같은 뉴스 요청은 15분간 캐시
const cache = new NodeCache({
	stdTTL: 15 * 60,
	checkperiod: 60,
});

/**
 * 네이버 뉴스 응답에 들어 있는 HTML 태그 및 엔티티 제거
 */
function cleanNaverText(value: string): string {
	if (!value) {
		return "";
	}

	return value
		.replace(/<[^>]*>/g, "")
		.replace(/&quot;/g, '"')
		.replace(/&#34;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * 기사 URL에서 언론사 도메인 추출
 */
function getSourceName(url: string): string {
	if (!url) {
		return "뉴스";
	}

	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "뉴스";
	}
}

function readQueryString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

const getNews = async (req: Request, res: Response): Promise<void> => {
	/*
	#swagger.tags = ['News']
	#swagger.description = '네이버 검색 API를 이용해 종목 관련 뉴스를 조회합니다.'
	*/

	const symbol = String(req.params.symbol || "").trim();
	const stockName = readQueryString(req.query.name);
	const market = readQueryString(req.query.market).toUpperCase();

	const clientId =
		process.env.STOTRA_NAVER_CLIENT_ID ||
		process.env.NAVER_CLIENT_ID;

	const clientSecret =
		process.env.STOTRA_NAVER_CLIENT_SECRET ||
		process.env.NAVER_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		console.error("네이버 뉴스 API 키가 설정되지 않았습니다.");

		res.status(500).json({
			message: "네이버 뉴스 API 키가 설정되지 않았습니다.",
			requiredEnv: [
				"STOTRA_NAVER_CLIENT_ID",
				"STOTRA_NAVER_CLIENT_SECRET",
			],
		});
		return;
	}

	/*
	 * 국내 종목은 종목 코드보다 종목명으로 검색해야 정확도가 높다.
	 *
	 * 예:
	 * symbol = 005930
	 * stockName = 삼성전자
	 * 실제 검색어 = 삼성전자 주식
	 */
	const keyword = stockName || symbol || "국내 증시";
	const searchQuery = `${keyword} 주식`;

	const cacheKey = [
		"naver-news",
		market || "ALL",
		symbol || "NO_SYMBOL",
		keyword,
	].join(":");

	const cachedNews = cache.get<NewsItem[]>(cacheKey);

	if (cachedNews) {
		res.status(200).json(cachedNews);
		return;
	}

	try {
		const params = new URLSearchParams({
			query: searchQuery,
			display: "12",
			start: "1",
			sort: "date",
		});

		const response = await fetch(
			`https://openapi.naver.com/v1/search/news.json?${params.toString()}`,
			{
				method: "GET",
				headers: {
					"X-Naver-Client-Id": clientId,
					"X-Naver-Client-Secret": clientSecret,
					Accept: "application/json",
				},
			},
		);

		if (!response.ok) {
			const errorBody = await response.text();

			console.error("네이버 뉴스 API 호출 실패:", {
				status: response.status,
				statusText: response.statusText,
				body: errorBody,
			});

			res.status(502).json({
				message: "네이버 뉴스 API 호출에 실패했습니다.",
				status: response.status,
			});
			return;
		}

		const result = (await response.json()) as NaverNewsResponse;
		const items = Array.isArray(result.items) ? result.items : [];

		const uniqueUrls = new Set<string>();

		const news: NewsItem[] = items
			.map((item): NewsItem => {
				const sourceUrl =
					item.originallink ||
					item.link ||
					"";

				return {
					title: cleanNaverText(item.title),
					description: cleanNaverText(item.description),
					publishedAt: item.pubDate,
					source: getSourceName(sourceUrl),
					sourceUrl,
					symbols: symbol ? [symbol] : [],
				};
			})
			.filter((item) => {
				if (!item.title || !item.sourceUrl) {
					return false;
				}

				// 동일 URL 기사 제거
				if (uniqueUrls.has(item.sourceUrl)) {
					return false;
				}

				uniqueUrls.add(item.sourceUrl);
				return true;
			});

		cache.set(cacheKey, news);

		console.log(
			`네이버 뉴스 조회 완료: ${keyword}, ${news.length}건`,
		);

		res.status(200).json(news);
	} catch (error) {
		console.error("네이버 뉴스 조회 중 오류:", error);

		res.status(500).json({
			message: "뉴스 조회 중 서버 오류가 발생했습니다.",
			error:
				error instanceof Error
					? error.message
					: String(error),
		});
	}
};

export default {
	getNews,
};