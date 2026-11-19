import { Request, Response } from "express";
import axios from "axios";
import { timeoutMs, aiMode, withDeadline } from "../utils/runtime";
import { getStockDetailWithCache } from "../services/stockDetail.service";

type ChartPoint = {
	time?: number;
	open?: number;
	high?: number;
	low?: number;
	close?: number;
	volume?: number;
};

type AssistantRequestBody = {
	symbol?: string;
	stockName?: string;
	currentPrice?: number;
	changeRate?: number;
	changePrice?: number;
	volume?: number;
	chartPeriod?: string;
	chartInterval?: string;
	chartPoints?: ChartPoint[];
	userQuestion?: string;
};

const LLM_BASE_URL = process.env.STOTRA_LLM_BASE_URL || "http://127.0.0.1:11434";
const LLM_MODEL = process.env.STOTRA_LLM_MODEL || "llama3.1:8b";
const USE_LLM = process.env.STOTRA_AI_USE_LLM !== "false" && aiMode() !== "rules";

const safeNumber = (value: any, fallback = 0): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const calcStd = (values: number[]): number => {
	if (values.length === 0) return 0;

	const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
	const variance =
		values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
		values.length;

	return Math.sqrt(variance);
};

const analyzeChart = (chartPoints: ChartPoint[] = []) => {
	const points = chartPoints
		.map((point) => ({
			time: safeNumber(point.time),
			open: safeNumber(point.open),
			high: safeNumber(point.high),
			low: safeNumber(point.low),
			close: safeNumber(point.close),
			volume: safeNumber(point.volume),
		}))
		.filter((point) => point.close > 0)
		.sort((a, b) => a.time - b.time);

	if (points.length < 2) {
		return {
			pointCount: points.length,
			trendRate: 0,
			volatility: 0,
			volumeAverage: 0,
			recentClose: points[0]?.close ?? 0,
			highest: points[0]?.high ?? 0,
			lowest: points[0]?.low ?? 0,
			trendLabel: "데이터 부족",
		};
	}

	const first = points[0];
	const last = points[points.length - 1];

	const trendRate = ((last.close - first.close) / first.close) * 100;

	const returns = points.slice(1).map((point, index) => {
		const prev = points[index];
		return prev.close > 0 ? (point.close - prev.close) / prev.close : 0;
	});

	const volatility = calcStd(returns) * 100;
	const volumeAverage =
		points.reduce((sum, point) => sum + point.volume, 0) / points.length;

	const highest = Math.max(...points.map((point) => point.high));
	const lowest = Math.min(...points.map((point) => point.low));

	let trendLabel = "횡보";
	if (trendRate >= 3) trendLabel = "강한 상승";
	else if (trendRate >= 1) trendLabel = "완만한 상승";
	else if (trendRate <= -3) trendLabel = "강한 하락";
	else if (trendRate <= -1) trendLabel = "완만한 하락";

	return {
		pointCount: points.length,
		trendRate,
		volatility,
		volumeAverage,
		recentClose: last.close,
		highest,
		lowest,
		trendLabel,
	};
};

const getRuleBasedFallback = (
	stockName: string,
	changeRate: number,
	chartSummary: ReturnType<typeof analyzeChart>,
) => {
	if (changeRate >= 3 || chartSummary.trendRate >= 4) {
		return {
			decision: "관망",
			riskLevel: "높음",
			summary:
				"현재 단기 상승폭이 커서 추격 매수보다는 관망이 더 적절합니다.",
			reasons: [
				"등락률 또는 차트 상승률이 높아 단기 과열 가능성이 있습니다.",
				"급등 이후에는 변동성이 커질 수 있습니다.",
				"초보 투자자라면 진입 타이밍을 한 번 더 확인하는 것이 안전합니다.",
			],
			alternative: "눌림목 확인 후 분할 매수를 고려할 수 있습니다.",
		};
	}

	if (changeRate <= -3 || chartSummary.trendRate <= -4) {
		return {
			decision: "관망",
			riskLevel: "높음",
			summary:
				"하락폭이 큰 상태이므로 바로 매수하기보다 하락 원인을 확인하는 것이 좋습니다.",
			reasons: [
				"단기 하락률이 커서 추가 하락 가능성이 있습니다.",
				"반등 신호 없이 진입하면 손실 위험이 커질 수 있습니다.",
				"뉴스, 시장 흐름, 거래량을 함께 확인해야 합니다.",
			],
			alternative: "지지선 확인 또는 반등 신호 이후 접근하는 것이 적절합니다.",
		};
	}

	if (chartSummary.trendRate > 1 && changeRate > 0) {
		return {
			decision: "소량 매수 또는 관망",
			riskLevel: "보통",
			summary: `${stockName}은 현재 완만한 상승 흐름입니다. 다만 한 번에 진입하기보다는 분할 접근이 적절합니다.`,
			reasons: [
				"차트 흐름이 상승 방향입니다.",
				"현재 등락률이 양수입니다.",
				"다만 단기 변동성과 재무지표를 함께 확인해야 합니다.",
			],
			alternative: "초보자라면 소액 분할 매수 또는 관망이 적절합니다.",
		};
	}

	return {
		decision: "관망",
		riskLevel: "보통",
		summary:
			"현재 데이터만으로는 강한 매수 또는 매도 근거가 부족하여 관망이 적절합니다.",
		reasons: [
			"차트 방향성이 강하지 않습니다.",
			"현재가와 재무지표만으로는 확실한 진입 근거가 부족합니다.",
			"추가 뉴스나 시장 흐름을 확인할 필요가 있습니다.",
		],
		alternative: "관망하면서 가격 흐름과 거래량 변화를 추가 확인하는 것이 좋습니다.",
	};
};

const extractJson = (text: string) => {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");

	if (start === -1 || end === -1 || end <= start) {
		throw new Error("LLM response did not contain JSON");
	}

	return JSON.parse(text.slice(start, end + 1));
};

const callOllama = async (prompt: string) => {
	const res = await axios.post(
		`${LLM_BASE_URL}/api/chat`,
		{
			model: LLM_MODEL,
			stream: false,
			messages: [
				{
					role: "system",
					content:
						"너는 초보 투자자를 위한 주식 판단 보조 AI다. 투자 권유가 아니라 교육용 판단 비교를 제공한다. 반드시 JSON만 출력한다.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			options: {
				temperature: 0.2,
				num_predict: 700,
			},
		},
		{
			timeout: timeoutMs("AI_SERVICE_TIMEOUT_MS", 20000),
		},
	);

	const content = res.data?.message?.content || "";
	return extractJson(content);
};

const buildPrompt = (params: {
	symbol: string;
	stockName: string;
	currentPrice: number;
	changeRate: number;
	changePrice: number;
	volume: number;
	chartPeriod: string;
	chartInterval: string;
	chartSummary: ReturnType<typeof analyzeChart>;
	detail: any;
	userQuestion: string;
}) => {
	const {
		symbol,
		stockName,
		currentPrice,
		changeRate,
		changePrice,
		volume,
		chartPeriod,
		chartInterval,
		chartSummary,
		detail,
		userQuestion,
	} = params;

	return `
아래 종목에 대해 "AI라면 지금 어떻게 판단할지" 교육용으로 분석해라.

[사용자 질문]
${userQuestion || "AI라면 지금 매수/매도/관망 중 어떤 판단을 할까?"}

[종목]
- 종목명: ${stockName}
- 종목코드: ${symbol}
- 현재가: ${currentPrice}
- 등락률: ${changeRate}%
- 등락금액: ${changePrice}
- 거래량: ${volume}

[차트 요약]
- 기간: ${chartPeriod}
- 봉 간격: ${chartInterval}
- 데이터 개수: ${chartSummary.pointCount}
- 차트 추세: ${chartSummary.trendLabel}
- 차트 기간 수익률: ${chartSummary.trendRate.toFixed(2)}%
- 변동성: ${chartSummary.volatility.toFixed(4)}%
- 최고가: ${chartSummary.highest}
- 최저가: ${chartSummary.lowest}
- 평균 거래량: ${Math.round(chartSummary.volumeAverage)}

[재무정보]
- 시장: ${detail?.market ?? "정보 없음"}
- PER: ${detail?.per ?? "정보 없음"}
- PBR: ${detail?.pbr ?? "정보 없음"}
- EPS: ${detail?.eps ?? "정보 없음"}
- BPS: ${detail?.bps ?? "정보 없음"}
- ROE: ${detail?.roe ?? "정보 없음"}
- 매출액: ${detail?.revenue ?? "정보 없음"}
- 영업이익: ${detail?.operatingProfit ?? "정보 없음"}
- 순이익: ${detail?.netIncome ?? "정보 없음"}

[판단 기준]
- 단기 급등이면 추격 매수 위험을 설명한다.
- 단기 급락이면 반등 확인 필요성을 설명한다.
- 재무지표가 부족하면 부족하다고 말한다.
- 초보 투자자 관점에서 리스크를 반드시 설명한다.
- "무조건 매수" 같은 표현은 금지한다.
- 투자 조언이 아니라 학습용 판단 비교로 설명한다.

반드시 아래 JSON 스키마로만 답해라.

{
  "decision": "매수" | "매도" | "관망" | "소량 매수",
  "riskLevel": "낮음" | "보통" | "높음",
  "summary": "핵심 요약 한 문단",
  "reasons": ["근거1", "근거2", "근거3"],
  "alternative": "대안 판단",
  "missedFactors": ["추가로 확인해야 할 요소1", "추가로 확인해야 할 요소2"],
  "educationPoint": "초보자가 배워야 할 포인트"
}
`;
};

const stockAssistant = async (req: Request, res: Response) => {
	try {
		const body = req.body as AssistantRequestBody;

		const symbol = body.symbol || "";
		const stockName = body.stockName || symbol || "선택 종목";
		const currentPrice = safeNumber(body.currentPrice, 0);
		const changeRate = safeNumber(body.changeRate, 0);
		const changePrice = safeNumber(body.changePrice, 0);
		const volume = safeNumber(body.volume, 0);
		const chartPeriod = body.chartPeriod || "1d";
		const chartInterval = body.chartInterval || "1m";
		const chartPoints = body.chartPoints || [];
		const userQuestion = body.userQuestion || "";

		if (!symbol) {
			return res.status(400).json({
				success: false,
				message: "symbol이 필요합니다.",
			});
		}

		const chartSummary = analyzeChart(chartPoints);

		const detailResult = await withDeadline(getStockDetailWithCache(symbol), 3000).catch((error) => {
			console.error("AI detail fetch failed:", error.message || error);
			return null;
		});

		const detail = detailResult?.detail ?? null;

		if (!USE_LLM) {
			const fallback = getRuleBasedFallback(stockName, changeRate, chartSummary);

			return res.status(200).json({
				success: true,
				data: {
					type: "rule_based",
					symbol,
					stockName,
					currentPrice,
					changeRate,
					userQuestion,
					chartSummary,
					...fallback,
					disclaimer:
						"현재 LLM이 비활성화되어 규칙 기반 판단을 반환했습니다.",
					createdAt: new Date().toISOString(),
				},
			});
		}

		try {
			const prompt = buildPrompt({
				symbol,
				stockName,
				currentPrice,
				changeRate,
				changePrice,
				volume,
				chartPeriod,
				chartInterval,
				chartSummary,
				detail,
				userQuestion,
			});

			const llmResult = await callOllama(prompt);

			return res.status(200).json({
				success: true,
				data: {
					type: "llm_stock_assistant",
					symbol,
					stockName,
					currentPrice,
					changeRate,
					userQuestion,
					chartSummary,
					decision: llmResult.decision || "관망",
					riskLevel: llmResult.riskLevel || "보통",
					summary: llmResult.summary || "분석 결과를 생성했습니다.",
					reasons: Array.isArray(llmResult.reasons)
						? llmResult.reasons
						: [],
					alternative: llmResult.alternative || "",
					missedFactors: Array.isArray(llmResult.missedFactors)
						? llmResult.missedFactors
						: [],
					educationPoint: llmResult.educationPoint || "",
					disclaimer:
						"이 응답은 현재가, 차트 요약, 재무지표를 바탕으로 생성된 교육용 AI 판단 비교입니다.",
					createdAt: new Date().toISOString(),
				},
			});
		} catch (llmError: any) {
			console.error("LLM stock assistant failed:", llmError.message || llmError);

			const fallback = getRuleBasedFallback(stockName, changeRate, chartSummary);

			return res.status(200).json({
				success: true,
				data: {
					type: "fallback_rule_based",
					symbol,
					stockName,
					currentPrice,
					changeRate,
					userQuestion,
					chartSummary,
					...fallback,
					disclaimer:
						"LLM 응답 생성에 실패하여 규칙 기반 판단을 반환했습니다. Ollama 실행 상태를 확인하세요.",
					createdAt: new Date().toISOString(),
				},
			});
		}
	} catch (error: any) {
		console.error("stockAssistant error:", error);

		return res.status(500).json({
			success: false,
			message: "AI라면 응답 생성 중 오류가 발생했습니다.",
			error: error.message,
		});
	}
};

export default {
	stockAssistant,
};
