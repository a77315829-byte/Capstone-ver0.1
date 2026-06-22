import React, {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	CardHeader,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	SimpleGrid,
	Skeleton,
	Spacer,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
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
import MilitaryProfileCard from "../components/profile/MilitaryProfileCard";
import UsPortfolioMyPageSection from "../components/profile/UsPortfolioMyPageSection";

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

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ko-KR");

const sideLabel: Record<TradingOrderSide, string> = {
	BUY: "매수",
	SELL: "매도",
};

const sideColor: Record<TradingOrderSide, string> = {
	BUY: "red",
	SELL: "blue",
};

const statusLabel: Record<TradingOrderStatus, string> = {
	PENDING: "미체결",
	FILLED: "체결",
	CANCELED: "취소",
	REJECTED: "거절",
};

const statusColor: Record<TradingOrderStatus, string> = {
	PENDING: "orange",
	FILLED: "green",
	CANCELED: "gray",
	REJECTED: "red",
};

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

function formatDateTime(value?: string | null): string {
	if (!value) {
		return "-";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function getHoldingValue(
	holding: PortfolioHolding,
): number {
	return Number(
		holding.evaluationAmount ??
			holding.quantity * holding.currentPrice,
	);
}

function DonutChart({
	cash,
	holdings,
}: {
	cash: number;
	holdings: PortfolioHolding[];
}) {
	const size = 300;
	const strokeWidth = 28;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	const colors = [
		"#CBD5E0",
		"#3182CE",
		"#E53E3E",
		"#38A169",
		"#D69E2E",
		"#805AD5",
		"#DD6B20",
	];

	const items = [
		{
			label: "현금",
			value: Math.max(0, cash),
			color: colors[0] ?? "#CBD5E0",
		},
		...holdings.map((holding, index) => ({
			label: holding.name,
			value: Math.max(0, getHoldingValue(holding)),
			color:
				colors[(index + 1) % colors.length] ??
				"#3182CE",
		})),
	].filter((item) => item.value > 0);

	const total = items.reduce(
		(sum, item) => sum + item.value,
		0,
	);

	let accumulated = 0;

	if (total <= 0) {
		return (
			<Flex
				minH="250px"
				align="center"
				justify="center"
			>
				<Text color="gray.500">
					포트폴리오 데이터가 없습니다.
				</Text>
			</Flex>
		);
	}

	return (
		<Flex
			direction={{ base: "column", md: "row" }}
			gap="6"
			align="center"
		>
			<Box
				position="relative"
				w={`${size}px`}
				h={`${size}px`}
				maxW="100%"
			>
				<svg
					width="100%"
					height="100%"
					viewBox={`0 0 ${size} ${size}`}
				>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="#EDF2F7"
						strokeWidth={strokeWidth}
					/>

					{items.map((item) => {
						const ratio = item.value / total;
						const dash = ratio * circumference;
						const gap = circumference - dash;
						const offset =
							-accumulated * circumference;

						accumulated += ratio;

						return (
							<circle
								key={`${item.label}-${item.color}`}
								cx={size / 2}
								cy={size / 2}
								r={radius}
								fill="none"
								stroke={item.color}
								strokeWidth={strokeWidth}
								strokeDasharray={`${dash} ${gap}`}
								strokeDashoffset={offset}
								strokeLinecap="round"
								transform={`rotate(-90 ${size / 2} ${size / 2})`}
							/>
						);
					})}
				</svg>

				<Flex
					position="absolute"
					inset="0"
					align="center"
					justify="center"
					direction="column"
				>
					<Text fontSize="sm" color="gray.500">
						총 자산
					</Text>
					<Text
						fontWeight="900"
						fontSize="lg"
					>
						{won.format(total)}
					</Text>
				</Flex>
			</Box>

			<Stack spacing="3" flex="1" w="100%">
				{items.map((item) => {
					const ratio =
						total > 0
							? (item.value / total) * 100
							: 0;

					return (
						<Flex
							key={`legend-${item.label}-${item.color}`}
							align="center"
						>
							<Box
								w="12px"
								h="12px"
								borderRadius="full"
								bg={item.color}
								mr="2"
								flexShrink={0}
							/>

							<Text
								fontSize="sm"
								fontWeight="800"
								noOfLines={1}
							>
								{item.label}
							</Text>

							<Spacer />

							<Text
								fontSize="sm"
								color="gray.500"
								mr="3"
							>
								{ratio.toFixed(1)}%
							</Text>

							<Text
								fontSize="sm"
								fontWeight="900"
								whiteSpace="nowrap"
							>
								{won.format(item.value)}
							</Text>
						</Flex>
					);
				})}
			</Stack>
		</Flex>
	);
}

export default function MyPage() {
	const toast = useToast();
	const navigate = useNavigate();

	const [portfolio, setPortfolio] =
		useState<PortfolioData | null>(null);
	const [tradeOrders, setTradeOrders] =
		useState<TradeOrderData[]>([]);
	const [isLoading, setIsLoading] =
		useState(true);
	const [lastUpdatedAt, setLastUpdatedAt] =
		useState<Date | null>(null);

	const loadMyPageData = useCallback(async () => {
		try {
			setIsLoading(true);

			const [portfolioResponse, orderResponse] =
				await Promise.all([
					api.get(
						"/trading/portfolio?evaluate=true",
					),
					api.get(
						"/trading/orders?limit=50",
					),
				]);

			const portfolioData =
				unwrapApiData<PortfolioData>(
					portfolioResponse.data,
				);

			const orderData =
				unwrapApiData<TradeOrderData[]>(
					orderResponse.data,
				);

			setPortfolio({
				account: portfolioData.account,
				holdings: Array.isArray(
					portfolioData.holdings,
				)
					? portfolioData.holdings
					: [],
			});

			setTradeOrders(
				Array.isArray(orderData)
					? orderData
					: [],
			);

			setLastUpdatedAt(new Date());
		} catch (error: any) {
			console.error(
				"마이페이지 데이터 조회 실패:",
				error,
			);

			if (error?.response?.status === 401) {
				toast({
					title: "로그인이 필요합니다.",
					description:
						"로그인 후 개인 포트폴리오를 확인할 수 있습니다.",
					status: "warning",
					duration: 2500,
					isClosable: true,
				});

				navigate("/login", {
					replace: true,
				});
				return;
			}

			toast({
				title:
					"포트폴리오를 불러오지 못했습니다.",
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
	}, [navigate, toast]);

	useEffect(() => {
		void loadMyPageData();
	}, [loadMyPageData]);

	const account = portfolio?.account;
	const holdings = portfolio?.holdings ?? [];

	const cash = Number(account?.cash ?? 0);

	const stockEvaluationAmount = useMemo(
		() =>
			Number(
				account?.totalEvaluationAmount ??
					holdings.reduce(
						(sum, holding) =>
							sum +
							getHoldingValue(holding),
						0,
					),
			),
		[
			account?.totalEvaluationAmount,
			holdings,
		],
	);

	const totalAsset = Number(
		account?.totalAsset ??
			cash + stockEvaluationAmount,
	);

	const initialCash = Number(
		account?.initialCash ?? 0,
	);

	const totalProfitLoss = Number(
		account?.totalProfitLoss ??
			totalAsset - initialCash,
	);

	const totalProfitRate = Number(
		account?.totalProfitLossRate ??
			(initialCash > 0
				? (totalProfitLoss / initialCash) *
					100
				: 0),
	);

	const sortedOrders = useMemo(
		() =>
			[...tradeOrders].sort(
				(first, second) =>
					new Date(
						second.createdAt,
					).getTime() -
					new Date(
						first.createdAt,
					).getTime(),
			),
		[tradeOrders],
	);

	return (
		<Box
			px={{ base: 4, md: 8 }}
			py="6"
			bg="gray.50"
			minH="100vh"
		>
			<Flex
				align={{
					base: "flex-start",
					md: "center",
				}}
				direction={{
					base: "column",
					md: "row",
				}}
				gap="3"
				mb="6"
			>
				<Box>
					<Heading size="lg">
						마이페이지
					</Heading>
					<Text mt="1" color="gray.500">
						로그인 계정의 실시간 모의투자
						자산과 거래 기록을 확인합니다.
					</Text>

					{lastUpdatedAt && (
						<Text
							mt="1"
							fontSize="xs"
							color="gray.400"
						>
							마지막 갱신:{" "}
							{lastUpdatedAt.toLocaleString(
								"ko-KR",
							)}
						</Text>
					)}
				</Box>

				<Spacer />

				<Button
					size="sm"
					variant="outline"
					leftIcon={<RepeatIcon />}
					isLoading={isLoading}
					onClick={() =>
						void loadMyPageData()
					}
				>
					새로고침
				</Button>
			</Flex>

			<MilitaryProfileCard />

			{isLoading && !portfolio ? (
				<Stack spacing="4">
					<SimpleGrid
						columns={{
							base: 1,
							md: 2,
							xl: 5,
						}}
						spacing="4"
					>
						{Array.from({
							length: 5,
						}).map((_, index) => (
							<Skeleton
								key={index}
								h="118px"
								borderRadius="12px"
							/>
						))}
					</SimpleGrid>

					<Skeleton
						h="380px"
						borderRadius="12px"
					/>
					<Skeleton
						h="280px"
						borderRadius="12px"
					/>
				</Stack>
			) : (
				<>
					<SimpleGrid
						columns={{
							base: 1,
							md: 2,
							xl: 5,
						}}
						spacing="4"
						mb="5"
					>
						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										총 보유자산
									</StatLabel>
									<StatNumber>
										{won.format(
											totalAsset,
										)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										현금 잔액
									</StatLabel>
									<StatNumber>
										{won.format(cash)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										주식 평가금액
									</StatLabel>
									<StatNumber>
										{won.format(
											stockEvaluationAmount,
										)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										총 평가손익
									</StatLabel>
									<StatNumber
										color={
											totalProfitLoss >= 0
												? "red.500"
												: "blue.500"
										}
									>
										{totalProfitLoss > 0
											? "+"
											: ""}
										{won.format(
											totalProfitLoss,
										)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										총 수익률
									</StatLabel>
									<StatNumber
										color={
											totalProfitRate >= 0
												? "red.500"
												: "blue.500"
										}
									>
										{totalProfitRate > 0
											? "+"
											: ""}
										{totalProfitRate.toFixed(
											2,
										)}
										%
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>
					</SimpleGrid>

					<Grid
						templateColumns={{
							base: "1fr",
							xl: "minmax(360px, 560px) 1fr",
						}}
						gap="5"
						mb="5"
					>
						<GridItem>
							<Card h="100%">
								<CardHeader pb="0">
									<Heading size="md">
										보유자산 포트폴리오
									</Heading>
									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										현금과 현재 주식
										평가금액을 기준으로
										자산 비중을
										보여줍니다.
									</Text>
								</CardHeader>

								<CardBody>
									<DonutChart
										cash={cash}
										holdings={
											holdings
										}
									/>
								</CardBody>
							</Card>
						</GridItem>

						<GridItem>
							<Card h="100%">
								<CardHeader pb="0">
									<Heading size="md">
										보유 종목
									</Heading>
									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										실시간 모의투자
										계좌에 보유 중인
										종목입니다.
									</Text>
								</CardHeader>

								<CardBody>
									<TableContainer>
										<Table size="sm">
											<Thead>
												<Tr>
													<Th>
														종목
													</Th>
													<Th
														isNumeric
													>
														수량
													</Th>
													<Th
														isNumeric
													>
														평균단가
													</Th>
													<Th
														isNumeric
													>
														현재가
													</Th>
													<Th
														isNumeric
													>
														평가금액
													</Th>
													<Th
														isNumeric
													>
														평가손익
													</Th>
													<Th
														isNumeric
													>
														수익률
													</Th>
												</Tr>
											</Thead>

											<Tbody>
												{holdings.map(
													(
														holding,
													) => (
														<Tr
															key={
																holding.id ||
																holding.symbol
															}
														>
															<Td>
																<Text fontWeight="900">
																	{
																		holding.name
																	}
																</Text>
																<Text
																	fontSize="xs"
																	color="gray.500"
																>
																	{
																		holding.symbol
																	}
																	{" · "}
																	{
																		holding.market
																	}
																</Text>
															</Td>

															<Td
																isNumeric
															>
																{numberFormat.format(
																	holding.quantity,
																)}
															</Td>

															<Td
																isNumeric
															>
																{won.format(
																	holding.avgPrice,
																)}
															</Td>

															<Td
																isNumeric
															>
																{won.format(
																	holding.currentPrice,
																)}
															</Td>

															<Td
																isNumeric
															>
																{won.format(
																	getHoldingValue(
																		holding,
																	),
																)}
															</Td>

															<Td
																isNumeric
																fontWeight="800"
																color={
																	holding.profitLoss >=
																	0
																		? "red.500"
																		: "blue.500"
																}
															>
																{holding.profitLoss >
																0
																	? "+"
																	: ""}
																{won.format(
																	holding.profitLoss,
																)}
															</Td>

															<Td
																isNumeric
																fontWeight="900"
																color={
																	holding.profitLossRate >=
																	0
																		? "red.500"
																		: "blue.500"
																}
															>
																{holding.profitLossRate >
																0
																	? "+"
																	: ""}
																{holding.profitLossRate.toFixed(
																	2,
																)}
																%
															</Td>
														</Tr>
													),
												)}

												{holdings.length ===
													0 && (
													<Tr>
														<Td
															colSpan={
																7
															}
															textAlign="center"
															py="12"
															color="gray.500"
														>
															보유 중인
															종목이
															없습니다.
														</Td>
													</Tr>
												)}
											</Tbody>
										</Table>
									</TableContainer>
								</CardBody>
							</Card>
						</GridItem>
					</Grid>

					<Card>
						<CardHeader pb="0">
							<Flex align="center">
								<Box>
									<Heading size="md">
										실시간 모의투자
										주문 기록
									</Heading>
									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										현재 로그인 계정에서
										등록한 최근 주문
										기록입니다.
									</Text>
								</Box>

								<Spacer />

								<Badge
									colorScheme="gray"
									fontSize="sm"
								>
									최근{" "}
									{sortedOrders.length}
									건
								</Badge>
							</Flex>
						</CardHeader>

						<CardBody>
							<TableContainer>
								<Table size="sm">
									<Thead>
										<Tr>
											<Th>
												구분
											</Th>
											<Th>
												상태
											</Th>
											<Th>
												종목
											</Th>
											<Th>
												주문방식
											</Th>
											<Th
												isNumeric
											>
												주문수량
											</Th>
											<Th
												isNumeric
											>
												체결수량
											</Th>
											<Th
												isNumeric
											>
												가격
											</Th>
											<Th
												isNumeric
											>
												거래금액
											</Th>
											<Th>
												일시
											</Th>
										</Tr>
									</Thead>

									<Tbody>
										{sortedOrders.map(
											(order) => {
												const displayPrice =
													Number(
														order.executedPrice ??
															order.limitPrice ??
															order.orderPrice ??
															0,
													);

												const displayQuantity =
													order.status ===
													"FILLED"
														? Number(
																order.filledQuantity ??
																	order.quantity,
															)
														: Number(
																order.quantity,
															);

												const totalAmount =
													displayPrice *
													displayQuantity;

												return (
													<Tr
														key={
															order._id
														}
													>
														<Td>
															<Badge
																colorScheme={
																	sideColor[
																		order
																			.side
																	]
																}
															>
																{
																	sideLabel[
																		order
																			.side
																	]
																}
															</Badge>
														</Td>

														<Td>
															<Badge
																colorScheme={
																	statusColor[
																		order
																			.status
																	]
																}
																variant="subtle"
															>
																{
																	statusLabel[
																		order
																			.status
																	]
																}
															</Badge>
														</Td>

														<Td>
															<Text fontWeight="900">
																{
																	order.name
																}
															</Text>
															<Text
																fontSize="xs"
																color="gray.500"
															>
																{
																	order.symbol
																}
																{" · "}
																{
																	order.market
																}
															</Text>
														</Td>

														<Td>
															{order.orderType ===
															"MARKET"
																? "시장가"
																: "지정가"}
														</Td>

														<Td
															isNumeric
														>
															{numberFormat.format(
																order.quantity,
															)}
														</Td>

														<Td
															isNumeric
														>
															{numberFormat.format(
																order.filledQuantity,
															)}
														</Td>

														<Td
															isNumeric
														>
															{won.format(
																displayPrice,
															)}
														</Td>

														<Td
															isNumeric
															fontWeight="800"
														>
															{won.format(
																totalAmount,
															)}
														</Td>

														<Td
															whiteSpace="nowrap"
															fontSize="xs"
															color="gray.500"
														>
															{formatDateTime(
																order.executedAt ??
																	order.createdAt,
															)}
														</Td>
													</Tr>
												);
											},
										)}

										{sortedOrders.length ===
											0 && (
											<Tr>
												<Td
													colSpan={9}
													textAlign="center"
													py="12"
													color="gray.500"
												>
													주문 기록이
													없습니다.
												</Td>
											</Tr>
										)}
									</Tbody>
								</Table>
							</TableContainer>
						</CardBody>
					</Card>

					<UsPortfolioMyPageSection />
				</>
			)}
		</Box>
	);
}
