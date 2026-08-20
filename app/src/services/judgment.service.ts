import api from "./api.service";

export type AiJudgmentLabel = "매수" | "매도" | "관망";
export type AiFactorDirection = "긍정" | "부정";
export type AiProbabilities = Record<AiJudgmentLabel, number>;

// 백엔드가 직접/간접 요인 구분을 없애서 더 이상 type 필드를 안 보낸다.
export type AiJudgmentFactor = {
	direction?: AiFactorDirection | null;
	factor: string;
	weight: number;
};

export type AiJudgment = {
	symbol: string;
	judge: AiJudgmentLabel;
	confidence: number;
	probabilities: AiProbabilities;
	summary: string;
	factors: AiJudgmentFactor[];
	computed_at: string;
};

export type AiHistoryEntry = {
	time: string;
	judge: AiJudgmentLabel;
	probabilities: AiProbabilities;
	reason: string;
	changed: boolean;
};

export type AiCompareResult = {
	user_judge: AiJudgmentLabel;
	ai_judge: AiJudgmentLabel;
	ai_probabilities: AiProbabilities;
	explanation: string;
	highlighted_factors: string[];
};

function unwrap<T>(payload: any): T {
	if (payload?.success === true && payload?.data !== undefined) {
		return payload.data as T;
	}

	if (payload?.data !== undefined && payload?.symbol === undefined) {
		return payload.data as T;
	}

	return payload as T;
}

const judgmentService = {
	async getJudgment(symbol: string): Promise<AiJudgment> {
		const normalized = symbol.trim().toUpperCase();

		const response = await api.get(
			`/ai-judgment/${encodeURIComponent(normalized)}`,
		);

		return unwrap<AiJudgment>(response.data);
	},

	// 종목 화면을 보는 동안 백엔드의 실시간 감시 대상으로 등록(하트비트).
	// 이력이 없는 종목이면 백엔드가 콜드스타트로 첫 판단까지 만들어준다.
	async watchSymbol(symbol: string): Promise<void> {
		const normalized = symbol.trim().toUpperCase();
		await api.post(`/ai-judgment/${encodeURIComponent(normalized)}/watch`);
	},

	// 종목 화면을 벗어날 때 감시 대상에서 해제.
	async unwatchSymbol(symbol: string): Promise<void> {
		const normalized = symbol.trim().toUpperCase();
		await api.delete(`/ai-judgment/${encodeURIComponent(normalized)}/watch`);
	},

	async getHistory(symbol: string, limit = 20): Promise<AiHistoryEntry[]> {
		const normalized = symbol.trim().toUpperCase();

		const response = await api.get(
			`/ai-judgment/${encodeURIComponent(normalized)}/history`,
			{ params: { limit } },
		);

		return unwrap<AiHistoryEntry[]>(response.data);
	},

	async compare(symbol: string, userJudge: AiJudgmentLabel): Promise<AiCompareResult> {
		const normalized = symbol.trim().toUpperCase();

		const response = await api.post(`/ai-judgment/compare`, {
			symbol: normalized,
			user_judge: userJudge,
		});

		return unwrap<AiCompareResult>(response.data);
	},
};

export default judgmentService;
