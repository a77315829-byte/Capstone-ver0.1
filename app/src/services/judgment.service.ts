import api from "./api.service";

export type AiJudgmentLabel = "매수" | "매도" | "관망";
export type AiFactorType = "직접" | "간접";
export type AiFactorDirection = "긍정" | "부정";

export type AiJudgmentFactor = {
	type: AiFactorType;
	direction?: AiFactorDirection | null;
	factor: string;
	weight: number;
};

export type AiJudgment = {
	symbol: string;
	judge: AiJudgmentLabel;
	confidence: number;
	summary: string;
	factors: AiJudgmentFactor[];
	computed_at: string;
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
};

export default judgmentService;
