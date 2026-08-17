import React, {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Flex,
	Grid,
	Heading,
	HStack,
	Progress,
	SimpleGrid,
	Skeleton,
	Spacer,
	Stack,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useToast,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { useNavigate } from "react-router-dom";

import api from "../services/api.service";
import tokens from "../services/tokens.service";
import scenarioService, {
	type ScenarioUserProgress,
} from "../services/scenario.service";
import {
	fetchQuizProgress,
	getCachedQuizProgress,
	type QuizProgressSummary,
} from "../services/learningProgress.service";
import financeQuizzesData from "../data/financeQuizzes.json";
import UsPortfolioMyPageSection from "../components/Profile/UsPortfolioMyPageSection";

type TradingOrderSide = "BUY" | "SELL";
type TradingOrderType = "MARKET" | "LIMIT";
type TradingOrderStatus =
	| "PENDING"
	| "FILLED"
	| "CANCELED"
	| "REJECTED";

type TradingAccountSummary = {
	userId: string;
	cash: number;
	reservedCash: number;
	availableCash: number;
	initialCash: number;
	currency?: string;
	totalAsset?: number;
	totalEvaluationAmount?: number;
	totalBuyAmount?: number;
	totalProfitLoss?: number;
	totalProfitLossRate?: number;
};

type PortfolioHolding = {
	id: string;
	symbol: string;
	name: string;
	market: string;
	quantity: number;
	reservedQuantity: number;
	availableQuantity: number;
	avgPrice: number;
	currentPrice: number;
	changeRate: number;
	evaluationAmount: number;
	buyAmount: number;
	profitLoss: number;
	profitLossRate: number;
};

type PortfolioData = {
	account: TradingAccountSummary;
	holdings: PortfolioHolding[];
};

type TradeOrderData = {
	_id: string;
	userId: string;
	symbol: string;
	name: string;
	market: string;
	side: TradingOrderSide;
	orderType: TradingOrderType;
	status: TradingOrderStatus;
	quantity: number;
	filledQuantity: number;
	orderPrice: number;
	limitPrice?: number | null;
	executedPrice?: number | null;
	reservedAmount: number;
	reservedQuantity: number;
	realizedProfit: number;
	rejectReason?: string;
	createdAt: string;
	executedAt?: string | null;
	canceledAt?: string | null;
};

type PeriodKey = "7d" | "30d" | "90d" | "180d" | "365d" | "all";

const periodOptions: {
	key: PeriodKey;
	label: string;
	days?: number;
}[] = [
	{ key: "7d", label: "1주", days: 7 },
	{ key: "30d", label: "1개월", days: 30 },
	{ key: "90d", label: "3개월", days: 90 },
	{ key: "180d", label: "6개월", days: 180 },
	{ key: "365d", label: "1년", days: 365 },
	{ key: "all", label: "전체" },
];

const TOTAL_QUIZ_COUNT = Array.isArray(financeQuizzesData)
	? financeQuizzesData.length
	: 0;

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ko-KR");

function unwrapApiData<T>(raw: unknown): T {
	const value = raw as {
		success?: boolean;
		data?: T;
		output?: T;
	};

	if (value?.success === true && value.data !== undefined) {
		return value.data;
	}
	if (value?.data !== undefined) {
		return value.data;
	}
	if (value?.output !== undefined) {
		return value.output;
	}
	return raw as T;
}

function getHoldingValue(holding: PortfolioHolding): number {
	return Number(
		holding.evaluationAmount ?? holding.quantity * holding.currentPrice,
	);
}

function formatCompactWon(value: number): string {
	const absolute = Math.abs(value);
	if (absolute >= 100_000_000) {
		return `${value < 0 ? "-" : ""}${(
			absolute / 100_000_000
		).toFixed(1)}억원`;
	}
	if (absolute >= 10_000) {
		return `${value < 0 ? "-" : ""}${Math.round(
			absolute / 10_000,
		).toLocaleString("ko-KR")}만원`;
	}
	return won.format(value);
}

function formatShortDate(value?: string | null): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("ko-KR", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function StatCell({
	label,
	value,
	accent,
}: {
	label: string;
	value: React.ReactNode;
	accent?: "positive" | "negative" | "normal";
}) {
	const color =
		accent === "positive"
			? "app.positive"
			: accent === "negative"
				? "app.negative"
				: "app.text";

	return (
		<Box minW="0" px={{ base: "14px", xl: "24px" }}>
			<Text fontSize="12px" color="app.muted">
				{label}
			</Text>
			<Text
				mt="12px"
				fontSize={{ base: "17px", xl: "20px" }}
				fontWeight="900"
				color={color}
				whiteSpace="nowrap"
				overflow="hidden"
				textOverflow="ellipsis"
			>
				{value}
			</Text>
		</Box>
	);
}

function PerformanceChart({
	orders,
	initialCash,
	period,
}: {
	orders: TradeOrderData[];
	initialCash: number;
	period: PeriodKey;
}) {
	const points = useMemo(() => {
		const selectedPeriod = periodOptions.find((item) => item.key === period);
		const cutoff = selectedPeriod?.days
			? Date.now() - selectedPeriod.days * 24 * 60 * 60 * 1000
			: 0;

		const filled = orders
			.filter((order) => order.status === "FILLED")
			.filter((order) => {
				const date = new Date(
					order.executedAt ?? order.createdAt,
				).getTime();
				return cutoff === 0 || date >= cutoff;
			})
			.sort(
				(first, second) =>
					new Date(
						first.executedAt ?? first.createdAt,
					).getTime() -
					new Date(
						second.executedAt ?? second.createdAt,
					).getTime(),
			);

		let cumulativeProfit = 0;
		const result = filled.map((order, index) => {
			cumulativeProfit += Number(order.realizedProfit ?? 0);
			return {
				label: new Date(
					order.executedAt ?? order.createdAt,
				).toLocaleDateString("ko-KR", {
					month: "2-digit",
					day: "2-digit",
				}),
				value:
					initialCash > 0
						? (cumulativeProfit / initialCash) * 100
						: 0,
				index,
			};
		});

		if (result.length === 0) {
			return [
				{ label: "시작", value: 0, index: 0 },
				{ label: "현재", value: 0, index: 1 },
			];
		}

		return [{ label: "시작", value: 0, index: -1 }, ...result];
	}, [orders, initialCash, period]);

	const width = 820;
	const height = 250;
	const padding = {
		top: 24,
		right: 22,
		bottom: 34,
		left: 45,
	};
	const values = points.map((point) => point.value);
	const minValue = Math.min(-4, Math.floor(Math.min(...values) - 1));
	const maxValue = Math.max(8, Math.ceil(Math.max(...values) + 1));
	const range = maxValue - minValue || 1;
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;
	const x = (index: number) =>
		padding.left +
		(index / Math.max(points.length - 1, 1)) * chartWidth;
	const y = (value: number) =>
		padding.top + ((maxValue - value) / range) * chartHeight;
	const path = points
		.map(
			(point, index) =>
				`${index === 0 ? "M" : "L"}${x(index)} ${y(point.value)}`,
		)
		.join(" ");

	return (
		<Box w="100%" overflowX="auto">
			<svg
				width="100%"
				height="250"
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="none"
			>
				{[-4, -2, 0, 2, 4, 6, 8].map((tick) => {
					if (tick < minValue || tick > maxValue) return null;
					return (
						<g key={tick}>
							<line
								x1={padding.left}
								x2={width - padding.right}
								y1={y(tick)}
								y2={y(tick)}
								stroke="#EEE4D8"
								strokeWidth="1"
							/>
							<text
								x="6"
								y={y(tick) + 4}
								fontSize="11"
								fill="#827A72"
							>
								{tick > 0 ? "+" : ""}
								{tick}%
							</text>
						</g>
					);
				})}

				<path
					d={path}
					fill="none"
					stroke="#F66B24"
					strokeWidth="2"
					strokeLinejoin="round"
					strokeLinecap="round"
				/>

				{points.map((point, index) => (
					<g key={`${point.label}-${index}`}>
						<circle
							cx={x(index)}
							cy={y(point.value)}
							r="4"
							fill="#F66B24"
						/>
						{(index === 0 ||
							index === points.length - 1 ||
							index % 3 === 0) && (
							<text
								x={x(index)}
								y={height - 8}
								fontSize="10"
								textAnchor="middle"
								fill="#827A72"
							>
								{point.label}
							</text>
						)}
					</g>
				))}
			</svg>
		</Box>
	);
}

function LearningProgressCard({
	scenarioProgress,
	quizProgress,
	onScenarioClick,
	onQuizClick,
}: {
	scenarioProgress: ScenarioUserProgress | null;
	quizProgress: QuizProgressSummary;
	onScenarioClick: () => void;
	onQuizClick: () => void;
}) {
	const activeScenario = scenarioProgress?.active ?? null;
	const completedScenarioCount = scenarioProgress?.completed_count ?? 0;
	const totalScenarioCount = scenarioProgress?.total_count ?? 0;
	const scenarioPercent = activeScenario?.progress_percent ?? 0;

	return (
		<Card h="100%">
			<CardBody p={{ base: "18px", md: "22px" }}>
				<Heading size="sm" mb="18px">
					학습 진행 현황
				</Heading>

				<SimpleGrid columns={{ base: 1, xl: 2 }} spacing="20px">
					<Box
						pr={{ xl: "20px" }}
						borderRightWidth={{ base: "0", xl: "1px" }}
						borderColor="app.borderSoft"
					>
						<Flex align="center" gap="8px" mb="10px">
							<Box
								w="42px"
								h="42px"
								borderRadius="full"
								bg="brand.50"
								borderWidth="1px"
								borderColor="brand.100"
								display="flex"
								alignItems="center"
								justifyContent="center"
								fontWeight="900"
								color="brand.500"
							>
								S
							</Box>
							<Box minW="0">
								<Text fontSize="12px" color="app.muted">
									시나리오 진행 현황
								</Text>
								{activeScenario ? (
									<HStack spacing="7px" mt="2px">
										<Text fontWeight="900" noOfLines={1}>
											{activeScenario.title}
										</Text>
										<Badge colorScheme="orange">진행 중</Badge>
									</HStack>
								) : (
									<Text mt="2px" fontWeight="900">
										진행 중인 시나리오 없음
									</Text>
								)}
							</Box>
						</Flex>

						{activeScenario ? (
							<>
								<Flex align="center" mb="9px">
									<Text fontSize="12px" color="app.subtleText">
										TURN {activeScenario.current_turn} /{" "}
										{activeScenario.total_turns}
									</Text>
									<Spacer />
									<Text
										fontSize="13px"
										fontWeight="900"
										color="brand.500"
									>
										{scenarioPercent}%
									</Text>
								</Flex>
								<Progress
									value={scenarioPercent}
									colorScheme="orange"
									h="5px"
									borderRadius="full"
									bg="#F4E9DD"
								/>
							</>
						) : (
							<Text fontSize="12px" color="app.subtleText" lineHeight="1.7">
								새 과거 시나리오를 시작하면 현재 턴과 진행률이 이곳에 표시됩니다.
							</Text>
						)}

						<Flex
							mt="18px"
							pt="14px"
							borderTopWidth="1px"
							borderColor="app.borderSoft"
							align="center"
						>
							<Box>
								<Text fontSize="11px" color="app.muted">
									완료한 시나리오
								</Text>
								<Text mt="3px" fontWeight="900">
									{completedScenarioCount} / {totalScenarioCount || "-"}개
								</Text>
							</Box>
							<Spacer />
							<Button
								size="sm"
								variant={activeScenario ? "outline" : "solid"}
								colorScheme="orange"
								onClick={onScenarioClick}
							>
								{activeScenario ? "이어하기" : "시나리오 보기"}
							</Button>
						</Flex>
					</Box>

					<Box pl={{ xl: "4px" }}>
						<Flex align="center" gap="8px" mb="10px">
							<Box
								w="42px"
								h="42px"
								borderRadius="full"
								bg="brand.50"
								borderWidth="1px"
								borderColor="brand.100"
								display="flex"
								alignItems="center"
								justifyContent="center"
								fontWeight="900"
								color="brand.500"
							>
								Q
							</Box>
							<Box>
								<Text fontSize="12px" color="app.muted">
									퀴즈 학습
								</Text>
								<Text mt="2px" fontSize="24px" fontWeight="900">
									{quizProgress.progressPercent}%
								</Text>
							</Box>
						</Flex>

						<Progress
							value={quizProgress.progressPercent}
							colorScheme="orange"
							h="5px"
							borderRadius="full"
							bg="#F4E9DD"
						/>

						<SimpleGrid columns={3} spacing="8px" mt="16px">
							<Box>
								<Text fontSize="10px" color="app.muted">
									푼 문제
								</Text>
								<Text mt="3px" fontSize="13px" fontWeight="900">
									{quizProgress.answeredCount} /{" "}
									{quizProgress.totalQuizCount}
								</Text>
							</Box>
							<Box>
								<Text fontSize="10px" color="app.muted">
									정답률
								</Text>
								<Text mt="3px" fontSize="13px" fontWeight="900">
									{quizProgress.accuracyPercent}%
								</Text>
							</Box>
							<Box>
								<Text fontSize="10px" color="app.muted">
									완료 세션
								</Text>
								<Text mt="3px" fontSize="13px" fontWeight="900">
									{quizProgress.completedSessions}회
								</Text>
							</Box>
						</SimpleGrid>

						<Button
							mt="18px"
							w="100%"
							size="sm"
							variant="outline"
							colorScheme="orange"
							onClick={onQuizClick}
						>
							퀴즈 계속하기
						</Button>
					</Box>
				</SimpleGrid>
			</CardBody>
		</Card>
	);
}

export default function MyPage() {
	const toast = useToast();
	const navigate = useNavigate();
	const username = tokens.getUsername() ?? "훈련생";

	const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
	const [tradeOrders, setTradeOrders] = useState<TradeOrderData[]>([]);
	const [scenarioProgress, setScenarioProgress] =
		useState<ScenarioUserProgress | null>(null);
	const [quizProgress, setQuizProgress] = useState<QuizProgressSummary>(() =>
		getCachedQuizProgress(username, TOTAL_QUIZ_COUNT),
	);
	const [isLoading, setIsLoading] = useState(true);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
	const [period, setPeriod] = useState<PeriodKey>("7d");

	const refreshQuizProgress = useCallback(async () => {
		const progress = await fetchQuizProgress(
			username,
			TOTAL_QUIZ_COUNT,
		);
		setQuizProgress(progress);
	}, [username]);

	const loadMyPageData = useCallback(async () => {
		try {
			setIsLoading(true);

			const scenarioRequest = scenarioService
				.getUserProgress(username)
				.catch((error) => {
					console.warn("시나리오 진행도 조회 실패:", error);
					return null;
				});

			const [portfolioResponse, orderResponse, scenarioData] =
				await Promise.all([
					api.get("/trading/portfolio?evaluate=true"),
					api.get("/trading/orders?limit=50"),
					scenarioRequest,
				]);

			const portfolioData = unwrapApiData<PortfolioData>(
				portfolioResponse.data,
			);
			const orderData = unwrapApiData<TradeOrderData[]>(orderResponse.data);

			setPortfolio({
				account: portfolioData.account,
				holdings: Array.isArray(portfolioData.holdings)
					? portfolioData.holdings
					: [],
			});
			setTradeOrders(Array.isArray(orderData) ? orderData : []);
			setScenarioProgress(scenarioData);
			await refreshQuizProgress();
			setLastUpdatedAt(new Date());
		} catch (error: any) {
			console.error("마이페이지 데이터 조회 실패:", error);

			if (error?.response?.status === 401) {
				toast({
					title: "로그인이 필요합니다.",
					status: "warning",
					duration: 2500,
					isClosable: true,
				});
				navigate("/login", { replace: true });
				return;
			}

			toast({
				title: "포트폴리오를 불러오지 못했습니다.",
				description:
					error?.response?.data?.message ??
					"거래 서버 연결 상태를 확인하세요.",
				status: "error",
				duration: 3500,
				isClosable: true,
			});
		} finally {
			setIsLoading(false);
		}
	}, [navigate, refreshQuizProgress, toast, username]);

	useEffect(() => {
		void loadMyPageData();
	}, [loadMyPageData]);

	useEffect(() => {
		const handleProgressUpdated = () => {
			void refreshQuizProgress();
		};
		window.addEventListener("storage", handleProgressUpdated);
		window.addEventListener(
			"antitude:quiz-progress-updated",
			handleProgressUpdated,
		);

		return () => {
			window.removeEventListener("storage", handleProgressUpdated);
			window.removeEventListener(
				"antitude:quiz-progress-updated",
				handleProgressUpdated,
			);
		};
	}, [refreshQuizProgress]);

	const account = portfolio?.account;
	const holdings = portfolio?.holdings ?? [];
	const cash = Number(account?.cash ?? 0);
	const stockEvaluationAmount = useMemo(
		() =>
			Number(
				account?.totalEvaluationAmount ??
					holdings.reduce(
						(sum, holding) => sum + getHoldingValue(holding),
						0,
					),
			),
		[account?.totalEvaluationAmount, holdings],
	);
	const totalAsset = Number(
		account?.totalAsset ?? cash + stockEvaluationAmount,
	);
	const initialCash = Number(account?.initialCash ?? 0);
	const totalProfitLoss = Number(
		account?.totalProfitLoss ?? totalAsset - initialCash,
	);
	const totalProfitRate = Number(
		account?.totalProfitLossRate ??
			(initialCash > 0 ? (totalProfitLoss / initialCash) * 100 : 0),
	);
	const sortedOrders = useMemo(
		() =>
			[...tradeOrders].sort(
				(first, second) =>
					new Date(second.createdAt).getTime() -
					new Date(first.createdAt).getTime(),
			),
		[tradeOrders],
	);
	const filledOrders = sortedOrders.filter(
		(order) => order.status === "FILLED",
	);
	const largestHolding = [...holdings].sort(
		(first, second) =>
			getHoldingValue(second) - getHoldingValue(first),
	)[0];
	const largestWeight =
		totalAsset > 0 && largestHolding
			? (getHoldingValue(largestHolding) / totalAsset) * 100
			: 0;
	const cashRatio = totalAsset > 0 ? (cash / totalAsset) * 100 : 0;
	const averageHoldingRate =
		holdings.length > 0
			? holdings.reduce(
					(sum, holding) => sum + holding.profitLossRate,
					0,
				) / holdings.length
			: 0;
	const bestHolding = [...holdings].sort(
		(first, second) =>
			second.profitLossRate - first.profitLossRate,
	)[0];
	const worstHolding = [...holdings].sort(
		(first, second) =>
			first.profitLossRate - second.profitLossRate,
	)[0];

	const handleScenarioClick = () => {
		const active = scenarioProgress?.active;
		if (active?.session_id && active.scenario_id) {
			navigate(
				`/scenario/play/${active.scenario_id}?sessionId=${encodeURIComponent(
					active.session_id,
				)}`,
			);
			return;
		}
		navigate("/scenario");
	};

	if (isLoading && !portfolio) {
		return (
			<Box
				maxW="1680px"
				mx="auto"
				px={{ base: "16px", md: "24px" }}
				py="26px"
			>
				<Stack spacing="16px">
					<Skeleton h="28px" w="180px" />
					<Skeleton h="138px" borderRadius="10px" />
					<SimpleGrid columns={{ base: 1, xl: 2 }} spacing="16px">
						<Skeleton h="430px" borderRadius="10px" />
						<Skeleton h="430px" borderRadius="10px" />
					</SimpleGrid>
				</Stack>
			</Box>
		);
	}

	return (
		<Box
			w="100%"
			maxW="1680px"
			mx="auto"
			px={{ base: "16px", md: "24px" }}
			pt="24px"
			pb="72px"
		>
			<Flex align="flex-start" mb="20px" gap="14px">
				<Box>
					<Heading size="md" letterSpacing="-0.035em">
						마이페이지
					</Heading>
					<Text mt="7px" fontSize="12px" color="app.subtleText">
						나의 투자 현황과 학습 진행도를 한눈에 확인하세요.
					</Text>
					{lastUpdatedAt && (
						<Text mt="5px" fontSize="10px" color="app.muted">
							마지막 갱신 {lastUpdatedAt.toLocaleString("ko-KR")}
						</Text>
					)}
				</Box>
				<Spacer />
				<Button
					size="sm"
					variant="outline"
					leftIcon={<RepeatIcon />}
					isLoading={isLoading}
					onClick={() => void loadMyPageData()}
				>
					새로고침
				</Button>
			</Flex>

			<Grid
				templateColumns={{ base: "1fr", xl: "540px minmax(0, 1fr)" }}
				gap="18px"
				mb="18px"
			>
				<Card>
					<CardBody p="22px">
						<Flex align="center" gap="22px">
							<Avatar
								size="xl"
								name={username}
								bg="#D9D9D9"
								color="gray.700"
							/>
							<Box minW="0">
								<Heading size="md" noOfLines={1}>
									{username}
								</Heading>
								<Stack
									mt="13px"
									spacing="7px"
									fontSize="12px"
									color="app.subtleText"
								>
									<Flex gap="18px">
										<Text minW="72px">계정 ID</Text>
										<Text fontWeight="700" noOfLines={1}>
											{account?.userId ?? "-"}
										</Text>
									</Flex>
									<Flex gap="18px">
										<Text minW="72px">계정 유형</Text>
										<Text fontWeight="700">
											모의투자 학습 계정
										</Text>
									</Flex>
								</Stack>
							</Box>
						</Flex>
					</CardBody>
				</Card>

				<Card>
					<CardBody p="20px 8px">
						<SimpleGrid
							columns={{ base: 2, md: 3, "2xl": 5 }}
							spacing="0"
						>
							<StatCell
								label="총 자산(국내 모의자산)"
								value={won.format(totalAsset)}
							/>
							<StatCell
								label="총 수익률"
								value={`${totalProfitRate >= 0 ? "+" : ""}${totalProfitRate.toFixed(2)}%`}
								accent={
									totalProfitRate >= 0 ? "positive" : "negative"
								}
							/>
							<StatCell
								label="총 수익"
								value={`${totalProfitLoss >= 0 ? "+" : ""}${won.format(totalProfitLoss)}`}
								accent={
									totalProfitLoss >= 0 ? "positive" : "negative"
								}
							/>
							<StatCell
								label="거래 횟수"
								value={`${filledOrders.length}회`}
							/>
							<StatCell
								label="보유종목"
								value={`${holdings.length}개`}
							/>
						</SimpleGrid>
					</CardBody>
				</Card>
			</Grid>

			<Grid
				templateColumns={{ base: "1fr", "2xl": "1.05fr 0.95fr" }}
				gap="18px"
				mb="18px"
			>
				<Card>
					<CardBody p={{ base: "18px", md: "24px" }}>
						<Heading size="sm" mb="18px">
							투자 성과 요약
						</Heading>
						<SimpleGrid
							columns={{ base: 3, md: 6 }}
							spacing="0"
							mb="14px"
						>
							{periodOptions.map((item) => (
								<Button
									key={item.key}
									size="sm"
									variant="outline"
									borderColor={
										period === item.key
											? "brand.500"
											: "app.border"
									}
									color={
										period === item.key
											? "brand.500"
											: "app.subtleText"
									}
									bg={
										period === item.key
											? "brand.50"
											: "transparent"
									}
									borderRadius="0"
									_first={{ borderLeftRadius: "7px" }}
									_last={{ borderRightRadius: "7px" }}
									onClick={() => setPeriod(item.key)}
								>
									{item.label}
								</Button>
							))}
						</SimpleGrid>
						<PerformanceChart
							orders={tradeOrders}
							initialCash={initialCash}
							period={period}
						/>
					</CardBody>
				</Card>

				<Card>
					<CardBody p={{ base: "18px", md: "24px" }}>
						<Flex align="center" mb="14px">
							<Heading size="sm">보유 종목 현황</Heading>
							<Spacer />
							<Text fontSize="11px" color="app.muted">
								전체 {holdings.length}개
							</Text>
						</Flex>
						<TableContainer>
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>종목</Th>
										<Th isNumeric>보유 수량</Th>
										<Th isNumeric>평가금액</Th>
										<Th isNumeric>수익률</Th>
									</Tr>
								</Thead>
								<Tbody>
									{holdings.slice(0, 5).map((holding) => (
										<Tr key={holding.id || holding.symbol}>
											<Td>
												<Text fontWeight="800">
													{holding.name}
												</Text>
												<Text fontSize="10px" color="app.muted">
													{holding.symbol}
												</Text>
											</Td>
											<Td isNumeric>
												{numberFormat.format(holding.quantity)}주
											</Td>
											<Td isNumeric>
												{won.format(getHoldingValue(holding))}
											</Td>
											<Td
												isNumeric
												fontWeight="800"
												color={
													holding.profitLossRate >= 0
														? "app.positive"
														: "app.negative"
												}
											>
												{holding.profitLossRate >= 0 ? "+" : ""}
												{holding.profitLossRate.toFixed(2)}%
											</Td>
										</Tr>
									))}
									{holdings.length === 0 && (
										<Tr>
											<Td
												colSpan={4}
												py="14"
												textAlign="center"
												color="app.muted"
											>
												보유 중인 종목이 없습니다.
											</Td>
										</Tr>
									)}
								</Tbody>
							</Table>
						</TableContainer>
						<Flex
							mt="14px"
							pt="14px"
							borderTopWidth="1px"
							borderColor="app.borderSoft"
						>
							<Text fontSize="12px" color="app.muted">
								전체 평가 금액
							</Text>
							<Spacer />
							<Text fontWeight="900">
								{won.format(stockEvaluationAmount)}
							</Text>
							<Box
								mx="22px"
								borderLeftWidth="1px"
								borderColor="app.borderSoft"
							/>
							<Text fontSize="12px" color="app.muted">
								총 수익률
							</Text>
							<Text
								ml="12px"
								fontWeight="900"
								color={
									totalProfitRate >= 0
										? "app.positive"
										: "app.negative"
								}
							>
								{totalProfitRate >= 0 ? "+" : ""}
								{totalProfitRate.toFixed(2)}%
							</Text>
						</Flex>
					</CardBody>
				</Card>
			</Grid>

			<Grid
				templateColumns={{ base: "1fr", "2xl": "0.85fr 1.15fr" }}
				gap="18px"
				mb="18px"
			>
				<Card>
					<CardBody p="22px">
						<Flex align="center" mb="12px">
							<Heading size="sm">최근 거래 기록</Heading>
							<Spacer />
							<Text fontSize="11px" color="app.muted">
								최근 {sortedOrders.length}건
							</Text>
						</Flex>
						<TableContainer>
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>체결 시간</Th>
										<Th>종목</Th>
										<Th>구분</Th>
										<Th isNumeric>수량</Th>
										<Th isNumeric>체결가</Th>
									</Tr>
								</Thead>
								<Tbody>
									{sortedOrders.slice(0, 6).map((order) => {
										const price = Number(
											order.executedPrice ??
												order.limitPrice ??
												order.orderPrice ??
												0,
										);
										return (
											<Tr key={order._id}>
												<Td whiteSpace="nowrap">
													{formatShortDate(
														order.executedAt ?? order.createdAt,
													)}
												</Td>
												<Td fontWeight="700">{order.name}</Td>
												<Td
													color={
														order.side === "BUY"
															? "app.positive"
															: "app.negative"
													}
													fontWeight="800"
												>
													{order.side === "BUY" ? "매수" : "매도"}
												</Td>
												<Td isNumeric>
													{numberFormat.format(order.quantity)}주
												</Td>
												<Td isNumeric>{won.format(price)}</Td>
											</Tr>
										);
									})}
									{sortedOrders.length === 0 && (
										<Tr>
											<Td
												colSpan={5}
												py="12"
												textAlign="center"
												color="app.muted"
											>
												거래 기록이 없습니다.
											</Td>
										</Tr>
									)}
								</Tbody>
							</Table>
						</TableContainer>
					</CardBody>
				</Card>

				<LearningProgressCard
					scenarioProgress={scenarioProgress}
					quizProgress={quizProgress}
					onScenarioClick={handleScenarioClick}
					onQuizClick={() => navigate("/quiz")}
				/>
			</Grid>

			<Grid
				templateColumns={{ base: "1fr", "2xl": "0.8fr 1.2fr" }}
				gap="18px"
				mb="18px"
			>
				<Card>
					<CardBody p="22px">
						<Heading size="sm" mb="18px">
							투자 통계
						</Heading>
						<Stack spacing="17px" fontSize="13px">
							<Flex>
								<Text color="app.muted">평균 수익률</Text>
								<Spacer />
								<Text
									color={
										averageHoldingRate >= 0
											? "app.positive"
											: "app.negative"
									}
									fontWeight="800"
								>
									{averageHoldingRate >= 0 ? "+" : ""}
									{averageHoldingRate.toFixed(2)}%
								</Text>
							</Flex>
							<Flex>
								<Text color="app.muted">평균 보유 종목 수</Text>
								<Spacer />
								<Text fontWeight="800">{holdings.length}개</Text>
							</Flex>
							<Flex>
								<Text color="app.muted">최고 수익률</Text>
								<Spacer />
								<Text color="app.positive" fontWeight="800">
									{bestHolding
										? `${
												bestHolding.profitLossRate >= 0 ? "+" : ""
											}${bestHolding.profitLossRate.toFixed(2)}%`
										: "-"}
								</Text>
							</Flex>
							<Flex>
								<Text color="app.muted">최대 손실률</Text>
								<Spacer />
								<Text color="app.negative" fontWeight="800">
									{worstHolding
										? `${worstHolding.profitLossRate.toFixed(2)}%`
										: "-"}
								</Text>
							</Flex>
							<Flex>
								<Text color="app.muted">손익비</Text>
								<Spacer />
								<Text fontWeight="800">
									{Math.max(0, totalProfitRate + 100).toFixed(1)}
								</Text>
							</Flex>
							<Flex>
								<Text color="app.muted">최대 거래 종목</Text>
								<Spacer />
								<Text fontWeight="800">
									{largestHolding?.name ?? "-"}
								</Text>
							</Flex>
						</Stack>
					</CardBody>
				</Card>

				<Card>
					<CardBody p="22px">
						<Heading size="sm">AI 라면 ?</Heading>
						<Box
							mt="14px"
							p="18px"
							borderWidth="1px"
							borderColor="app.border"
							borderRadius="8px"
						>
							<Text fontSize="12px" color="app.muted">
								최근 투자 현황을 기준으로 분석했습니다.
							</Text>
							<Stack mt="16px" spacing="16px">
								<Box>
									<Text fontSize="13px" fontWeight="900">
										•{" "}
										{largestWeight > 45
											? "특정 종목 비중이 높은 편이에요."
											: "분산 투자 비중이 안정적이에요."}
									</Text>
									<Text
										mt="5px"
										fontSize="12px"
										color="app.subtleText"
									>
										{largestHolding
											? `${largestHolding.name} 비중이 ${largestWeight.toFixed(1)}%입니다.`
											: "보유 종목이 등록되지 않았습니다."}
									</Text>
								</Box>
								<Box>
									<Text fontSize="13px" fontWeight="900">
										•{" "}
										{cashRatio < 10
											? "현금 여유 비중을 점검해보세요."
											: "현금 비중을 확보하고 있어요."}
									</Text>
									<Text
										mt="5px"
										fontSize="12px"
										color="app.subtleText"
									>
										현재 현금 비중은 {cashRatio.toFixed(1)}%입니다.
									</Text>
								</Box>
							</Stack>
						</Box>
						<Button
							mt="12px"
							w="100%"
							size="sm"
							variant="outline"
							onClick={() => navigate("/exchange")}
						>
							AI 분석 자세히 보기
						</Button>
					</CardBody>
				</Card>
			</Grid>

			<Card mb="18px">
				<CardBody p="22px">
					<Heading size="sm" mb="18px">
						시뮬레이션 요약
					</Heading>
					<SimpleGrid columns={{ base: 2, md: 4 }} spacing="0">
						<StatCell
							label="누적 수익률"
							value={`${totalProfitRate >= 0 ? "+" : ""}${totalProfitRate.toFixed(2)}%`}
							accent={
								totalProfitRate >= 0 ? "positive" : "negative"
							}
						/>
						<StatCell
							label="누적 수익금"
							value={`${totalProfitLoss >= 0 ? "+" : ""}${formatCompactWon(totalProfitLoss)}`}
							accent={
								totalProfitLoss >= 0 ? "positive" : "negative"
							}
						/>
						<StatCell
							label="거래 횟수"
							value={`${filledOrders.length}회`}
						/>
						<StatCell label="보유 현금" value={won.format(cash)} />
					</SimpleGrid>
				</CardBody>
			</Card>

			<Box mt="20px">
				<UsPortfolioMyPageSection />
			</Box>
		</Box>
	);
}
