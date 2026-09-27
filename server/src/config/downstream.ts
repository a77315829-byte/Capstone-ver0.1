import dotenv from "dotenv";

dotenv.config();

export type DownstreamService = {
	name: string;
	baseUrl: string;
	timeoutMs: number;
	unavailableMessage: string;
};

const positiveInteger = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizedUrl = (value: string | undefined, fallback: string): string =>
	(value?.trim() || fallback).replace(/\/+$/, "");

export const downstreamServices = {
	scenario: {
		name: "scenario",
		baseUrl: normalizedUrl(
			process.env.SCENARIO_SERVICE_URL,
			"http://127.0.0.1:8000",
		),
		timeoutMs: positiveInteger(
			process.env.SCENARIO_SERVICE_TIMEOUT_MS,
			30_000,
		),
		unavailableMessage: "Scenario Service 연결 실패",
	},
	marketReaction: {
		name: "market-reaction",
		baseUrl: normalizedUrl(
			process.env.MARKET_REACTION_URL,
			"http://127.0.0.1:8002",
		),
		timeoutMs: positiveInteger(
			process.env.MARKET_REACTION_TIMEOUT_MS,
			120_000,
		),
		unavailableMessage: "시장 반응 분석 서비스 연결 실패",
	},
	aiJudgment: {
		name: "ai-judgment",
		baseUrl: normalizedUrl(
			process.env.AI_JUDGMENT_SERVICE_URL,
			"http://127.0.0.1:8003",
		),
		timeoutMs: positiveInteger(
			process.env.AI_JUDGMENT_SERVICE_TIMEOUT_MS,
			120_000,
		),
		unavailableMessage: "AI Judgment Service 연결 실패",
	},
} satisfies Record<string, DownstreamService>;

export const DOWNSTREAM_HEALTH_TIMEOUT_MS = positiveInteger(
	process.env.DOWNSTREAM_HEALTH_TIMEOUT_MS,
	3_000,
);
