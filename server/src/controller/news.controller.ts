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
  imageUrl?: string | null;
}

const cache = new NodeCache({
  stdTTL: 15 * 60,
  checkperiod: 60,
});

const imageCache = new NodeCache({
  stdTTL: 24 * 60 * 60,
  checkperiod: 30 * 60,
});

function cleanNaverText(value: string): string {
  if (!value) return "";

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

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getSourceName(url: string): string {
  if (!url) return "뉴스";

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "뉴스";
  }
}

function readQueryString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveImageUrl(rawImageUrl: string, articleUrl: string): string | null {
  try {
    const decoded = decodeHtmlAttribute(rawImageUrl);
    if (!decoded) return null;

    const resolved = new URL(decoded, articleUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractMetaImage(html: string, articleUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1];
    if (!candidate) continue;

    const resolved = resolveImageUrl(candidate, articleUrl);
    if (resolved) return resolved;
  }

  return null;
}

async function fetchArticleImage(articleUrl: string): Promise<string | null> {
  if (!isHttpUrl(articleUrl)) return null;

  const cached = imageCache.get<string | null>(articleUrl);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900);

  try {
    const response = await fetch(articleUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      imageCache.set(articleUrl, null);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      imageCache.set(articleUrl, null);
      return null;
    }

    const html = (await response.text()).slice(0, 300_000);
    const imageUrl = extractMetaImage(html, response.url || articleUrl);
    imageCache.set(articleUrl, imageUrl);
    return imageUrl;
  } catch {
    imageCache.set(articleUrl, null, 60 * 60);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const getNews = async (req: Request, res: Response): Promise<void> => {
  const symbol = String(req.params.symbol || "").trim();
  const stockName = readQueryString(req.query.name);
  const market = readQueryString(req.query.market).toUpperCase();

  const clientId =
    process.env.STOTRA_NAVER_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const clientSecret =
    process.env.STOTRA_NAVER_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({
      message: "네이버 뉴스 API 키가 설정되지 않았습니다.",
      requiredEnv: [
        "STOTRA_NAVER_CLIENT_ID",
        "STOTRA_NAVER_CLIENT_SECRET",
      ],
    });
    return;
  }

  const keyword = stockName || symbol || "국내 증시";
  const searchQuery = `${keyword} 주식`;

  const cacheKey = [
    "naver-news-v2",
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

    const baseNews: NewsItem[] = items
      .map((item): NewsItem => {
        const sourceUrl = item.originallink || item.link || "";
        return {
          title: cleanNaverText(item.title),
          description: cleanNaverText(item.description),
          publishedAt: item.pubDate,
          source: getSourceName(sourceUrl),
          sourceUrl,
          symbols: symbol ? [symbol] : [],
          imageUrl: null,
        };
      })
      .filter((item) => {
        if (!item.title || !item.sourceUrl) return false;
        if (uniqueUrls.has(item.sourceUrl)) return false;
        uniqueUrls.add(item.sourceUrl);
        return true;
      });

    // Naver 뉴스 검색 API에는 썸네일 필드가 없어서 원문 og:image를 짧게 보강합니다.
    // 12개 요청을 동시에 보내고 각각 0.9초에서 중단하므로 지연을 제한합니다.
    const imageResults = await Promise.allSettled(
      baseNews.map((item) => fetchArticleImage(item.sourceUrl)),
    );

    const news = baseNews.map((item, index) => {
      const imageResult = imageResults[index];
      return {
        ...item,
        imageUrl:
          imageResult?.status === "fulfilled" ? imageResult.value : null,
      };
    });

    cache.set(cacheKey, news);
    console.log(`네이버 뉴스 조회 완료: ${keyword}, ${news.length}건`);
    res.status(200).json(news);
  } catch (error) {
    console.error("네이버 뉴스 조회 중 오류:", error);
    res.status(500).json({
      message: "뉴스 조회 중 서버 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default {
  getNews,
};