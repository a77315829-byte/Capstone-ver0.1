import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Box,
	Button,
	Checkbox,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	Input,
	InputGroup,
	InputLeftElement,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Radio,
	RadioGroup,
	Select,
	SimpleGrid,
	Skeleton,
	Spinner,
	Stack,
	Text,
	Textarea,
	useDisclosure,
	useToast,
} from "@chakra-ui/react";
import {
	FiAlertTriangle,
	FiArrowRight,
	FiBookOpen,
	FiCheck,
	FiCheckCircle,
	FiExternalLink,
	FiInfo,
	FiSearch,
	FiShield,
	FiTarget,
} from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";

import scenarioService from "../services/scenario.service";
import ScenarioOrderSuccessModal from "../components/scenario/ScenarioOrderSuccessModal";
import TurnFeedbackModal from "../components/scenario/TurnFeedbackModal";
import FinalResultModal from "../components/scenario/FinalResultModal";

/* ============================================================================
 * Types
 * ========================================================================== */

type OrderSide = "BUY" | "SELL";
type ChartRange = "DAY" | "WEEK" | "MONTH";
type DataTab = "CHART" | "TRADES";

type SessionPublic = {
	session_id: string;
	user_id: string;
	scenario_id: string;
	scenario_version: number;
	status: string;
	current_turn: number;
	started_at: string;
	completed_at?: string | null;
	final_evaluation_id?: string | null;
};

type ScenarioProgress = {
	current_turn: number;
	total_turns: number;
	market_date: string;
	next_market_date?: string | null;
	final_valuation_date: string;
};

type ScenarioMeta = {
	scenario_id: string;
	title: string;
	description: string;
	difficulty: string;
	learning_points: string[];
};

type TurnMeta = {
	turn_no: number;
	title: string;
	phase?: string;
	summary?: string;
};

type MarketMetric = {
	kind?: string;
	code?: string;
	name?: string;
	value?: number | string | null;
	change_pct?: number | null;
	unit?: string;
	as_of_date?: string;
};

type MarketState = {
	snapshot_id?: string;
	scenario_id?: string;
	scenario_version?: number;
	turn_no?: number;
	market_date?: string;
	sentiment?: string;
	sentiment_score?: number;
	sector_state?: string;
	indices?: MarketMetric[];
	indicators?: MarketMetric[];
	risk_factors?: string[];
};

type NewsItem = {
	news_id: string;
	published_at?: string;
	title: string;
	summary?: string;
	source_name?: string;
	source_url?: string;
	related_assets?: string[];
	importance?: string;
	display_order?: number;
};

type AssetSummary = {
	asset_id: string;
	name: string;
	market?: string;
	asset_type?: string;
	industry_label?: string;
	current_price?: number | null;
	previous_close?: number | null;
	change?: number | null;
	change_pct?: number | null;
	volume?: number | null;
	price_date?: string | null;
	data_available?: boolean;
};

type PortfolioPosition = {
	asset_id: string;
	name: string;
	industry_label?: string;
	quantity: number;
	avg_price: number;
	current_price: number;
	market_value: number;
	unrealized_pnl: number;
	realized_pnl?: number;
	weight_pct?: number;
};

type PortfolioState = {
	market_date: string;
	cash: number;
	cash_weight_pct: number;
	position_value: number;
	total_value: number;
	profit_loss: number;
	cumulative_return_pct: number;
	positions: PortfolioPosition[];
	realized_pnl_total?: number;
	missing_price_assets?: string[];
	data_complete?: boolean;
	turn_base_value?: number;
	turn_return_pct?: number;
};

type QuestionType = "single" | "multi" | "free";

type QuestionItem = {
	question_id: string;
	category?: string;
	metric?: string;
	type: QuestionType;
	max_select?: number;
	text: string;
	options?: string[];
};

type TurnView = {
	session: SessionPublic;
	progress?: ScenarioProgress;
	scenario?: ScenarioMeta;
	turn?: TurnMeta;
	market_state?: MarketState | null;
	news?: NewsItem[];
	assets?: AssetSummary[];
	default_asset_id?: string | null;
	portfolio?: PortfolioState;
	orders?: OrderRecord[];
	questions?: QuestionItem[];
	result_ready?: boolean;
	evaluation_id?: string | null;
	finalizing?: boolean;
};

type ChartCandle = {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

type ChartResponse = {
	asset?: {
		asset_id?: string;
		name?: string;
		market?: string;
		asset_type?: string;
		industry_label?: string;
	};
	end_date?: string;
	candles?: ChartCandle[];
	data_available?: boolean;
};

type OrderRecord = {
	order_id?: string;
	session_id?: string;
	user_id?: string;
	scenario_id?: string;
	turn_no?: number;
	market_date?: string;
	asset_id: string;
	side: OrderSide;
	order_type?: "MARKET" | "LIMIT";
	limit_price?: number | null;
	requested_quantity?: number;
	filled_quantity?: number;
	cancelled_quantity?: number;
	quantity: number;
	execution_price?: number | null;
	average_execution_price?: number | null;
	amount: number;
	realized_pnl?: number;
	status?: string;
	time_in_force?: string;
	fills?: Array<{
		price: number;
		quantity: number;
		amount: number;
	}>;
	price_basis?: string;
	created_at?: string;
};

type OrderResponse = {
	order: OrderRecord;
	portfolio: PortfolioState;
};

type AnswerValue = {
	selected: string[];
	text: string;
};

type ScenarioAnswer = {
	question_id: string;
	selected: string[];
	text: string;
};

type TurnMetricEvaluation = {
	metric?: string;
	score?: number;
	reason?: string;
	feedback?: string;
	penalties?: Array<{
		cause?: string;
		evidence?: string;
	}>;
};

type TurnGuidanceAction = {
	guidance_code?: string;
	kind?: string;
	message?: string;
	source_turn?: number;
	target_metrics?: string[];
	trigger_causes?: string[];
	check_causes?: string[];
};

type TurnGuidanceReview = {
	guidance_code?: string;
	message?: string;
	source_turn?: number;
	evaluated_turn?: number;
	status?: "FOLLOWED" | "REPEATED" | "NOT_VERIFIABLE" | string;
	evidence?: string;
	target_scores?: Record<string, number>;
};

type TurnFeedbackData = {
	good_points?: string[];
	missed_points?: string[];
	explanation?: string;
	next_actions?: TurnGuidanceAction[];
	previous_guidance_review?: TurnGuidanceReview[];
};

type TurnEvaluation = {
	evaluation_id?: string;
	turn_no?: number;
	scorecard?: {
		turn_score?: number;
		metrics?: TurnMetricEvaluation[];
		feedback?: TurnFeedbackData | string | null;
	};
};

type TurnSubmitResponse = {
	session: SessionPublic;
	turn_evaluation?: TurnEvaluation;
	next_turn?: number | null;
	final_evaluation?: FinalEvaluation | null;
};

type BehaviorPattern = {
	pattern_code?: string;
	label?: string;
	classification?: string;
	occurrence_count?: number;
	evidence_turns?: number[];
	confidence?: number;
	explanation?: string;
	recommendation?: string;
};

type FinalEvaluation = {
	evaluation_id?: string;
	user_id?: string;
	session_id?: string;
	scenario_id?: string;
	scenario_version?: number;
	completed_at?: string;
	decision_evaluation?: {
		overall_score?: number;
		metric_averages?: Record<string, number>;
		timeline?: Array<{
			turn_no?: number;
			turn_score?: number;
			metrics?: Record<string, number>;
		}>;
	};
	behavior_patterns?: BehaviorPattern[];
	portfolio_analysis?: {
		initial_value?: number;
		final_value?: number;
		profit_loss?: number;
		cumulative_return_pct?: number;
		benchmark_asset_id?: string | null;
		benchmark_return_pct?: number | null;
		excess_return_pct?: number | null;
		max_drawdown_pct?: number;
		turnover_pct?: number;
		average_cash_weight_pct?: number;
		maximum_asset_weight_pct?: number;
		concentration_hhi?: number;
		valuation_point_count?: number;
		sector_exposure?: Array<{
			sector?: string;
			market_value?: number;
			weight_pct?: number;
		}>;
		asset_contributions?: Array<{
			asset_id?: string;
			name?: string;
			total_pnl?: number;
			weight_pct?: number;
		}>;
	};
	feedback?: {
		summary?: string;
		strengths?: string[];
		improvements?: string[];
		next_actions?: string[];
	};
};

type TransitionInfo = {
	turnNo: number;
	currentDate: string;
	nextTurn: number;
	nextDate?: string | null;
};

/* ============================================================================
 * Design tokens / helpers
 * ========================================================================== */

const UI = {
	bg: "#FBF8F1",
	surface: "#FFFDF9",
	panel: "#FFFFFF",
	border: "#E9CCAA",
	borderStrong: "#E4B986",
	orange: "#FF6822",
	orangeDark: "#E75616",
	orangeSoft: "#FFF0E7",
	text: "#151515",
	subtle: "#66625E",
	muted: "#8C8780",
	blue: "#1F47FF",
	red: "#F01822",
	green: "#376C45",
	shadow: "0 8px 24px rgba(74, 45, 18, 0.08)",
};

const krw = new Intl.NumberFormat("ko-KR");
const integer = new Intl.NumberFormat("ko-KR");

const metricLabels: Record<string, string> = {
	M1: "핵심 요인 식별",
	M2: "정보 해석",
	M3: "위험 인식",
	M4: "행동 근거 합리성",
	M5: "논리 일관성",
	PORTFOLIO: "포트폴리오 관리",
};

function numberValue(value: unknown, fallback = 0): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPrice(value?: number | null): string {
	if (value == null || !Number.isFinite(Number(value))) return "-";
	return krw.format(Number(value));
}

function formatWon(value?: number | null): string {
	if (value == null || !Number.isFinite(Number(value))) return "-";
	return `${krw.format(Math.round(Number(value)))}원`;
}

function formatSignedWon(value?: number | null): string {
	if (value == null || !Number.isFinite(Number(value))) return "-";
	const n = Math.round(Number(value));
	if (n > 0) return `+${krw.format(n)}`;
	return krw.format(n);
}

function formatPct(value?: number | null, digits = 2): string {
	if (value == null || !Number.isFinite(Number(value))) return "-";
	const n = Number(value);
	return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function formatDate(value?: string | null): string {
	if (!value) return "-";
	const normalized = value.slice(0, 10);
	const [year, month, day] = normalized.split("-");
	if (!year || !month || !day) return value;
	return `${year}.${month}.${day}`;
}

function formatTime(value?: string | null): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";

	return new Intl.DateTimeFormat("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(date);
}

function daysBetween(from?: string | null, to?: string | null): number | null {
	if (!from || !to) return null;

	const start = new Date(`${from.slice(0, 10)}T00:00:00`);
	const end = new Date(`${to.slice(0, 10)}T00:00:00`);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return null;
	}

	return Math.max(
		0,
		Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
	);
}

function errorMessage(error: any, fallback: string): string {
	const payload = error?.response?.data;

	return (
		payload?.message ||
		payload?.detail ||
		payload?.error?.message ||
		payload?.error ||
		error?.message ||
		fallback
	);
}

function difficultyLabel(value?: string): string {
	if (!value) return "-";
	if (value === "상" || value.toLowerCase() === "hard") return "상급";
	if (value === "하" || value.toLowerCase() === "easy") return "초급";
	if (value === "중" || value.toLowerCase() === "medium") return "중급";
	return value;
}

function currentHoldingQuantity(
	portfolio: PortfolioState | undefined,
	assetId: string,
): number {
	return (
		portfolio?.positions?.find((item) => item.asset_id === assetId)?.quantity ??
		0
	);
}

function extractMetricRows(evaluation?: FinalEvaluation | null) {
	const values = evaluation?.decision_evaluation?.metric_averages ?? {};

	return ["M1", "M2", "M3", "M4", "M5"].map((key) => ({
		key,
		label: metricLabels[key] ?? key,
		score: numberValue(values[key], 0),
	}));
}

function normalizeTurnFeedback(value: unknown): TurnFeedbackData {
	if (!value) return {};

	if (typeof value === "object" && !Array.isArray(value)) {
		return value as TurnFeedbackData;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return {};

		try {
			const parsed = JSON.parse(trimmed);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as TurnFeedbackData;
			}
		} catch {
			// 문자열 피드백은 그대로 해설로 사용한다.
		}

		return { explanation: trimmed };
	}

	return {};
}

/* ============================================================================
 * Data transformation for chart
 * ========================================================================== */

function calendarWeekKey(value: string): string {
	const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return value;

	const daysSinceMonday = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - daysSinceMonday);
	return date.toISOString().slice(0, 10);
}

function aggregateCandlesByPeriod(
	candles: ChartCandle[],
	periodKey: (date: string) => string,
): ChartCandle[] {
	const groups = new Map<string, ChartCandle[]>();

	for (const candle of candles) {
		const key = periodKey(candle.date);
		const group = groups.get(key) ?? [];
		group.push(candle);
		groups.set(key, group);
	}

	return Array.from(groups.values()).map((group) => {
		const first = group[0]!;
		const last = group[group.length - 1]!;

		return {
			date: last.date,
			open: first.open,
			high: Math.max(...group.map((item) => item.high)),
			low: Math.min(...group.map((item) => item.low)),
			close: last.close,
			volume: group.reduce(
				(sum, item) => sum + numberValue(item.volume),
				0,
			),
		};
	});
}

function candlesForRange(
	candles: ChartCandle[],
	range: ChartRange,
): ChartCandle[] {
	const valid = candles
		.filter(
			(item) =>
				Number.isFinite(item.open) &&
				Number.isFinite(item.high) &&
				Number.isFinite(item.low) &&
				Number.isFinite(item.close),
		)
		.sort((first, second) => first.date.localeCompare(second.date));

	if (range === "DAY") {
		return valid.slice(-30);
	}

	if (range === "WEEK") {
		return aggregateCandlesByPeriod(valid, calendarWeekKey).slice(-13);
	}

	return aggregateCandlesByPeriod(valid, (date) => date.slice(0, 7)).slice(-12);
}

function formatChartDate(value: string, range: ChartRange): string {
	const [year, month, day] = value.slice(0, 10).split("-");
	if (!year || !month) return value;
	if (range === "MONTH") return `${year.slice(2)}.${month}`;
	if (!day) return `${year.slice(2)}.${month}`;
	return `${month}.${day}`;
}

/* ============================================================================
 * Small UI pieces
 * ========================================================================== */

function Panel({
	children,
	...props
}: React.ComponentProps<typeof Box>) {
	return (
		<Box
			bg={UI.panel}
			border="1px solid"
			borderColor={UI.border}
			borderRadius="10px"
			{...props}
		>
			{children}
		</Box>
	);
}

function TinyLabel({ children }: { children: React.ReactNode }) {
	return (
		<Text
			fontSize="11px"
			lineHeight="1.2"
			color={UI.muted}
			fontWeight="500"
		>
			{children}
		</Text>
	);
}

function PriceChange({
	value,
	prefixWon = false,
}: {
	value?: number | null;
	prefixWon?: boolean;
}) {
	const n = numberValue(value);
	const color = n > 0 ? UI.red : n < 0 ? UI.blue : UI.subtle;

	return (
		<Text color={color} fontWeight="800">
			{prefixWon ? formatSignedWon(value) : formatPct(value)}
		</Text>
	);
}

function EmptyData({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Flex
			minH="280px"
			direction="column"
			align="center"
			justify="center"
			textAlign="center"
			px="24px"
			color={UI.subtle}
		>
			<FiInfo size={24} color={UI.orange} />
			<Text mt="12px" fontSize="14px" fontWeight="800" color={UI.text}>
				{title}
			</Text>
			<Text mt="7px" fontSize="12px" lineHeight="1.7" maxW="430px">
				{description}
			</Text>
		</Flex>
	);
}

/* ============================================================================
 * Candlestick chart
 * ========================================================================== */

function CandlestickChart({
	candles,
	range,
	isLoading,
}: {
	candles: ChartCandle[];
	range: ChartRange;
	isLoading: boolean;
}) {
	const view = useMemo(() => candlesForRange(candles, range), [candles, range]);

	if (isLoading) {
		return <Skeleton h="340px" borderRadius="6px" />;
	}

	if (!view.length) {
		return (
			<EmptyData
				title="가격 데이터가 없습니다."
				description="해당 시점까지 적재된 과거 일봉 데이터가 없습니다. 시나리오 서버의 가격 적재 상태를 확인해주세요."
			/>
		);
	}

	const width = 920;
	const height = 350;
	const chartLeft = 18;
	const chartRight = 815;
	const priceTop = 20;
	const priceBottom = 280;
	const volumeTop = 292;
	const volumeBottom = 332;

	const lows = view.map((item) => item.low);
	const highs = view.map((item) => item.high);
	const minRaw = Math.min(...lows);
	const maxRaw = Math.max(...highs);
	const padding = Math.max(1, (maxRaw - minRaw) * 0.08);
	const minPrice = minRaw - padding;
	const maxPrice = maxRaw + padding;
	const priceRange = Math.max(1, maxPrice - minPrice);
	const maxVolume = Math.max(1, ...view.map((item) => item.volume));

	const xGap = (chartRight - chartLeft) / Math.max(view.length, 1);
	const bodyWidth = Math.max(3, Math.min(10, xGap * 0.56));

	const y = (price: number) =>
		priceBottom -
		((price - minPrice) / priceRange) * (priceBottom - priceTop);

	const last = view[view.length - 1]!;
	const lastY = y(last.close);

	const priceGuides = Array.from({ length: 6 }).map((_, index) => {
		const ratio = index / 5;
		const price = maxPrice - priceRange * ratio;
		return {
			price,
			y: priceTop + (priceBottom - priceTop) * ratio,
		};
	});

	const tickIndexes = Array.from(
		new Set([
			0,
			Math.floor((view.length - 1) * 0.25),
			Math.floor((view.length - 1) * 0.5),
			Math.floor((view.length - 1) * 0.75),
			view.length - 1,
		]),
	);

	return (
		<Box w="100%" overflow="hidden">
			<svg
				width="100%"
				height="350"
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="none"
			>
				<rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />

				{priceGuides.map((guide, index) => (
					<g key={`guide-${index}`}>
						<line
							x1={chartLeft}
							x2={chartRight}
							y1={guide.y}
							y2={guide.y}
							stroke="#EEE9E2"
							strokeWidth="1"
						/>
						<text
							x={chartRight + 12}
							y={guide.y + 4}
							fontSize="10"
							fill="#7A756E"
						>
							{integer.format(Math.round(guide.price))}
						</text>
					</g>
				))}

				{view.map((item, index) => {
					const x = chartLeft + xGap * index + xGap / 2;
					const openY = y(item.open);
					const closeY = y(item.close);
					const highY = y(item.high);
					const lowY = y(item.low);
					const up = item.close >= item.open;
					const color = up ? "#F36A21" : "#386B45";
					const bodyY = Math.min(openY, closeY);
					const bodyH = Math.max(2.4, Math.abs(closeY - openY));
					const volumeH =
						(numberValue(item.volume) / maxVolume) *
						(volumeBottom - volumeTop);

					return (
						<g key={`${item.date}-${index}`}>
							<rect
								x={x - bodyWidth / 2}
								y={volumeBottom - volumeH}
								width={bodyWidth}
								height={volumeH}
								fill="#C9C9C9"
								opacity="0.65"
							/>
							<line
								x1={x}
								x2={x}
								y1={highY}
								y2={lowY}
								stroke={color}
								strokeWidth="1.5"
							/>
							<rect
								x={x - bodyWidth / 2}
								y={bodyY}
								width={bodyWidth}
								height={bodyH}
								fill={color}
							/>
						</g>
					);
				})}

				<line
					x1={chartLeft}
					x2={chartRight}
					y1={lastY}
					y2={lastY}
					stroke={UI.orange}
					strokeDasharray="4 3"
					strokeWidth="1"
					opacity="0.75"
				/>

				<rect
					x={chartRight + 3}
					y={Math.max(priceTop, Math.min(priceBottom - 21, lastY - 10))}
					width="76"
					height="21"
					rx="6"
					fill={UI.orange}
				/>
				<text
					x={chartRight + 41}
					y={Math.max(priceTop + 14, Math.min(priceBottom - 7, lastY + 4))}
					fontSize="10"
					textAnchor="middle"
					fill="#FFFFFF"
					fontWeight="700"
				>
					{integer.format(Math.round(last.close))}
				</text>

				<line
					x1={chartLeft}
					x2={chartRight}
					y1={volumeBottom}
					y2={volumeBottom}
					stroke="#8E8A84"
					strokeWidth="1"
				/>

				{tickIndexes.map((index) => {
					const item = view[index];
					if (!item) return null;
					const x = chartLeft + xGap * index + xGap / 2;

					return (
						<text
							key={`date-${index}`}
							x={x}
							y={347}
							fontSize="9"
							textAnchor="middle"
							fill="#7A756E"
						>
							{formatChartDate(item.date, range)}
						</text>
					);
				})}
			</svg>
		</Box>
	);
}

/* ============================================================================
 * Chart / order history panel
 * ========================================================================== */

function orderStatus(status?: string): { label: string; color: string } {
	if (status === "FILLED") return { label: "체결완료", color: "#2F855A" };
	if (status === "PARTIALLY_FILLED") {
		return { label: "부분체결", color: UI.orange };
	}
	if (status === "CANCELLED") return { label: "미체결", color: UI.muted };
	return { label: status || "처리완료", color: UI.subtle };
}

function OrderHistory({ orders }: { orders: OrderRecord[] }) {
	if (!orders.length) {
		return (
			<EmptyData
				title="주문 내역이 없습니다"
				description="이 종목을 매수하거나 매도하면 주문 결과가 표시됩니다."
			/>
		);
	}

	return (
		<Box px="14px" py="13px" minH="365px" overflowX="auto">
			<Box minW="650px">
				<Grid
					templateColumns="76px 48px 58px 112px minmax(88px, 1fr) 70px"
					gap="8px"
					px="8px"
					pb="9px"
					borderBottom="1px solid"
					borderColor={UI.border}
				>
					{["시간", "구분", "유형", "주문/체결", "체결가", "상태"].map(
						(label) => (
							<Text
								key={label}
								fontSize="9px"
								color={UI.muted}
								textAlign="right"
							>
								{label}
							</Text>
						),
					)}
				</Grid>

				<Stack spacing="0" maxH="326px" overflowY="auto">
					{orders.map((order, index) => {
						const status = orderStatus(order.status);
						const requested = order.requested_quantity ?? order.quantity;
						const filled = order.filled_quantity ?? order.quantity;
						const executionPrice =
							order.average_execution_price ?? order.execution_price;

						return (
							<Grid
								key={order.order_id ?? `${order.created_at}-${index}`}
								templateColumns="76px 48px 58px 112px minmax(88px, 1fr) 70px"
								gap="8px"
								alignItems="center"
								px="8px"
								py="10px"
								borderBottom="1px solid #F3EEE8"
							>
								<Text fontSize="10px" color={UI.subtle} textAlign="right">
									{formatTime(order.created_at)}
								</Text>
								<Text
									fontSize="10px"
									fontWeight="900"
									color={order.side === "BUY" ? UI.red : UI.blue}
									textAlign="right"
								>
									{order.side === "BUY" ? "매수" : "매도"}
								</Text>
								<Text fontSize="10px" color={UI.subtle} textAlign="right">
									{order.order_type === "LIMIT" ? "지정가" : "시장가"}
								</Text>
								<Text fontSize="10px" fontWeight="800" textAlign="right">
									{integer.format(requested)}주 / {integer.format(filled)}주
								</Text>
								<Text fontSize="11px" fontWeight="800" textAlign="right">
									{formatPrice(executionPrice)}
								</Text>
								<Text
									fontSize="10px"
									fontWeight="800"
									color={status.color}
									textAlign="right"
								>
									{status.label}
								</Text>
							</Grid>
						);
					})}
				</Stack>
			</Box>
		</Box>
	);
}

function ChartPanel({
	chart,
	isLoading,
	orders,
	activeTab,
	onTabChange,
	range,
	onRangeChange,
}: {
	chart: ChartResponse | null;
	isLoading: boolean;
	orders: OrderRecord[];
	activeTab: DataTab;
	onTabChange: (tab: DataTab) => void;
	range: ChartRange;
	onRangeChange: (range: ChartRange) => void;
}) {
	const tabs: Array<{ key: DataTab; label: string }> = [
		{ key: "CHART", label: "가격 차트" },
		{ key: "TRADES", label: "주문 내역" },
	];

	const ranges: Array<{ key: ChartRange; label: string }> = [
		{ key: "DAY", label: "일봉" },
		{ key: "WEEK", label: "주봉" },
		{ key: "MONTH", label: "월봉" },
	];
	const rangeDescription: Record<ChartRange, string> = {
		DAY: "최근 30거래일",
		WEEK: "최근 13주",
		MONTH: "최근 12개월",
	};

	return (
		<Panel overflow="hidden">
			<HStack
				h="42px"
				px="14px"
				spacing="32px"
				borderBottom="1px solid"
				borderColor={UI.border}
			>
				{tabs.map((tab) => (
					<Button
						key={tab.key}
						size="sm"
						variant="ghost"
						h="42px"
						px="0"
						borderRadius="0"
						color={activeTab === tab.key ? UI.text : UI.subtle}
						fontWeight={activeTab === tab.key ? "800" : "500"}
						borderBottom={
							activeTab === tab.key ? `2px solid ${UI.orange}` : "2px solid transparent"
						}
						_hover={{ bg: "transparent", color: UI.orange }}
						onClick={() => onTabChange(tab.key)}
					>
						{tab.label}
					</Button>
				))}
			</HStack>

			{activeTab === "CHART" ? (
				<Box px="12px" pt="14px" pb="8px">
					<Flex
						justify="space-between"
						align="center"
						gap="8px"
						mb="7px"
						pr={{ base: "0", md: "36px" }}
					>
						<Text fontSize="10px" color={UI.muted}>
							{rangeDescription[range]}
						</Text>
						<HStack spacing="4px">
							{ranges.map((item) => (
								<Button
									key={item.key}
									size="xs"
									minW="42px"
									h="25px"
									px="8px"
									bg={range === item.key ? "#E6E3DF" : "transparent"}
									color={range === item.key ? UI.text : UI.subtle}
									_hover={{ bg: "#EFECE7" }}
									onClick={() => onRangeChange(item.key)}
								>
									{item.label}
								</Button>
							))}
						</HStack>
					</Flex>

					<CandlestickChart
						candles={chart?.candles ?? []}
						range={range}
						isLoading={isLoading}
					/>
				</Box>
			) : (
				<OrderHistory orders={orders} />
			)}
		</Panel>
	);
}

/* ============================================================================
 * Asset list / portfolio list
 * ========================================================================== */

function AssetList({
	assets,
	selectedAssetId,
	onSelect,
	search,
	onSearchChange,
	hasPositions,
}: {
	assets: AssetSummary[];
	selectedAssetId: string;
	onSelect: (assetId: string) => void;
	search: string;
	onSearchChange: (value: string) => void;
	hasPositions: boolean;
}) {
	const filtered = useMemo(() => {
		const keyword = search.trim().toLowerCase();

		if (!keyword) return assets;

		return assets.filter(
			(item) =>
				item.name.toLowerCase().includes(keyword) ||
				item.asset_id.toLowerCase().includes(keyword),
		);
	}, [assets, search]);

	return (
		<Panel overflow="hidden">
			<Box px="15px" pt="15px" pb="10px">
				<Heading fontSize="15px" letterSpacing="-0.02em">
					매매 가능 종목 ({assets.length})
				</Heading>
				<InputGroup size="sm" mt="11px">
					<InputLeftElement pointerEvents="none">
						<FiSearch color={UI.muted} />
					</InputLeftElement>
					<Input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="종목명 검색"
						borderColor={UI.border}
						borderRadius="8px"
						_focusVisible={{
							borderColor: UI.orange,
							boxShadow: `0 0 0 1px ${UI.orange}`,
						}}
					/>
				</InputGroup>
			</Box>

			<Grid
				templateColumns="30px minmax(78px,1fr) 68px 58px"
				px="10px"
				py="7px"
				fontSize="9px"
				color={UI.muted}
				borderBottom="1px solid"
				borderColor={UI.border}
			>
				<Text textAlign="center">순위</Text>
				<Text>종목명</Text>
				<Text textAlign="right">현재가</Text>
				<Text textAlign="right">등락률</Text>
			</Grid>

			<Box
				maxH={hasPositions ? "372px" : "590px"}
				overflowY="auto"
				sx={{
					"&::-webkit-scrollbar": { width: "6px" },
					"&::-webkit-scrollbar-thumb": {
						background: "#D7CEC5",
						borderRadius: "20px",
					},
				}}
			>
				{filtered.map((asset, index) => {
					const selected = selectedAssetId === asset.asset_id;
					const change = numberValue(asset.change_pct);

					return (
						<Grid
							key={asset.asset_id}
							templateColumns="30px minmax(78px,1fr) 68px 58px"
							alignItems="center"
							px="10px"
							minH="34px"
							fontSize="10px"
							cursor="pointer"
							bg={selected ? "#FFF8F3" : "#FFFFFF"}
							borderBottom="1px solid #F2ECE5"
							boxShadow={
								selected ? `inset 0 0 0 1px ${UI.orange}` : "none"
							}
							_hover={{ bg: "#FFF8F3" }}
							onClick={() => onSelect(asset.asset_id)}
						>
							<Text textAlign="center" color={UI.subtle}>
								{index + 1}
							</Text>
							<Text fontWeight={selected ? "800" : "600"} noOfLines={1}>
								{asset.name}
							</Text>
							<Text textAlign="right" fontWeight="600">
								{formatPrice(asset.current_price)}
							</Text>
							<Text
								textAlign="right"
								fontWeight="800"
								color={change > 0 ? UI.red : change < 0 ? UI.blue : UI.subtle}
							>
								{formatPct(asset.change_pct)}
							</Text>
						</Grid>
					);
				})}

				{filtered.length === 0 && (
					<Flex minH="120px" align="center" justify="center">
						<Text fontSize="12px" color={UI.muted}>
							검색 결과가 없습니다.
						</Text>
					</Flex>
				)}
			</Box>
		</Panel>
	);
}

function HoldingsPanel({ portfolio }: { portfolio: PortfolioState }) {
	const positions = portfolio.positions ?? [];

	if (!positions.length) return null;

	return (
		<Panel
			mt="12px"
			px="10px"
			py="12px"
			overflow="hidden"
			minW="0"
			maxW="100%"
		>
			<Heading fontSize="13px" whiteSpace="nowrap">
				내 보유 종목{" "}
				<Text as="span" fontSize="9px" color={UI.subtle} fontWeight="500">
					(현재 포트폴리오)
				</Text>
			</Heading>

			<Grid
				mt="12px"
				templateColumns="minmax(0,1fr) 26px 46px 46px 42px"
				fontSize="8px"
				color={UI.muted}
				columnGap="2px"
				alignItems="center"
				w="100%"
				minW="0"
			>
				<Text minW="0" noOfLines={1}>종목명</Text>
				<Text textAlign="right">수량</Text>
				<Text textAlign="right">평균가</Text>
				<Text textAlign="right">현재가</Text>
				<Text textAlign="right">손익</Text>
			</Grid>

			<Box
				mt="7px"
				maxH="150px"
				overflowY="auto"
				overflowX="hidden"
				pr="2px"
				sx={{
					"&::-webkit-scrollbar": { width: "4px" },
					"&::-webkit-scrollbar-thumb": {
						background: "#D7CEC5",
						borderRadius: "20px",
					},
				}}
			>
				<Stack spacing="7px">
					{positions.map((position) => {
						const pnl = numberValue(position.unrealized_pnl);

						return (
							<Grid
								key={position.asset_id}
								templateColumns="minmax(0,1fr) 26px 46px 46px 42px"
								fontSize="8px"
								columnGap="2px"
								alignItems="center"
								w="100%"
								minW="0"
							>
								<Text
									fontWeight="700"
									minW="0"
									noOfLines={1}
									title={position.name}
								>
									{position.name}
								</Text>

								<Text
									textAlign="right"
									whiteSpace="nowrap"
									overflow="hidden"
								>
									{position.quantity}주
								</Text>

								<Text
									textAlign="right"
									whiteSpace="nowrap"
									overflow="hidden"
									title={formatPrice(position.avg_price)}
								>
									{formatPrice(position.avg_price)}
								</Text>

								<Text
									textAlign="right"
									whiteSpace="nowrap"
									overflow="hidden"
									title={formatPrice(position.current_price)}
								>
									{formatPrice(position.current_price)}
								</Text>

								<Text
									textAlign="right"
									fontWeight="800"
									whiteSpace="nowrap"
									overflow="hidden"
									color={pnl > 0 ? UI.red : pnl < 0 ? UI.blue : UI.subtle}
									title={formatSignedWon(pnl)}
								>
									{formatSignedWon(pnl)}
								</Text>
							</Grid>
						);
					})}
				</Stack>
			</Box>
		</Panel>
	);
}

/* ============================================================================
 * Market / news cards
 * ========================================================================== */

function MarketInfoPanel({
	market,
	turn,
}: {
	market?: MarketState | null;
	turn?: TurnMeta;
}) {
	const metrics = [
		...(market?.indices ?? []),
		...(market?.indicators ?? []),
	].slice(0, 4);

	return (
		<Panel minH="228px" px="14px" py="14px">
			<Heading fontSize="14px">시장 정보</Heading>
			<Text mt="5px" fontSize="10px" color={UI.muted}>
				거래소의 호가창 대신 당시 시장 맥락을 제공합니다.
			</Text>

			<Stack mt="15px" spacing="11px">
				{turn?.phase && (
					<Flex justify="space-between" gap="14px">
						<Text fontSize="10px" color={UI.muted}>
							시장 국면
						</Text>
						<Text fontSize="10px" fontWeight="800" textAlign="right">
							{turn.phase}
						</Text>
					</Flex>
				)}

				{market?.sentiment && (
					<Flex justify="space-between" gap="14px">
						<Text fontSize="10px" color={UI.muted}>
							시장 심리
						</Text>
						<Text fontSize="10px" fontWeight="800" textAlign="right">
							{market.sentiment}
							{market.sentiment_score != null
								? ` · ${market.sentiment_score}/100`
								: ""}
						</Text>
					</Flex>
				)}

				{market?.sector_state && (
					<Flex justify="space-between" gap="14px">
						<Text fontSize="10px" color={UI.muted}>
							섹터 상태
						</Text>
						<Text fontSize="10px" fontWeight="800" textAlign="right">
							{market.sector_state}
						</Text>
					</Flex>
				)}

				{metrics.map((metric, index) => (
					<Flex key={`${metric.code ?? metric.name}-${index}`} justify="space-between">
						<Text fontSize="10px" color={UI.muted}>
							{metric.name ?? metric.code ?? "지표"}
						</Text>
						<Text fontSize="10px" fontWeight="800">
							{metric.value ?? "-"} {metric.unit ?? ""}
							{metric.change_pct != null
								? ` (${formatPct(metric.change_pct)})`
								: ""}
						</Text>
					</Flex>
				))}

				{(market?.risk_factors?.length ?? 0) > 0 && (
					<Box pt="9px" borderTop="1px solid #EFE8E0">
						<Text fontSize="10px" fontWeight="800">
							주의할 위험
						</Text>
						{market!.risk_factors!.slice(0, 3).map((risk) => (
							<Flex key={risk} gap="7px" mt="6px" align="flex-start">
								<Box
									mt="5px"
									w="4px"
									h="4px"
									borderRadius="full"
									bg={UI.orange}
									flexShrink={0}
								/>
								<Text fontSize="10px" lineHeight="1.45" color={UI.subtle}>
									{risk}
								</Text>
							</Flex>
						))}
					</Box>
				)}
			</Stack>
		</Panel>
	);
}

function openNewsSource(sourceUrl?: string) {
	const normalizedUrl = sourceUrl?.trim();
	if (!normalizedUrl) return;

	try {
		const parsedUrl = new URL(normalizedUrl);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
			return;
		}

		window.open(parsedUrl.toString(), "_blank", "noopener,noreferrer");
	} catch (error) {
		console.warn("뉴스 원문 URL이 올바르지 않습니다:", sourceUrl, error);
	}
}

function NewsPanel({ news }: { news: NewsItem[] }) {
	return (
		<Panel minH="228px" px="14px" py="14px">
			<Heading fontSize="14px">뉴스 및 이벤트</Heading>
			<Text mt="5px" fontSize="10px" color={UI.muted}>
				판단 시점에 제공되는 핵심 정보를 제공합니다.
			</Text>

			<Box
				mt="11px"
				maxH="174px"
				overflowY="auto"
				pr="4px"
				sx={{
					"&::-webkit-scrollbar": { width: "5px" },
					"&::-webkit-scrollbar-thumb": {
						background: "#D7CEC5",
						borderRadius: "20px",
					},
				}}
			>
				{news.length ? (
					<Stack spacing="9px">
						{news.map((item) => (
							<Box
								key={item.news_id}
								px="4px"
								pb="9px"
								borderBottom="1px solid #EFE8E0"
								borderRadius="4px"
								role={item.source_url ? "link" : undefined}
								tabIndex={item.source_url ? 0 : undefined}
								aria-label={item.source_url ? `${item.title} 원문 열기` : undefined}
								cursor={item.source_url ? "pointer" : "default"}
								onClick={() => openNewsSource(item.source_url)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										openNewsSource(item.source_url);
									}
								}}
								_hover={item.source_url ? { bg: "#FFF8F2" } : undefined}
								_focusVisible={
									item.source_url
										? { outline: `2px solid ${UI.orange}` }
										: undefined
								}
							>
								<Flex align="center" gap="8px">
									<Text
										fontSize="9px"
										fontWeight="800"
										color={UI.orange}
										noOfLines={1}
									>
										{item.source_name ?? "뉴스"}
									</Text>
									<Text fontSize="9px" color={UI.muted}>
										{formatDate(item.published_at)}
									</Text>
									{item.source_url && (
										<Box as={FiExternalLink} ml="auto" color={UI.muted} />
									)}
								</Flex>
								<Text mt="4px" fontSize="11px" fontWeight="800" noOfLines={2}>
									{item.title}
								</Text>
								{item.summary && (
									<Text
										mt="3px"
										fontSize="9px"
										lineHeight="1.45"
										color={UI.subtle}
										noOfLines={2}
									>
										{item.summary}
									</Text>
								)}
							</Box>
						))}
					</Stack>
				) : (
					<Flex minH="130px" align="center" justify="center">
						<Text fontSize="11px" color={UI.muted}>
							현재 턴에 제공되는 뉴스가 없습니다.
						</Text>
					</Flex>
				)}
			</Box>
		</Panel>
	);
}

/* ============================================================================
 * Order card
 * ========================================================================== */

function OrderPanel({
	asset,
	portfolio,
	side,
	onSideChange,
	quantity,
	onQuantityChange,
	onOrder,
	isOrdering,
}: {
	asset: AssetSummary | null;
	portfolio?: PortfolioState;
	side: OrderSide;
	onSideChange: (side: OrderSide) => void;
	quantity: number;
	onQuantityChange: (quantity: number) => void;
	onOrder: () => void;
	isOrdering: boolean;
}) {
	const price = numberValue(asset?.current_price);
	const holdingQty = asset
		? currentHoldingQuantity(portfolio, asset.asset_id)
		: 0;

	const maxQuantity =
		side === "BUY"
			? price > 0
				? Math.max(0, Math.floor(numberValue(portfolio?.cash) / price))
				: 0
			: holdingQty;

	const expectedAmount = price * Math.max(0, quantity);

	const quickSet = (value: number | "MAX") => {
		const next = value === "MAX" ? maxQuantity : value;
		onQuantityChange(Math.max(0, Math.min(next, maxQuantity || next)));
	};

	return (
		<Panel px="14px" py="14px">
			<Heading fontSize="15px">주문</Heading>
			<Text mt="4px" fontSize="10px" color={UI.muted}>
				거래할 종목을 선택하고 주문을 입력
			</Text>

			<Panel mt="14px" px="12px" py="13px" bg={UI.surface}>
				{asset ? (
					<>
						<Flex align="baseline" gap="7px">
							<Text fontSize="12px" fontWeight="800">
								{asset.name}
							</Text>
							<Text fontSize="10px" color={UI.subtle}>
								{asset.asset_id}
							</Text>
						</Flex>

						<Flex mt="7px" align="center" gap="12px">
							<Text fontSize="17px" fontWeight="900">
								{formatPrice(asset.current_price)}
							</Text>
							<PriceChange value={asset.change_pct} />
						</Flex>

						<Text mt="8px" fontSize="9px" color={UI.subtle}>
							{asset.industry_label || asset.market || "종목 정보"}
						</Text>
					</>
				) : (
					<Text fontSize="11px" color={UI.muted}>
						종목을 선택하세요.
					</Text>
				)}
			</Panel>

			<SimpleGrid mt="14px" columns={2} spacing="7px">
				<Button
					h="36px"
					fontSize="11px"
					border="1px solid"
					borderColor={side === "BUY" ? UI.orange : UI.border}
					bg={side === "BUY" ? "#FFF7F2" : "#FFFFFF"}
					color={side === "BUY" ? UI.orange : UI.text}
					_hover={{ bg: "#FFF2EA" }}
					onClick={() => onSideChange("BUY")}
				>
					매수
				</Button>
				<Button
					h="36px"
					fontSize="11px"
					border="1px solid"
					borderColor={side === "SELL" ? UI.orange : UI.border}
					bg={side === "SELL" ? "#FFF7F2" : "#FFFFFF"}
					color={side === "SELL" ? UI.orange : UI.text}
					_hover={{ bg: "#FFF2EA" }}
					onClick={() => onSideChange("SELL")}
				>
					매도
				</Button>
			</SimpleGrid>

			<Text mt="19px" fontSize="11px" color={UI.subtle}>
				주문 수량
			</Text>

			<Flex
				mt="8px"
				h="34px"
				align="center"
				justify="center"
				border="1px solid"
				borderColor={UI.border}
				borderRadius="8px"
				overflow="hidden"
			>
				<Input
					type="number"
					min={1}
					value={quantity || ""}
					onChange={(event) =>
						onQuantityChange(
							Math.max(0, Math.floor(numberValue(event.target.value))),
						)
					}
					placeholder="0"
					textAlign="center"
					fontWeight="800"
					fontSize="11px"
					border="0"
					_focusVisible={{ boxShadow: "none" }}
				/>
				<Text pr="12px" fontSize="10px" fontWeight="800">
					주
				</Text>
			</Flex>

			<SimpleGrid mt="7px" columns={4} spacing="7px">
				{[
					{ label: "10주", value: 10 },
					{ label: "50주", value: 50 },
					{ label: "100주", value: 100 },
					{ label: "최대", value: "MAX" as const },
				].map((item) => (
					<Button
						key={item.label}
						size="xs"
						h="31px"
						fontSize="9px"
						variant="outline"
						borderColor={UI.border}
						color={UI.subtle}
						_hover={{ borderColor: UI.orange, color: UI.orange }}
						onClick={() => quickSet(item.value)}
					>
						{item.label}
					</Button>
				))}
			</SimpleGrid>

			<Flex mt="23px" justify="space-between" align="center">
				<Text fontSize="11px" color={UI.subtle}>
					예상 금액
				</Text>
				<Text fontSize="15px" fontWeight="900">
					{formatWon(expectedAmount)}
				</Text>
			</Flex>

			<Text mt="8px" fontSize="9px" color={UI.muted} textAlign="right">
				{side === "BUY"
					? `주문 가능 ${integer.format(maxQuantity)}주 · 보유 현금 ${formatWon(
						portfolio?.cash,
					)}`
					: `매도 가능 ${integer.format(holdingQty)}주`}
			</Text>

			<Button
				mt="48px"
				w="100%"
				h="42px"
				bg={UI.orange}
				color="white"
				fontSize="13px"
				fontWeight="800"
				_hover={{ bg: UI.orangeDark }}
				isLoading={isOrdering}
				loadingText="주문 처리 중"
				isDisabled={
					!asset ||
					!asset.data_available ||
					quantity <= 0 ||
					quantity > maxQuantity
				}
				onClick={onOrder}
			>
				주문하기
			</Button>

			<Panel mt="42px" px="11px" py="11px" bg={UI.surface}>
				<Flex gap="8px" align="flex-start">
					<Box mt="2px" color={UI.orange}>
						<FiCheckCircle size={14} />
					</Box>
					<Text fontSize="9px" lineHeight="1.6" color={UI.subtle}>
						주문 확정 후 변경할 수 없으며,
						<br />
						다음 단계에서 근거 입력이 진행됩니다.
					</Text>
				</Flex>
			</Panel>
		</Panel>
	);
}

/* ============================================================================
 * Scenario mini info card
 * ========================================================================== */

function ScenarioMiniInfo({
	progress,
}: {
	progress?: ScenarioProgress;
}) {
	const current = progress?.current_turn ?? 0;
	const total = progress?.total_turns ?? 0;
	const remaining = Math.max(0, total - current);
	const delta = daysBetween(progress?.market_date, progress?.next_market_date);

	return (
		<Panel px="14px" py="14px">
			<Heading fontSize="14px">시나리오 정보</Heading>

			<Stack mt="15px" spacing="12px">
				<Flex justify="space-between" gap="12px">
					<Text fontSize="10px" color={UI.subtle}>
						현재 시점
					</Text>
					<Text fontSize="10px">{formatDate(progress?.market_date)}</Text>
				</Flex>

				<Flex justify="space-between" gap="12px">
					<Text fontSize="10px" color={UI.subtle}>
						다음 시점
					</Text>
					<Text fontSize="10px" textAlign="right">
						{progress?.next_market_date
							? `${formatDate(progress.next_market_date)}${delta != null ? ` (약 ${delta}일 후)` : ""
							}`
							: "최종 평가"}
					</Text>
				</Flex>

				<Flex justify="space-between" gap="12px">
					<Text fontSize="10px" color={UI.subtle}>
						남은 TURN
					</Text>
					<Text fontSize="10px">
						{remaining} / {total}
					</Text>
				</Flex>
			</Stack>
		</Panel>
	);
}

/* ============================================================================
 * Modals
 * ========================================================================== */



function ScenarioInfoModal({
	isOpen,
	onClose,
	scenario,
	progress,
	portfolio,
}: {
	isOpen: boolean;
	onClose: () => void;
	scenario?: ScenarioMeta;
	progress?: ScenarioProgress;
	portfolio?: PortfolioState;
}) {
	const initialValue =
		numberValue(portfolio?.total_value) - numberValue(portfolio?.profit_loss);

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
			<ModalOverlay bg="rgba(35, 31, 27, 0.42)" />
			<ModalContent
				bg={UI.surface}
				borderRadius="10px"
				maxW="520px"
				maxH="92vh"
				overflowY="auto"
				boxShadow="0 18px 48px rgba(0,0,0,0.18)"
			>
				<ModalCloseButton top="13px" right="13px" />

				<ModalBody px="24px" pt="24px" pb="0">
					<Text
						display="inline-block"
						fontSize="9px"
						fontWeight="800"
						color={UI.orange}
						bg={UI.orangeSoft}
						px="8px"
						py="4px"
						borderRadius="6px"
					>
						선택한 시나리오
					</Text>

					<Heading mt="17px" fontSize="24px" letterSpacing="-0.04em">
						{scenario?.title ?? "시나리오"}
					</Heading>

					<Text mt="15px" fontSize="12px" lineHeight="1.75" color={UI.subtle}>
						{scenario?.description ??
							"과거 시장의 실제 데이터와 이벤트를 바탕으로 투자 판단을 진행합니다."}
					</Text>

					<Panel mt="22px" px="15px" py="15px" bg="#FFFCF8">
						<SimpleGrid columns={{ base: 1, md: 2 }} spacing="0">
							<Box pr={{ base: 0, md: "20px" }}>
								<Heading fontSize="13px">시나리오 개요</Heading>
								<Text mt="11px" fontSize="10px" lineHeight="1.75" color={UI.subtle}>
									{scenario?.description}
								</Text>
							</Box>

							<Box
								mt={{ base: "14px", md: 0 }}
								pl={{ base: 0, md: "20px" }}
								borderLeft={{ base: "0", md: "1px solid #EAD9C7" }}
							>
								<Stack spacing="13px">
									<Flex justify="space-between" gap="15px">
										<Text fontSize="9px" color={UI.muted}>
											현재 날짜
										</Text>
										<Text fontSize="9px">{formatDate(progress?.market_date)}</Text>
									</Flex>
									<Flex justify="space-between" gap="15px">
										<Text fontSize="9px" color={UI.muted}>
											최종 평가일
										</Text>
										<Text fontSize="9px">
											{formatDate(progress?.final_valuation_date)}
										</Text>
									</Flex>
									<Flex justify="space-between" gap="15px">
										<Text fontSize="9px" color={UI.muted}>
											총 TURN
										</Text>
										<Text fontSize="9px">
											{progress?.total_turns ?? "-"} TURN
										</Text>
									</Flex>
									<Flex justify="space-between" gap="15px">
										<Text fontSize="9px" color={UI.muted}>
											초기 자산
										</Text>
										<Text fontSize="9px" color={UI.orange} fontWeight="800">
											{initialValue > 0 ? formatWon(initialValue) : "-"}
										</Text>
									</Flex>
									<Flex justify="space-between" gap="15px">
										<Text fontSize="9px" color={UI.muted}>
											난이도
										</Text>
										<Text fontSize="9px">{difficultyLabel(scenario?.difficulty)}</Text>
									</Flex>
								</Stack>
							</Box>
						</SimpleGrid>
					</Panel>

					<Panel mt="13px" px="15px" py="14px" bg="#FFFCF8">
						<Heading fontSize="13px">시나리오 진행 방식</Heading>

						<Stack mt="12px" spacing="12px">
							{[
								["1. 투자 판단", "제공된 시장 정보를 바탕으로 매수·매도·관망을 결정합니다."],
								["2. 근거 입력", "현재 TURN의 질문에 답하고 판단 근거를 입력합니다."],
								["3. AI 분석 및 결과", "서버 채점 결과를 누적해 최종 판단 리포트를 생성합니다."],
								[
									"4. 시간 이동",
									"TURN 종료 후 다음 실제 과거 시점으로 이동하며, 보유 종목은 그대로 유지됩니다.",
								],
							].map(([title, body]) => (
								<Box key={title}>
									<Text fontSize="10px" fontWeight="800">
										{title}
									</Text>
									<Text mt="3px" pl="10px" fontSize="9px" color={UI.subtle}>
										{body}
									</Text>
								</Box>
							))}
						</Stack>
					</Panel>

					<Panel mt="13px" px="15px" py="13px" bg="#FFFCF8">
						<Heading fontSize="12px">주의사항</Heading>
						<Stack mt="8px" spacing="5px">
							<Text fontSize="9px" color={UI.subtle}>
								• 각 판단은 이전 턴의 결과에 영향을 받습니다.
							</Text>
							<Text fontSize="9px" color={UI.subtle}>
								• 주문 확정 후에는 변경할 수 없으며, 다음 단계에서 근거 입력이 진행됩니다.
							</Text>
							<Text fontSize="9px" color={UI.subtle}>
								• 실제 과거 시장 데이터를 기반으로 재구성된 학습용 시나리오입니다.
							</Text>
						</Stack>
					</Panel>
				</ModalBody>

				<ModalFooter px="24px" pt="16px" pb="20px">
					<Button
						w="100%"
						h="42px"
						bg={UI.orange}
						color="white"
						fontSize="14px"
						fontWeight="800"
						_hover={{ bg: UI.orangeDark }}
						onClick={onClose}
					>
						시나리오 계속하기
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

function TurnDecisionModal({
	isOpen,
	onClose,
	questions,
	answers,
	onAnswersChange,
	onSubmit,
	isSubmitting,
	progress,
	recentOrder,
	recentOrderAssetName,
}: {
	isOpen: boolean;
	onClose: () => void;
	questions: QuestionItem[];
	answers: Record<string, AnswerValue>;
	onAnswersChange: (answers: Record<string, AnswerValue>) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	progress?: ScenarioProgress;
	recentOrder?: OrderRecord | null;
	recentOrderAssetName?: string;
}) {
	const updateText = (questionId: string, value: string) => {
		onAnswersChange({
			...answers,
			[questionId]: {
				selected: answers[questionId]?.selected ?? [],
				text: value,
			},
		});
	};

	const selectSingle = (questionId: string, value: string) => {
		onAnswersChange({
			...answers,
			[questionId]: {
				selected: [value],
				text: answers[questionId]?.text ?? "",
			},
		});
	};

	const toggleMulti = (question: QuestionItem, value: string) => {
		const current = answers[question.question_id]?.selected ?? [];
		const included = current.includes(value);

		let next = included
			? current.filter((item) => item !== value)
			: [...current, value];

		if (
			!included &&
			question.max_select &&
			next.length > question.max_select
		) {
			next = next.slice(next.length - question.max_select);
		}

		onAnswersChange({
			...answers,
			[question.question_id]: {
				selected: next,
				text: answers[question.question_id]?.text ?? "",
			},
		});
	};

	const choiceQuestions = questions.filter(
		(question) => question.type !== "free",
	);
	const freeQuestions = questions.filter(
		(question) => question.type === "free",
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={isSubmitting ? () => undefined : onClose}
			isCentered
			size="3xl"
		>
			<ModalOverlay bg="rgba(35, 31, 27, 0.47)" />
			<ModalContent
				bg={UI.surface}
				borderRadius="9px"
				maxW={{ base: "94vw", md: "780px" }}
				h={{ base: "92vh", md: "90vh" }}
				maxH="920px"
				overflow="hidden"
				display="flex"
				flexDirection="column"
				boxShadow="0 18px 48px rgba(0,0,0,0.18)"
			>
				<ModalHeader px={{ base: "20px", md: "28px" }} pt="24px" pb="16px" flexShrink={0}>
					<Flex justify="space-between" align="flex-start" pr="27px">
						<Box>
							<Heading
								fontSize={{ base: "22px", md: "25px" }}
								letterSpacing="-0.035em"
								lineHeight="1.25"
							>
								TURN {progress?.current_turn ?? "-"} 종료 · 근거 입력
							</Heading>

							<Text
								mt="7px"
								fontSize={{ base: "13px", md: "14px" }}
								color={UI.subtle}
								fontWeight="500"
							>
								이번 TURN에 판단한 선택과 근거를 입력해주세요.
							</Text>
						</Box>

						<Text
							fontSize="10px"
							color={UI.muted}
							whiteSpace="nowrap"
							pt="3px"
						>
							{questions.length}개 문항
						</Text>
					</Flex>
				</ModalHeader>

				<ModalCloseButton
					top="13px"
					right="12px"
					isDisabled={isSubmitting}
				/>

				<ModalBody
					px={{ base: "20px", md: "28px" }}
					pb="18px"
					flex="1"
					minH="0"
					overflowY="auto"
					overflowX="hidden"
					sx={{
						"&::-webkit-scrollbar": { width: "8px" },
						"&::-webkit-scrollbar-thumb": {
							background: "#D7CEC5",
							borderRadius: "20px",
						},
					}}
				>
					{/* 이번 TURN의 최근 매매 요약 */}
					<Box mb="15px">
						<Text fontSize="11px" fontWeight="800" mb="9px">
							선택한 행동 요약
						</Text>

						<Panel
							px="16px"
							py="12px"
							bg="#FFFCF8"
							borderRadius="7px"
						>
							{recentOrder ? (
								<Grid
									templateColumns="minmax(0,1.25fr) 72px 64px 96px"
									columnGap="12px"
									alignItems="center"
								>
									<Box minW="0">
										<Text fontSize="10px" color={UI.muted}>
											종목명
										</Text>
										<Text
											mt="3px"
											fontSize="11px"
											fontWeight="800"
											noOfLines={1}
										>
											{recentOrderAssetName || recentOrder.asset_id}
										</Text>
										<Text fontSize="10px" color={UI.muted}>
											{recentOrder.asset_id}
										</Text>
									</Box>

									<Box>
										<Text fontSize="9px" color={UI.muted}>
											주문 유형
										</Text>
										<Text
											mt="3px"
											fontSize="11px"
											fontWeight="800"
											color={
												recentOrder.side === "BUY"
													? UI.red
													: UI.blue
											}
										>
											{recentOrder.side === "BUY" ? "매수" : "매도"}
										</Text>
									</Box>

									<Box>
										<Text fontSize="9px" color={UI.muted}>
											주문 수량
										</Text>
										<Text mt="3px" fontSize="9px" fontWeight="800">
											{recentOrder.quantity}주
										</Text>
									</Box>

									<Box textAlign="right">
										<Text fontSize="7px" color={UI.muted}>
											주문 금액
										</Text>
										<Text mt="3px" fontSize="9px" fontWeight="800">
											{formatWon(recentOrder.amount)}
										</Text>
									</Box>
								</Grid>
							) : (
								<Text
									fontSize="10px"
									color={UI.subtle}
									textAlign="center"
									py="3px"
								>
									이번 TURN에서 체결한 주문이 없습니다.
								</Text>
							)}
						</Panel>
					</Box>

					{/* 선택형 질문 */}
					<Box>
						<Text fontSize="11px" fontWeight="800" mb="8px">
							선택형 행동 요약
						</Text>

						<Panel
							bg="#FFFCF8"
							borderRadius="7px"
							overflow="hidden"
						>
							{choiceQuestions.map((question, index) => {
								const answer = answers[question.question_id] ?? {
									selected: [],
									text: "",
								};

								return (
									<Box
										key={question.question_id}
										px="16px"
										py="14px"
										borderBottom={
											index < choiceQuestions.length - 1
												? "1px solid #EFE4D8"
												: "none"
										}
									>
										<Flex
											align="center"
											justify="space-between"
											gap="10px"
										>
											<Text
												fontSize={{ base: "10px", md: "11px" }}
												fontWeight="800"
												lineHeight="1.45"
												minW="0"
											>
												Q{index + 1}. {question.text}
											</Text>

											<Text
												fontSize="9px"
												color={UI.muted}
												whiteSpace="nowrap"
											>
												{question.type === "multi"
													? `복수 선택${question.max_select
														? ` · 최대 ${question.max_select}개`
														: ""
													}`
													: "단일 선택"}
											</Text>
										</Flex>

										<Flex
											mt="10px"
											gap="8px"
											flexWrap="wrap"
											alignItems="center"
										>
											{(question.options ?? []).map((option) => {
												const selected =
													answer.selected.includes(option);

												return (
													<Button
														key={option}
														h="32px"
														minW="86px"
														px="14px"
														fontSize="11px"
														fontWeight={selected ? "800" : "500"}
														border="1px solid"
														borderColor={
															selected ? UI.orange : "#E6D4C2"
														}
														bg={
															selected ? "#FFF1E8" : "#FFFFFF"
														}
														color={
															selected ? UI.orange : UI.text
														}
														borderRadius="7px"
														_hover={{
															borderColor: UI.orange,
															bg: "#FFF7F2",
														}}
														onClick={() => {
															if (question.type === "single") {
																selectSingle(
																	question.question_id,
																	option,
																);
															} else {
																toggleMulti(question, option);
															}
														}}
													>
														{option}
													</Button>
												);
											})}
										</Flex>
									</Box>
								);
							})}

							{choiceQuestions.length === 0 && (
								<Text
									fontSize="9px"
									color={UI.muted}
									textAlign="center"
									py="14px"
								>
									선택형 질문이 없습니다.
								</Text>
							)}
						</Panel>
					</Box>

					{/* 자유 서술형 근거 입력 */}
					<Box mt="18px">
						<Text fontSize="11px" fontWeight="800" mb="9px">
							근거 입력
						</Text>

						{freeQuestions.map((question) => {
							const answer = answers[question.question_id] ?? {
								selected: [],
								text: "",
							};

							return (
								<Box key={question.question_id} mb="9px">
									<Text
										mb="6px"
										fontSize="10px"
										color={UI.subtle}
									>
										{question.text}
									</Text>

									<Box position="relative">
										<Textarea
											minH="120px"
											maxLength={500}
											resize="none"
											value={answer.text}
											onChange={(event) =>
												updateText(
													question.question_id,
													event.target.value,
												)
											}
											placeholder="매매 판단을 내린 이유와 근거를 구체적으로 작성해주세요."
											fontSize="11px"
											lineHeight="1.7"
											borderColor={UI.border}
											bg="#FFFFFF"
											pb="22px"
											_focusVisible={{
												borderColor: UI.orange,
												boxShadow: `0 0 0 1px ${UI.orange}`,
											}}
										/>

										<Text
											position="absolute"
											right="9px"
											bottom="7px"
											fontSize="9px"
											color={UI.muted}
										>
											{answer.text.length} / 500
										</Text>
									</Box>
								</Box>
							);
						})}

						{freeQuestions.length === 0 && (
							<Text fontSize="8px" color={UI.muted}>
								현재 TURN에는 자유 서술형 질문이 없습니다.
							</Text>
						)}
					</Box>

					<Panel
						mt="11px"
						px="14px"
						py="9px"
						bg="#FFFBF6"
						borderRadius="7px"
					>
						<Text fontSize="10px" fontWeight="800">
							작성 팁
						</Text>
						<Text
							mt="4px"
							fontSize="10px"
							lineHeight="1.7"
							color={UI.subtle}
						>
							• 뉴스, 지표, 기업 실적, 시장 심리 등 판단에 사용한 근거를 구체적으로 작성해주세요.
							<br />
							• 추측보다는 화면에서 확인한 정보와 선택 이유를 중심으로 작성하는 것이 좋습니다.
						</Text>
					</Panel>
				</ModalBody>

				<ModalFooter
					px={{ base: "20px", md: "28px" }}
					py="16px"
					borderTop="1px solid"
					borderColor="#EEE5DB"
					bg={UI.surface}
					flexShrink={0}
					boxShadow="0 -6px 14px rgba(65, 44, 24, 0.04)"
				>
					<Flex w="100%" justify="flex-end" gap="8px">
						<Button
							h="35px"
							px="20px"
							fontSize="11px"
							bg="#E4E1DD"
							color={UI.subtle}
							_hover={{ bg: "#D8D4CF" }}
							isDisabled={isSubmitting}
							onClick={onClose}
						>
							취소
						</Button>

						<Button
							h="35px"
							px="28px"
							fontSize="11px"
							bg={UI.orange}
							color="white"
							fontWeight="800"
							_hover={{ bg: UI.orangeDark }}
							isLoading={isSubmitting}
							loadingText="저장 중"
							isDisabled={!questions.length}
							onClick={onSubmit}
						>
							제출하기
						</Button>
					</Flex>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}





/* ============================================================================
 * Page
 * ========================================================================== */

export default function ScenarioPlay() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const toast = useToast();

	const sessionId = searchParams.get("sessionId") ?? "";

	const scenarioInfoModal = useDisclosure();
	const orderSuccessModal = useDisclosure();
	const decisionModal = useDisclosure();
	const turnFeedbackModal = useDisclosure();
	const finalResultModal = useDisclosure();

	const [turnView, setTurnView] = useState<TurnView | null>(null);
	const [isTurnLoading, setIsTurnLoading] = useState(true);

	const [selectedAssetId, setSelectedAssetId] = useState("");
	const [assetSearch, setAssetSearch] = useState("");

	const [chart, setChart] = useState<ChartResponse | null>(null);
	const [isChartLoading, setIsChartLoading] = useState(false);
	const [chartRange, setChartRange] = useState<ChartRange>("DAY");
	const [dataTab, setDataTab] = useState<DataTab>("CHART");

	const [orderSide, setOrderSide] = useState<OrderSide>("BUY");
	const [quantity, setQuantity] = useState(10);
	const [isOrdering, setIsOrdering] = useState(false);
	const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
	const [lastOrderAssetName, setLastOrderAssetName] = useState("");

	const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
	const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
	const [transitionInfo, setTransitionInfo] = useState<TransitionInfo | null>(
		null,
	);
	const [turnEvaluation, setTurnEvaluation] =
		useState<TurnEvaluation | null>(null);
	const [pendingFinalEvaluation, setPendingFinalEvaluation] =
		useState<FinalEvaluation | null>(null);

	const [finalEvaluation, setFinalEvaluation] =
		useState<FinalEvaluation | null>(null);

	const assets = turnView?.assets ?? [];
	const portfolio = turnView?.portfolio;
	const progress = turnView?.progress;
	const scenario = turnView?.scenario;
	const turn = turnView?.turn;
	const questions = turnView?.questions ?? [];
	const news = turnView?.news ?? [];
	const marketState = turnView?.market_state;

	const selectedAsset = useMemo(
		() =>
			assets.find((item) => item.asset_id === selectedAssetId) ??
			assets[0] ??
			null,
		[assets, selectedAssetId],
	);
	const selectedAssetOrders = useMemo(
		() =>
			(turnView?.orders ?? []).filter(
				(order) => order.asset_id === selectedAsset?.asset_id,
			),
		[selectedAsset?.asset_id, turnView?.orders],
	);

	const initialAnswers = useCallback((items: QuestionItem[]) => {
		const next: Record<string, AnswerValue> = {};

		for (const question of items) {
			next[question.question_id] = {
				selected: [],
				text: "",
			};
		}

		return next;
	}, []);

	const showFinalEvaluation = useCallback(
		(evaluation: FinalEvaluation) => {
			setFinalEvaluation(evaluation);
			finalResultModal.onOpen();
		},
		[finalResultModal],
	);

	const loadResult = useCallback(async () => {
		if (!sessionId) return;

		try {
			const result = (await scenarioService.getResult(
				sessionId,
			)) as FinalEvaluation;

			showFinalEvaluation(result);
		} catch (error) {
			console.error("최종 평가 조회 실패:", error);
		}
	}, [sessionId, showFinalEvaluation]);

	const loadTurn = useCallback(
		async (showSpinner = true) => {
			if (!sessionId) return;

			try {
				if (showSpinner) setIsTurnLoading(true);

				const value = (await scenarioService.getCurrentTurn(
					sessionId,
				)) as TurnView;

				if (value?.result_ready) {
					setTurnView(value);
					await loadResult();
					return;
				}

				if (value?.finalizing) {
					try {
						const finalized = (await scenarioService.finalize(
							sessionId,
						)) as FinalEvaluation;
						showFinalEvaluation(finalized);
					} catch (error) {
						console.error("최종화 재시도 실패:", error);
					}
					return;
				}

				setTurnView(value);

				const availableAssets = value?.assets ?? [];
				const preferred =
					availableAssets.find(
						(item) => item.asset_id === selectedAssetId,
					)?.asset_id ||
					value?.default_asset_id ||
					availableAssets[0]?.asset_id ||
					"";

				setSelectedAssetId(preferred);
				setAnswers(initialAnswers(value?.questions ?? []));
			} catch (error: any) {
				console.error("시나리오 턴 조회 실패:", error);
				toast({
					title: "시나리오를 불러오지 못했습니다.",
					description: errorMessage(
						error,
						"현재 TURN 데이터를 불러오는 중 오류가 발생했습니다.",
					),
					status: "error",
					isClosable: true,
				});
			} finally {
				if (showSpinner) setIsTurnLoading(false);
			}
		},
		[
			initialAnswers,
			loadResult,
			selectedAssetId,
			sessionId,
			showFinalEvaluation,
			toast,
		],
	);

	useEffect(() => {
		if (!sessionId) {
			setIsTurnLoading(false);
			return;
		}

		void loadTurn();
		// 최초 세션 진입 시 한 번만 실행한다.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId]);

	useEffect(() => {
		if (!sessionId || !selectedAssetId) {
			setChart(null);
			return;
		}

		let cancelled = false;

		const load = async () => {
			try {
				setIsChartLoading(true);

				const value = (await scenarioService.getChart(
					sessionId,
					selectedAssetId,
				)) as ChartResponse;

				if (!cancelled) {
					setChart(value);
				}
			} catch (error: any) {
				console.error("차트 조회 실패:", error);

				if (!cancelled) {
					setChart(null);
					toast({
						title: "차트 데이터를 불러오지 못했습니다.",
						description: errorMessage(
							error,
							"해당 종목의 과거 가격 데이터를 확인해주세요.",
						),
						status: "warning",
						isClosable: true,
					});
				}
			} finally {
				if (!cancelled) setIsChartLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [selectedAssetId, sessionId, progress?.current_turn, toast]);

	useEffect(() => {
		if (!selectedAsset) return;

		const max =
			orderSide === "BUY"
				? selectedAsset.current_price
					? Math.floor(
						numberValue(portfolio?.cash) /
						numberValue(selectedAsset.current_price, 1),
					)
					: 0
				: currentHoldingQuantity(portfolio, selectedAsset.asset_id);

		if (max > 0 && quantity > max) {
			setQuantity(max);
		}

		if (max === 0 && orderSide === "SELL") {
			setQuantity(0);
		}
	}, [orderSide, portfolio, quantity, selectedAsset]);

	const handleOrder = async () => {
		if (!sessionId || !selectedAsset) return;

		if (!selectedAsset.data_available || !selectedAsset.current_price) {
			toast({
				title: "주문할 수 없는 종목입니다.",
				description: "현재 시점의 가격 데이터가 없습니다.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		if (!Number.isInteger(quantity) || quantity < 1) {
			toast({
				title: "주문 수량을 확인해주세요.",
				description: "1주 이상의 정수 수량을 입력해야 합니다.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		const max =
			orderSide === "BUY"
				? Math.floor(
					numberValue(portfolio?.cash) /
					numberValue(selectedAsset.current_price, 1),
				)
				: currentHoldingQuantity(portfolio, selectedAsset.asset_id);

		if (quantity > max) {
			toast({
				title:
					orderSide === "BUY"
						? "보유 현금이 부족합니다."
						: "보유 수량이 부족합니다.",
				description: `현재 주문 가능한 최대 수량은 ${integer.format(max)}주입니다.`,
				status: "warning",
				isClosable: true,
			});
			return;
		}

		try {
			setIsOrdering(true);

			const result = (await scenarioService.placeOrder(
				sessionId,
				selectedAsset.asset_id,
				orderSide,
				quantity,
			)) as OrderResponse;

			setLastOrder(result.order);
			setLastOrderAssetName(selectedAsset.name);

			setTurnView((current) =>
				current
					? {
						...current,
						portfolio: result.portfolio,
						orders: [...(current.orders ?? []), result.order],
					}
					: current,
			);

			orderSuccessModal.onOpen();
		} catch (error: any) {
			console.error("주문 실패:", error);

			toast({
				title: "주문을 처리하지 못했습니다.",
				description: errorMessage(error, "주문 처리 중 오류가 발생했습니다."),
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsOrdering(false);
		}
	};

	const validateAnswers = (): string | null => {
		for (const question of questions) {
			const answer = answers[question.question_id] ?? {
				selected: [],
				text: "",
			};

			if (question.type === "free") {
				if (!answer.text.trim()) {
					return `${question.text} 문항의 근거를 입력해주세요.`;
				}
				continue;
			}

			if (!answer.selected.length) {
				return `${question.text} 문항에 답해주세요.`;
			}

			if (question.type === "single" && answer.selected.length !== 1) {
				return `${question.text} 문항은 하나만 선택해주세요.`;
			}

			if (
				question.max_select &&
				answer.selected.length > question.max_select
			) {
				return `${question.text} 문항은 최대 ${question.max_select}개까지 선택할 수 있습니다.`;
			}
		}

		return null;
	};

	const handleSubmitTurn = async () => {
		if (!sessionId || !progress) return;

		const invalid = validateAnswers();

		if (invalid) {
			toast({
				title: "아직 답하지 않은 항목이 있습니다.",
				description: invalid,
				status: "warning",
				isClosable: true,
			});
			return;
		}

		const payload: ScenarioAnswer[] = questions.map((question) => {
			const answer = answers[question.question_id] ?? {
				selected: [],
				text: "",
			};

			return {
				question_id: question.question_id,
				selected: answer.selected,
				text: answer.text.trim(),
			};
		});

		try {
			setIsSubmittingTurn(true);

			const submitted = (await scenarioService.submitTurn(
				sessionId,
				payload,
			)) as TurnSubmitResponse;

			decisionModal.onClose();

			const evaluation = submitted.turn_evaluation ?? null;
			setTurnEvaluation(evaluation);
			setPendingFinalEvaluation(submitted.final_evaluation ?? null);

			if (submitted.next_turn) {
				setTransitionInfo({
					turnNo: progress.current_turn,
					currentDate: progress.market_date,
					nextTurn: submitted.next_turn,
					nextDate: progress.next_market_date,
				});
			} else {
				setTransitionInfo(null);
			}

			// 서버는 매 TURN 제출 시 turn_evaluation을 반환한다.
			// 바로 다음 TURN이나 종합 결과로 이동하지 않고, 반드시 턴 피드백을 먼저 보여준다.
			if (evaluation?.scorecard) {
				turnFeedbackModal.onOpen();
				return;
			}

			// 예외적으로 턴 평가가 없는 응답이 오면 기존 흐름으로 안전하게 진행한다.
			if (submitted.final_evaluation) {
				showFinalEvaluation(submitted.final_evaluation);
				return;
			}

			if (submitted.next_turn) {
				setQuantity(10);
				setOrderSide("BUY");
				setLastOrder(null);
				setLastOrderAssetName("");
				await loadTurn();
				return;
			}

			if (submitted.session?.status === "COMPLETED") {
				await loadResult();
				return;
			}

			toast({
				title: "TURN 기록이 저장되었습니다.",
				status: "success",
				isClosable: true,
			});

			await loadTurn(false);
		} catch (error: any) {
			console.error("TURN 제출 실패:", error);

			toast({
				title: "TURN 기록을 저장하지 못했습니다.",
				description: errorMessage(
					error,
					"판단 근거를 저장하는 중 오류가 발생했습니다.",
				),
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsSubmittingTurn(false);
		}
	};

	const handleTurnFeedbackContinue = async () => {
		turnFeedbackModal.onClose();

		const nextTurn = transitionInfo?.nextTurn ?? null;
		const finalResult = pendingFinalEvaluation;

		setTurnEvaluation(null);
		setPendingFinalEvaluation(null);
		setTransitionInfo(null);
		setQuantity(10);
		setOrderSide("BUY");
		setLastOrder(null);
		setLastOrderAssetName("");

		if (finalResult) {
			showFinalEvaluation(finalResult);
			return;
		}

		if (nextTurn) {
			await loadTurn();
			return;
		}

		// 마지막 TURN에서 final_evaluation이 응답에 직접 없던 경우 결과 API로 다시 조회한다.
		await loadResult();
	};

	const handleOrderSuccessClose = () => {
		orderSuccessModal.onClose();
		setQuantity(10);
	};

	if (!sessionId) {
		return (
			<Flex
				minH="calc(100vh - 80px)"
				bg={UI.bg}
				align="center"
				justify="center"
				px="20px"
			>
				<Panel maxW="520px" w="100%" px="28px" py="30px" textAlign="center">
					<FiAlertTriangle size={30} color={UI.orange} />
					<Heading mt="15px" fontSize="19px">
						시나리오 세션 정보가 없습니다.
					</Heading>
					<Text mt="10px" fontSize="12px" color={UI.subtle} lineHeight="1.7">
						시나리오 목록에서 '시나리오 시작하기'를 눌러 세션을 생성한 뒤
						진입해주세요.
					</Text>
					<Button
						mt="20px"
						bg={UI.orange}
						color="white"
						_hover={{ bg: UI.orangeDark }}
						onClick={() => navigate("/scenario")}
					>
						과거 시나리오로 돌아가기
					</Button>
				</Panel>
			</Flex>
		);
	}

	if (isTurnLoading && !turnView) {
		return (
			<Flex
				minH="calc(100vh - 80px)"
				bg={UI.bg}
				align="center"
				justify="center"
				direction="column"
				gap="12px"
			>
				<Spinner color={UI.orange} thickness="3px" />
				<Text fontSize="12px" color={UI.subtle}>
					시나리오 데이터를 불러오는 중입니다.
				</Text>
			</Flex>
		);
	}

	if (!turnView || !progress || !scenario || !turn || !portfolio) {
		return (
			<Flex
				minH="calc(100vh - 80px)"
				bg={UI.bg}
				align="center"
				justify="center"
				px="20px"
			>
				<Panel maxW="540px" w="100%" px="28px" py="30px" textAlign="center">
					<Heading fontSize="18px">현재 TURN 정보를 표시할 수 없습니다.</Heading>
					<Text mt="9px" fontSize="11px" color={UI.subtle}>
						시나리오 서버 응답과 세션 상태를 확인해주세요.
					</Text>
					<Button
						mt="18px"
						variant="outline"
						borderColor={UI.orange}
						color={UI.orange}
						onClick={() => void loadTurn()}
					>
						다시 불러오기
					</Button>
				</Panel>
			</Flex>
		);
	}

	const selectedChange = numberValue(selectedAsset?.change);
	const selectedChangePct = numberValue(selectedAsset?.change_pct);
	const hasPositions = portfolio.positions.length > 0;
	const moveDays = daysBetween(progress.market_date, progress.next_market_date);

	return (
		<Box
			w="100%"
			minH="calc(100vh - 80px)"
			bg={UI.bg}
			color={UI.text}
			px={{ base: "12px", md: "16px", xl: "18px" }}
			pt="16px"
			pb="26px"
		>
			{/* Page title */}
			<Flex align="flex-start" justify="space-between" gap="16px" mb="12px">
				<Box minW="0">
					<Heading
						fontSize={{ base: "21px", md: "24px" }}
						letterSpacing="-0.04em"
						noOfLines={1}
					>
						{scenario.title}
					</Heading>
					<Text
						mt="2px"
						fontSize="11px"
						lineHeight="1.55"
						color={UI.subtle}
						noOfLines={2}
					>
						{turn.summary || scenario.description}
					</Text>
				</Box>

				<Button
					flexShrink={0}
					size="sm"
					h="31px"
					px="12px"
					variant="outline"
					borderColor={UI.orange}
					color={UI.orange}
					borderRadius="8px"
					leftIcon={<FiInfo size={13} />}
					fontSize="10px"
					_hover={{ bg: UI.orangeSoft }}
					onClick={scenarioInfoModal.onOpen}
				>
					시나리오 정보
				</Button>
			</Flex>

			<Grid
				templateColumns={{
					base: "1fr",
					xl: "minmax(0, 1fr) 265px 278px",
				}}
				gap="12px"
				alignItems="stretch"
			>
				{/* Left large content */}
				<GridItem minW="0">
					<Stack spacing="12px">
						{/* Selected asset summary */}
						<Panel px="18px" py="14px">
							<SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }} spacing="16px">
								<Box>
									<TinyLabel>종목</TinyLabel>
									<Flex mt="8px" align="baseline" gap="7px">
										<Text fontSize="14px" fontWeight="900" noOfLines={1}>
											{selectedAsset?.name ?? "-"}
										</Text>
										<Text fontSize="10px" color={UI.subtle}>
											{selectedAsset?.asset_id ?? "-"}
										</Text>
									</Flex>
								</Box>

								<Box>
									<TinyLabel>현재가</TinyLabel>
									<Text mt="8px" fontSize="14px" fontWeight="800">
										{formatPrice(selectedAsset?.current_price)}
									</Text>
								</Box>

								<Box>
									<TinyLabel>등락률</TinyLabel>
									<Text
										mt="8px"
										fontSize="14px"
										fontWeight="900"
										color={
											selectedChange > 0
												? UI.red
												: selectedChange < 0
													? UI.blue
													: UI.subtle
										}
									>
										{formatSignedWon(selectedChange)}
									</Text>
									<Text
										mt="2px"
										fontSize="9px"
										color={
											selectedChangePct > 0
												? UI.red
												: selectedChangePct < 0
													? UI.blue
													: UI.subtle
										}
									>
										{formatPct(selectedChangePct)}
									</Text>
								</Box>

								<Box>
									<TinyLabel>거래량</TinyLabel>
									<Text mt="8px" fontSize="14px" fontWeight="800">
										{selectedAsset?.volume != null
											? integer.format(selectedAsset.volume)
											: "-"}
									</Text>
								</Box>

								<Box>
									<TinyLabel>섹터</TinyLabel>
									<Text mt="8px" fontSize="14px" fontWeight="800">
										{selectedAsset?.industry_label ||
											selectedAsset?.market ||
											"-"}
									</Text>
								</Box>
							</SimpleGrid>
						</Panel>

						{/* Chart */}
						<ChartPanel
							chart={chart}
							isLoading={isChartLoading}
							orders={selectedAssetOrders}
							activeTab={dataTab}
							onTabChange={setDataTab}
							range={chartRange}
							onRangeChange={setChartRange}
						/>

						{/* Market / News */}
						<SimpleGrid columns={{ base: 1, lg: 2 }} spacing="12px">
							<MarketInfoPanel market={marketState} turn={turn} />
							<NewsPanel news={news} />
						</SimpleGrid>
					</Stack>
				</GridItem>

				{/* Middle asset list */}
				<GridItem minW="0">
					<AssetList
						assets={assets}
						selectedAssetId={selectedAsset?.asset_id ?? ""}
						onSelect={setSelectedAssetId}
						search={assetSearch}
						onSearchChange={setAssetSearch}
						hasPositions={hasPositions}
					/>

					<HoldingsPanel portfolio={portfolio} />
				</GridItem>

				{/* Right order / info */}
				<GridItem minW="0">
					<Stack spacing="12px">
						<OrderPanel
							asset={selectedAsset}
							portfolio={portfolio}
							side={orderSide}
							onSideChange={(side) => {
								setOrderSide(side);
								setQuantity(side === "BUY" ? 10 : 0);
							}}
							quantity={quantity}
							onQuantityChange={setQuantity}
							onOrder={handleOrder}
							isOrdering={isOrdering}
						/>

						<ScenarioMiniInfo progress={progress} />
					</Stack>
				</GridItem>
			</Grid>

			{/* Bottom turn bar */}
			<Panel
				mt="14px"
				minH="76px"
				overflow="hidden"
				display="grid"
				gridTemplateColumns={{ base: "1fr", lg: "1.1fr 1fr" }}
			>
				<Flex
					px="14px"
					py="12px"
					align={{ base: "flex-start", md: "center" }}
					gap={{ base: "5px", md: "24px" }}
					direction={{ base: "column", md: "row" }}
				>
					<Text
						fontSize="17px"
						fontWeight="900"
						color={UI.orange}
						whiteSpace="nowrap"
					>
						TURN {progress.current_turn} / {progress.total_turns}
					</Text>

					<Text fontSize="10px" color={UI.subtle}>
						{progress.next_market_date
							? `이번 TURN을 종료하고${moveDays != null ? ` 약 ${moveDays}일 후` : ""
							} 다음 실제 시장 시점으로 이동합니다.`
							: "이번 TURN을 제출하면 최종 평가가 생성됩니다."}
					</Text>
				</Flex>

				<Button
					h="100%"
					minH="76px"
					borderRadius="0"
					bg={UI.orange}
					color="white"
					_hover={{ bg: UI.orangeDark }}
					onClick={decisionModal.onOpen}
				>
					<Flex w="100%" align="center" justify="space-between" px="18px">
						<Box flex="1" textAlign="center">
							<Text fontSize="16px" fontWeight="800">
								{progress.current_turn === progress.total_turns
									? "마지막 TURN을 종료하고 결과 확인"
									: "TURN을 종료하고 다음 시점으로"}
							</Text>
							<Text mt="4px" fontSize="9px" fontWeight="500">
								{progress.next_market_date
									? `${moveDays != null ? `약 ${moveDays}일 후` : "다음 시점"
									}로 이동`
									: "최종 종합 평가 생성"}
							</Text>
						</Box>

						<Flex
							w="38px"
							h="38px"
							borderRadius="full"
							border="1.5px solid white"
							align="center"
							justify="center"
							flexShrink={0}
						>
							<FiArrowRight size={19} />
						</Flex>
					</Flex>
				</Button>
			</Panel>

			{/* Modals */}
			<ScenarioInfoModal
				isOpen={scenarioInfoModal.isOpen}
				onClose={scenarioInfoModal.onClose}
				scenario={scenario}
				progress={progress}
				portfolio={portfolio}
			/>

			<ScenarioOrderSuccessModal
				isOpen={orderSuccessModal.isOpen}
				onClose={handleOrderSuccessClose}
				order={lastOrder}
				assetName={lastOrderAssetName}
			/>

			<TurnDecisionModal
				isOpen={decisionModal.isOpen}
				onClose={decisionModal.onClose}
				questions={questions}
				answers={answers}
				onAnswersChange={setAnswers}
				onSubmit={handleSubmitTurn}
				isSubmitting={isSubmittingTurn}
				progress={progress}
				recentOrder={lastOrder}
				recentOrderAssetName={lastOrderAssetName}
			/>

			<TurnFeedbackModal
				isOpen={turnFeedbackModal.isOpen}
				onContinue={() => void handleTurnFeedbackContinue()}
				evaluation={turnEvaluation}
				info={transitionInfo}
				isFinalTurn={progress.current_turn === progress.total_turns}
			/>

			<FinalResultModal
				isOpen={finalResultModal.isOpen}
				onClose={finalResultModal.onClose}
				evaluation={finalEvaluation}
				onGoMyPage={() => navigate("/mypage")}
			/>
		</Box>
	);
}
