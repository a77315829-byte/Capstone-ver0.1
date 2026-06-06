import React, { useEffect, useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	CardHeader,
	Checkbox,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	NumberInput,
	NumberInputField,
	Progress,
	SimpleGrid,
	Spacer,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Text,
	Textarea,
	useToast,
} from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api.service";

type ScenarioAction = "BUY" | "SELL" | "HOLD";
type ChartPeriod = "1m" | "10m" | "1h" | "1d" | "1w";

type ScenarioCandle = {
	label: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

type ScenarioStock = {
	symbol: string;
	name: string;
	price: number;
	changeRate: number;
	volume: number;
	sector?: string;
	reason?: string;
};

type ScenarioStep = {
	stepNumber: number;
	title: string;
	dateLabel: string;
	marketInfo: {
		indexFlow: string;
		sectorFlow: string;
		volatility: string;
		volume: string;
	};
	stockInfo: ScenarioStock;
	marketStocks?: ScenarioStock[];
	newsCards: {
		title: string;
		summary: string;
		publishedAt: string;
		source: string;
	}[];
	eventInfo: string;
	hint: string;
	referenceDecision: ScenarioAction;
	referenceReason: string;
};

type ScenarioDecision = {
	stepNumber: number;
	action: ScenarioAction;
	quantity: number;
	ratio: number;
	tags: string[];
	reason: string;
	aiFeedback?: {
		summary?: string;
		alternative?: string;
	};
};

type ScenarioDetail = {
	scenario: {
		_id: string;
		chapterId: number;
		chapterTitle: string;
		scenarioNo: string;
		scenarioSlug: string;
		title: string;
		eventPeriod: string;
		summary: string;
		background: string;
		difficulty: string;
		estimatedMinutes: number;
		keywords: string[];
		learningPoints: string[];
		aiEvaluationPoints: string[];
		expectedFeedback: string;
		steps: ScenarioStep[];
	};
	decisions: ScenarioDecision[];
	progress: {
		completedStepCount: number;
		totalStepCount: number;
		isCompleted: boolean;
	};
};

const unwrapApiData = <T,>(payload: any): T => payload?.data ?? payload;

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ko-KR");

const actionLabel: Record<ScenarioAction, string> = {
	BUY: "매수",
	SELL: "매도",
	HOLD: "관망",
};

const actionColor: Record<ScenarioAction, string> = {
	BUY: "red",
	SELL: "blue",
	HOLD: "gray",
};

const tagOptions = [
	"공포",
	"변동성",
	"저가 매수",
	"추격매수",
	"리스크 우려",
	"장기 관점",
	"뉴스 반영",
	"거래량 증가",
	"관망",
	"비중 관리",
];


function buildScenarioStocks(
	scenario: ScenarioDetail["scenario"],
	step: ScenarioStep,
): ScenarioStock[] {
	const base = step.stockInfo;
	const chapterId = scenario.chapterId;

	const presets: Record<number, ScenarioStock[]> = {
		1: [
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: base.changeRate,
				volume: base.volume,
				sector: "반도체",
				reason: "시장 대표 대형주",
			},
			{
				symbol: "035420",
				name: "NAVER",
				price: Math.round(base.price * 0.74),
				changeRate: -3.2,
				volume: 3800000,
				sector: "성장주",
				reason: "급락장 성장주 변동성 확인",
			},
			{
				symbol: "068270",
				name: "셀트리온",
				price: Math.round(base.price * 0.56),
				changeRate: -1.4,
				volume: 2100000,
				sector: "바이오",
				reason: "방어적 성격 비교",
			},
		],
		2: [
			{
				symbol: "373220",
				name: "LG에너지솔루션",
				price: Math.round(base.price * 1.18),
				changeRate: 7.8,
				volume: 4200000,
				sector: "2차전지",
				reason: "테마 과열 대표 종목",
			},
			{
				symbol: "247540",
				name: "에코프로비엠",
				price: Math.round(base.price * 0.94),
				changeRate: 12.4,
				volume: 5200000,
				sector: "2차전지",
				reason: "급등주 추격매수 판단",
			},
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: 1.1,
				volume: base.volume,
				sector: "반도체",
				reason: "대형주 비교 대상",
			},
		],
		3: [
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: base.changeRate,
				volume: base.volume,
				sector: "반도체",
				reason: "뉴스 영향 확인",
			},
			{
				symbol: "000660",
				name: "SK하이닉스",
				price: Math.round(base.price * 0.82),
				changeRate: -2.6,
				volume: 6400000,
				sector: "반도체",
				reason: "같은 섹터 비교",
			},
			{
				symbol: "055550",
				name: "신한지주",
				price: Math.round(base.price * 0.31),
				changeRate: 1.8,
				volume: 3100000,
				sector: "금융",
				reason: "금리 뉴스 영향 비교",
			},
		],
		4: [
			{
				symbol: "035720",
				name: "카카오",
				price: Math.round(base.price * 0.45),
				changeRate: -5.4,
				volume: 4500000,
				sector: "성장주",
				reason: "손실 보유 판단",
			},
			{
				symbol: "035420",
				name: "NAVER",
				price: Math.round(base.price * 0.73),
				changeRate: -3.8,
				volume: 3800000,
				sector: "성장주",
				reason: "조정장 비교",
			},
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: -1.0,
				volume: base.volume,
				sector: "대형주",
				reason: "상대적 안정성 비교",
			},
		],
		5: [
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: 2.2,
				volume: base.volume,
				sector: "반도체",
				reason: "회복장 대표 종목",
			},
			{
				symbol: "000660",
				name: "SK하이닉스",
				price: Math.round(base.price * 0.85),
				changeRate: 3.4,
				volume: 6200000,
				sector: "반도체",
				reason: "업황 회복 민감주",
			},
			{
				symbol: "005380",
				name: "현대차",
				price: Math.round(base.price * 1.15),
				changeRate: 1.6,
				volume: 1900000,
				sector: "자동차",
				reason: "경기 회복 비교",
			},
		],
		6: [
			{
				symbol: "005930",
				name: "삼성전자",
				price: base.price,
				changeRate: base.changeRate,
				volume: base.volume,
				sector: "대형주",
				reason: "분산 포트폴리오 핵심",
			},
			{
				symbol: "105560",
				name: "KB금융",
				price: Math.round(base.price * 0.43),
				changeRate: 0.7,
				volume: 2400000,
				sector: "금융",
				reason: "섹터 분산 대상",
			},
			{
				symbol: "051910",
				name: "LG화학",
				price: Math.round(base.price * 1.06),
				changeRate: -2.1,
				volume: 1700000,
				sector: "화학",
				reason: "집중/분산 비교 대상",
			},
		],
	};

	return presets[chapterId] ?? [
		{
			...base,
			sector: "대표 종목",
			reason: "시나리오 기준 종목",
		},
	];
}

const chartPeriodOptions: { key: ChartPeriod; label: string }[] = [
	{ key: "1m", label: "1분" },
	{ key: "10m", label: "10분" },
	{ key: "1h", label: "1시간" },
	{ key: "1d", label: "1일" },
	{ key: "1w", label: "1주" },
];

function buildCandles(stock: ScenarioStock, period: ChartPeriod): ScenarioCandle[] {
	const config: Record<
		ChartPeriod,
		{ count: number; volatility: number; trendScale: number }
	> = {
		"1m": { count: 80, volatility: 0.006, trendScale: 0.55 },
		"10m": { count: 72, volatility: 0.009, trendScale: 0.75 },
		"1h": { count: 60, volatility: 0.013, trendScale: 1.0 },
		"1d": { count: 48, volatility: 0.02, trendScale: 1.25 },
		"1w": { count: 40, volatility: 0.035, trendScale: 1.7 },
	};

	const selected = config[period];
	const base = stock.price || 100000;
	const trend = (stock.changeRate / 100) * selected.trendScale;

	let prevClose = base * (1 - trend * 0.45);

	return Array.from({ length: selected.count }).map((_, index) => {
		const wave =
			Math.sin(index * 0.55 + stock.symbol.length) * selected.volatility;
		const pulse =
			Math.cos(index * 0.21 + stock.name.length) * selected.volatility * 0.7;
		const drift = trend / selected.count;
		const change = drift + wave + pulse;

		const open = prevClose;
		const close = Math.max(open * (1 + change), base * 0.55);

		const high =
			Math.max(open, close) *
			(1 + selected.volatility * (1.2 + (index % 4) * 0.22));

		const low =
			Math.min(open, close) *
			(1 - selected.volatility * (1.1 + (index % 3) * 0.18));

		const volume =
			stock.volume *
			(0.35 +
				((index % 9) + 1) * 0.05 +
				Math.abs(change) * 18 +
				(index > selected.count * 0.75 ? 0.25 : 0));

		prevClose = close;

		return {
			label:
				period === "1m"
					? `${index + 1}분`
					: period === "10m"
						? `${(index + 1) * 10}분`
						: period === "1h"
							? `${index + 1}H`
							: period === "1d"
								? `${index + 1}일`
								: `${index + 1}주`,
			open: Math.round(open),
			high: Math.round(high),
			low: Math.round(low),
			close: Math.round(close),
			volume: Math.round(volume),
		};
	});
}

function ScenarioMiniChart({
	stock,
	period,
	onPeriodChange,
}: {
	stock: ScenarioStock;
	period: ChartPeriod;
	onPeriodChange: (period: ChartPeriod) => void;
}) {
	const candles = useMemo(() => buildCandles(stock, period), [stock, period]);

	const fallbackCandle: ScenarioCandle = {
		label: "기준",
		open: stock.price || 100000,
		high: stock.price || 100000,
		low: stock.price || 100000,
		close: stock.price || 100000,
		volume: stock.volume || 0,
	};

	const first = candles[0] ?? fallbackCandle;
	const last = candles[candles.length - 1] ?? fallbackCandle;

	const prices = candles.flatMap((candle) => [
		candle.open,
		candle.high,
		candle.low,
		candle.close,
	]);

	const minPrice = Math.min(...prices, fallbackCandle.close);
	const maxPrice = Math.max(...prices, fallbackCandle.close);
	const priceRange = maxPrice - minPrice || 1;

	const maxVolume = Math.max(
		...candles.map((candle) => candle.volume),
		1,
	);

	const chartWidth = 920;
	const chartHeight = 330;
	const priceTop = 24;
	const priceBottom = 238;
	const volumeTop = 258;
	const volumeBottom = 326;

	const candleGap = chartWidth / Math.max(candles.length, 1);
	const candleWidth = Math.max(Math.min(candleGap * 0.58, 11), 3);

	const yPrice = (price: number) => {
		return (
			priceBottom -
			((price - minPrice) / priceRange) * (priceBottom - priceTop)
		);
	};

	const periodReturn =
		first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;

	const selectedPeriodLabel =
		chartPeriodOptions.find((item) => item.key === period)?.label ?? "";

	return (
		<Box h="430px" bg="white" borderRadius="xl" borderWidth="1px" p="4">
			<Flex mb="3" align="center">
				<Box>
					<Heading size="sm">가격 차트</Heading>
					<Text fontSize="sm" color="gray.500">
						시나리오용 과거 흐름 · {selectedPeriodLabel}
					</Text>
				</Box>

				<Spacer />

				<HStack spacing="1">
					{chartPeriodOptions.map((item) => (
						<Button
							key={item.key}
							size="xs"
							colorScheme={period === item.key ? "blue" : "gray"}
							variant={period === item.key ? "solid" : "outline"}
							onClick={() => onPeriodChange(item.key)}
						>
							{item.label}
						</Button>
					))}
				</HStack>
			</Flex>

			<Flex mb="2" align="center">
				<Text fontSize="2xl" fontWeight="900">
					{won.format(last.close)}
				</Text>
				<Text
					ml="3"
					fontWeight="900"
					color={periodReturn >= 0 ? "red.500" : "blue.500"}
				>
					{periodReturn > 0 ? "+" : ""}
					{periodReturn.toFixed(2)}%
				</Text>
			</Flex>

			<Box overflowX="auto">
				<svg
					width="100%"
					height="330"
					viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				>
					<rect width={chartWidth} height={chartHeight} fill="#F8FAFC" />

					{[0, 1, 2, 3, 4].map((line) => {
						const y = priceTop + line * ((priceBottom - priceTop) / 4);

						return (
							<line
								key={`grid-${line}`}
								x1="0"
								x2={chartWidth}
								y1={y}
								y2={y}
								stroke="#E2E8F0"
								strokeWidth="1"
							/>
						);
					})}

					{candles.map((candle, index) => {
						const x = index * candleGap + candleGap / 2;
						const openY = yPrice(candle.open);
						const closeY = yPrice(candle.close);
						const highY = yPrice(candle.high);
						const lowY = yPrice(candle.low);

						const isUp = candle.close >= candle.open;
						const color = isUp ? "#E53E3E" : "#3182CE";
						const bodyY = Math.min(openY, closeY);
						const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

						const volumeHeight =
							(candle.volume / maxVolume) * (volumeBottom - volumeTop);
						const volumeY = volumeBottom - volumeHeight;

						return (
							<g key={`${candle.label}-${index}`}>
								<rect
									x={x - candleWidth / 2}
									y={volumeY}
									width={candleWidth}
									height={volumeHeight}
									fill={color}
									opacity="0.35"
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
									x={x - candleWidth / 2}
									y={bodyY}
									width={candleWidth}
									height={bodyHeight}
									fill={color}
									rx="1"
								/>
							</g>
						);
					})}

					<line
						x1="0"
						x2={chartWidth}
						y1={yPrice(last.close)}
						y2={yPrice(last.close)}
						stroke="#718096"
						strokeDasharray="4 4"
						strokeWidth="1"
					/>
				</svg>
			</Box>

			<Flex mt="2" fontSize="sm" color="gray.500">
				<Text>고가 {won.format(maxPrice)}</Text>
				<Spacer />
				<Text>저가 {won.format(minPrice)}</Text>
			</Flex>
		</Box>
	);
}



export default function ScenarioPlay() {
	const { scenarioId } = useParams();
	const navigate = useNavigate();
	const toast = useToast();

	const [detail, setDetail] = useState<ScenarioDetail | null>(null);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [selectedStockIndex, setSelectedStockIndex] = useState(0);
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1d");

	const [action, setAction] = useState<ScenarioAction>("HOLD");
	const [quantity, setQuantity] = useState(0);
	const [ratio, setRatio] = useState(0);
	const [tags, setTags] = useState<string[]>([]);
	const [reason, setReason] = useState("");
	const [lastFeedback, setLastFeedback] = useState<any>(null);

	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const scenario = detail?.scenario;
	const steps = scenario?.steps ?? [];
	const currentStep = steps[currentStepIndex];

	const scenarioStocks = useMemo(() => {
		if (!scenario || !currentStep) return [];
		if (currentStep.marketStocks && currentStep.marketStocks.length > 0) {
			return currentStep.marketStocks;
		}

		return buildScenarioStocks(scenario, currentStep);
	}, [scenario, currentStep]);

	const selectedStock =
		scenarioStocks[selectedStockIndex] ?? currentStep?.stockInfo ?? null;

	const currentDecision = useMemo(() => {
		if (!currentStep || !detail) return null;

		return (
			detail.decisions.find(
				(decision) => decision.stepNumber === currentStep.stepNumber,
			) ?? null
		);
	}, [detail, currentStep]);

	const loadScenario = async () => {
		try {
			setIsLoading(true);

			const res = await api.get(`/scenarios/${scenarioId}`);
			const data = unwrapApiData<ScenarioDetail>(res.data);

			setDetail(data);

			const nextIndex = Math.min(
				data.progress.completedStepCount,
				Math.max(data.scenario.steps.length - 1, 0),
			);

			setCurrentStepIndex(nextIndex);
		} catch (error) {
			console.error(error);

			toast({
				title: "시나리오 상세를 불러오지 못했습니다.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const syncFormFromDecision = () => {
		if (!currentDecision) {
			setAction("HOLD");
			setQuantity(0);
			setRatio(0);
			setTags([]);
			setReason("");
			setLastFeedback(null);
			return;
		}

		setAction(currentDecision.action);
		setQuantity(currentDecision.quantity ?? 0);
		setRatio(currentDecision.ratio ?? 0);
		setTags(currentDecision.tags ?? []);
		setReason(currentDecision.reason ?? "");
		setLastFeedback({
			reference: {
				referenceDecision: currentStep?.referenceDecision,
				referenceReason: currentStep?.referenceReason,
				expectedFeedback: scenario?.expectedFeedback,
				aiEvaluationPoints: scenario?.aiEvaluationPoints,
			},
		});
	};

	useEffect(() => {
		loadScenario();
	}, [scenarioId]);

	useEffect(() => {
		syncFormFromDecision();
		setSelectedStockIndex(0);
	}, [currentStepIndex, detail]);

	const toggleTag = (tag: string) => {
		setTags((prev) => {
			if (prev.includes(tag)) {
				return prev.filter((item) => item !== tag);
			}

			return [...prev, tag];
		});
	};

	const submitDecision = async () => {
		if (!scenario || !currentStep) return;

		if (action !== "HOLD" && quantity <= 0 && ratio <= 0) {
			toast({
				title: "매수/매도 선택 시 수량 또는 비중을 입력하세요.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		if (!reason.trim()) {
			toast({
				title: "판단 이유를 입력하세요.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		try {
			setIsSubmitting(true);

			const selectedStockTag = selectedStock
				? `선택종목:${selectedStock.name}`
				: "";

			const res = await api.post(`/scenarios/${scenario.scenarioSlug}/decisions`, {
				stepNumber: currentStep.stepNumber,
				action,
				quantity,
				ratio,
				tags: [...tags, selectedStockTag].filter(Boolean),
				reason,
			});

			const result = unwrapApiData<any>(res.data);
			setLastFeedback(result);

			toast({
				title: "판단이 저장되었습니다.",
				status: "success",
				isClosable: true,
			});

			await loadScenario();
		} catch (error: any) {
			console.error(error);

			toast({
				title: "판단 저장 실패",
				description:
					error?.response?.data?.message ||
					"시나리오 판단 저장 중 오류가 발생했습니다.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const goNext = () => {
		if (currentStepIndex < steps.length - 1) {
			setCurrentStepIndex((prev) => prev + 1);
			return;
		}

		toast({
			title: "시나리오를 완료했습니다.",
			description: "이후 최종 리포트 화면을 연결할 예정입니다.",
			status: "success",
			isClosable: true,
		});
	};

	if (isLoading || !detail || !scenario || !currentStep || !selectedStock) {
		return (
			<Flex minH="100vh" align="center" justify="center" bg="gray.50">
				<Text color="gray.500">시나리오를 불러오는 중...</Text>
			</Flex>
		);
	}

	const progressValue = ((currentStepIndex + 1) / steps.length) * 100;
	const feedbackDecision = lastFeedback?.reference
		?.referenceDecision as ScenarioAction | undefined;

	return (
		<Box px={{ base: 4, md: 8 }} py="6" bg="gray.50" minH="100vh">
			<Flex align="center" mb="5">
				<Button
					variant="ghost"
					onClick={() => navigate(`/scenario/chapter/${scenario.chapterId}`)}
				>
					← 시나리오 목록
				</Button>
				<Spacer />
				<Badge colorScheme="pink" px="3" py="1" borderRadius="full">
					{scenario.scenarioNo}
				</Badge>
			</Flex>

			<Card mb="5">
				<CardBody>
					<Flex direction={{ base: "column", xl: "row" }} gap="4">
						<Box flex="1">
							<Text color="gray.500" fontSize="sm">
								{scenario.chapterTitle}
							</Text>
							<Heading size="lg" mt="1">
								{scenario.title}
							</Heading>
							<Text mt="2" color="gray.600">
								{scenario.summary}
							</Text>
						</Box>

						<Box minW={{ base: "100%", xl: "320px" }}>
							<Flex mb="1">
								<Text fontSize="sm">
									Step {currentStep.stepNumber} / {steps.length}
								</Text>
								<Spacer />
								<Text fontSize="sm" fontWeight="800">
									{Math.round(progressValue)}%
								</Text>
							</Flex>
							<Progress
								value={progressValue}
								colorScheme="pink"
								borderRadius="full"
							/>
						</Box>
					</Flex>
				</CardBody>
			</Card>

			<Grid templateColumns={{ base: "1fr", xl: "1fr 320px" }} gap="5">
				<GridItem>
					<Stack spacing="5">
						<Card>
							<CardBody>
								<SimpleGrid columns={{ base: 1, md: 5 }} spacing="4">
									<Stat>
										<StatLabel>종목</StatLabel>
										<StatNumber fontSize="lg">{selectedStock.name}</StatNumber>
										<Text fontSize="sm" color="gray.500">
											{selectedStock.symbol}
										</Text>
									</Stat>

									<Stat>
										<StatLabel>현재가</StatLabel>
										<StatNumber fontSize="lg">
											{won.format(selectedStock.price)}
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>등락률</StatLabel>
										<StatNumber
											fontSize="lg"
											color={
												selectedStock.changeRate >= 0 ? "red.500" : "blue.500"
											}
										>
											{selectedStock.changeRate > 0 ? "+" : ""}
											{selectedStock.changeRate.toFixed(2)}%
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>거래량</StatLabel>
										<StatNumber fontSize="lg">
											{numberFormat.format(selectedStock.volume)}
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>섹터</StatLabel>
										<StatNumber fontSize="lg">
											{selectedStock.sector ?? "대표"}
										</StatNumber>
									</Stat>
								</SimpleGrid>
							</CardBody>
						</Card>

						<Grid templateColumns={{ base: "1fr", xl: "1fr 300px" }} gap="5">
							<GridItem>
								<ScenarioMiniChart
	         stock={selectedStock}
	         period={chartPeriod}
	            onPeriodChange={setChartPeriod}
        />
							</GridItem>

							<GridItem>
								<Card h="100%">
									<CardHeader pb="0">
										<Heading size="sm">매매 가능 종목</Heading>
										<Text mt="1" fontSize="sm" color="gray.500">
											상황에 따라 선택 가능한 학습용 종목입니다.
										</Text>
									</CardHeader>

									<CardBody>
										<Stack spacing="3">
											{scenarioStocks.map((stock, index) => (
												<Box
													key={stock.symbol}
													p="3"
													borderWidth="1px"
													borderRadius="lg"
													cursor="pointer"
													bg={selectedStockIndex === index ? "#FFEEF9" : "white"}
													onClick={() => setSelectedStockIndex(index)}
												>
													<Flex align="center">
														<Box>
															<Text fontWeight="900">{stock.name}</Text>
															<Text fontSize="sm" color="gray.500">
																{stock.symbol} · {stock.sector}
															</Text>
														</Box>
														<Spacer />
														<Text
															fontWeight="900"
															color={
																stock.changeRate >= 0 ? "red.500" : "blue.500"
															}
														>
															{stock.changeRate > 0 ? "+" : ""}
															{stock.changeRate.toFixed(2)}%
														</Text>
													</Flex>
													<Text mt="2" fontSize="sm" color="gray.600">
														{stock.reason}
													</Text>
												</Box>
											))}
										</Stack>
									</CardBody>
								</Card>
							</GridItem>
						</Grid>

						<Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="5">
							<Card>
								<CardHeader pb="0">
									<Heading size="md">시장 정보</Heading>
									<Text mt="1" fontSize="sm" color="gray.500">
										거래소의 호가창 대신 당시 시장 맥락을 제공합니다.
									</Text>
								</CardHeader>

								<CardBody>
									<SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
										<Box bg="gray.50" p="4" borderRadius="xl">
											<Text fontWeight="900">지수 흐름</Text>
											<Text mt="2" fontSize="sm" color="gray.600">
												{currentStep.marketInfo.indexFlow}
											</Text>
										</Box>

										<Box bg="gray.50" p="4" borderRadius="xl">
											<Text fontWeight="900">섹터 흐름</Text>
											<Text mt="2" fontSize="sm" color="gray.600">
												{currentStep.marketInfo.sectorFlow}
											</Text>
										</Box>

										<Box bg="gray.50" p="4" borderRadius="xl">
											<Text fontWeight="900">변동성</Text>
											<Text mt="2" fontSize="sm" color="gray.600">
												{currentStep.marketInfo.volatility}
											</Text>
										</Box>

										<Box bg="gray.50" p="4" borderRadius="xl">
											<Text fontWeight="900">거래량</Text>
											<Text mt="2" fontSize="sm" color="gray.600">
												{currentStep.marketInfo.volume}
											</Text>
										</Box>
									</SimpleGrid>
								</CardBody>
							</Card>

							<Card>
								<CardHeader pb="0">
									<Heading size="md">뉴스 및 이벤트</Heading>
									<Text mt="1" fontSize="sm" color="gray.500">
										판단 시점에 제공되는 핵심 정보입니다.
									</Text>
								</CardHeader>

								<CardBody>
									<Stack spacing="3">
										{currentStep.newsCards.map((news, index) => (
											<Box key={index} p="4" borderWidth="1px" borderRadius="xl">
												<HStack mb="2">
													<Badge colorScheme="blue">{news.source}</Badge>
													<Text fontSize="sm" color="gray.500">
														{news.publishedAt}
													</Text>
												</HStack>
												<Text fontWeight="900">{news.title}</Text>
												<Text mt="2" color="gray.600">
													{news.summary}
												</Text>
											</Box>
										))}

										<Box p="4" bg="#FFF7ED" borderRadius="xl">
											<Text fontWeight="900">이벤트 해석</Text>
											<Text mt="2" color="gray.700">
												{currentStep.eventInfo}
											</Text>
										</Box>
									</Stack>
								</CardBody>
							</Card>
						</Grid>
					</Stack>
				</GridItem>

				<GridItem>
					<Card position={{ xl: "sticky" }} top="96px">
						<CardHeader pb="0">
							<Heading size="md">투자 판단 입력</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								거래소 주문창처럼 판단을 입력합니다.
							</Text>
						</CardHeader>

						<CardBody>
							<Stack spacing="4">
								<Box p="4" bg="#EFF6FF" borderRadius="xl">
									<Text fontWeight="900">초보자 힌트</Text>
									<Text mt="2" color="gray.700" fontSize="sm">
										{currentStep.hint}
									</Text>
								</Box>

								<Box>
									<Text fontWeight="800" mb="2">
										판단 선택
									</Text>
									<SimpleGrid columns={3} spacing="2">
										{(["BUY", "SELL", "HOLD"] as ScenarioAction[]).map(
											(item) => (
												<Button
													key={item}
													colorScheme={action === item ? actionColor[item] : "gray"}
													variant={action === item ? "solid" : "outline"}
													onClick={() => setAction(item)}
												>
													{actionLabel[item]}
												</Button>
											),
										)}
									</SimpleGrid>
								</Box>

								{action !== "HOLD" && (
									<SimpleGrid columns={2} spacing="3">
										<Box>
											<Text fontWeight="800" mb="2">
												수량
											</Text>
											<NumberInput
												min={0}
												value={quantity}
												onChange={(_, value) =>
													setQuantity(Number.isNaN(value) ? 0 : value)
												}
											>
												<NumberInputField placeholder="예: 10" />
											</NumberInput>
										</Box>

										<Box>
											<Text fontWeight="800" mb="2">
												비중(%)
											</Text>
											<NumberInput
												min={0}
												max={100}
												value={ratio}
												onChange={(_, value) =>
													setRatio(Number.isNaN(value) ? 0 : value)
												}
											>
												<NumberInputField placeholder="예: 30" />
											</NumberInput>
										</Box>
									</SimpleGrid>
								)}

								<Box>
									<Text fontWeight="800" mb="2">
										판단 태그
									</Text>
									<SimpleGrid columns={2} spacing="2">
										{tagOptions.map((tag) => (
											<Checkbox
												key={tag}
												isChecked={tags.includes(tag)}
												onChange={() => toggleTag(tag)}
											>
												<Text fontSize="sm">{tag}</Text>
											</Checkbox>
										))}
									</SimpleGrid>
								</Box>

								<Box>
									<Text fontWeight="800" mb="2">
										판단 이유
									</Text>
									<Textarea
										value={reason}
										onChange={(event) => setReason(event.target.value)}
										placeholder="왜 이런 판단을 했는지 적어주세요."
										rows={5}
										resize="none"
									/>
								</Box>

								<Button
									colorScheme="pink"
									onClick={submitDecision}
									isLoading={isSubmitting}
								>
									판단 제출
								</Button>

								{lastFeedback?.reference && feedbackDecision && (
									<Box p="4" bg="gray.50" borderRadius="xl">
										<HStack mb="2">
											<Text fontWeight="900">AI 기준 참고</Text>
											<Badge colorScheme={actionColor[feedbackDecision]}>
												{actionLabel[feedbackDecision]}
											</Badge>
										</HStack>

										<Text fontSize="sm" color="gray.700">
											{lastFeedback.reference.referenceReason}
										</Text>

										<Text mt="3" fontSize="sm" color="gray.500">
											{lastFeedback.reference.expectedFeedback}
										</Text>
									</Box>
								)}

								<Button
									variant="outline"
									onClick={goNext}
									isDisabled={!currentDecision && !lastFeedback}
								>
									{currentStepIndex < steps.length - 1
										? "다음 단계로"
										: "시나리오 완료"}
								</Button>
							</Stack>
						</CardBody>
					</Card>
				</GridItem>
			</Grid>
		</Box>
	);
}
