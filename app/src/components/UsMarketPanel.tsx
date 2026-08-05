import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	CardHeader,
	Divider,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	Input,
	NumberInput,
	NumberInputField,
	SimpleGrid,
	Spacer,
	Spinner,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Table,
	TableContainer,
	Tabs,
	TabList,
	TabPanels,
	Tab,
	TabPanel,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useToast,
} from "@chakra-ui/react";

import {
	CandlestickData,
	createChart,
	HistogramData,
	IChartApi,
} from "lightweight-charts";

import api from "../services/api.service";

import RelatedFinancialTerms from "../components/RelatedFinancialTerms";

import type {
	UsChartPoint,
	UsExchangeCode,
	UsHolding,
	UsMarketStatus,
	UsOrderSide,
	UsOrderStatus,
	UsOrderType,
	UsPortfolio,
	UsSearchResult,
	UsStockQuote,
	UsTradeOrder,
} from "../types/usMarket.types";

type UsChartPeriod =
	| "1m"
	| "6m"
	| "1y";

type UsOrderPanelMode =
	| "BUY"
	| "SELL"
	| "MANAGE";

type UsDetailSection =
	| "information"
	| "holdings"
	| "orders";

const usd =
	new Intl.NumberFormat(
		"en-US",
		{
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		},
	);

const numberFormat =
	new Intl.NumberFormat(
		"en-US",
	);

const compactUsd =
	new Intl.NumberFormat(
		"en-US",
		{
			style: "currency",
			currency: "USD",
			notation: "compact",
			maximumFractionDigits: 2,
		},
	);

function formatRatio(
	value?: number | null,
): string {
	const number =
		Number(value ?? 0);

	return Number.isFinite(number) &&
		number !== 0
		? number.toFixed(2)
		: "-";
}

function formatUsdOrDash(
	value?: number | null,
): string {
	const number =
		Number(value ?? 0);

	return Number.isFinite(number) &&
		number !== 0
		? usd.format(number)
		: "-";
}

const sideLabel:
	Record<UsOrderSide, string> = {
	BUY: "매수",
	SELL: "매도",
};

const statusLabel:
	Record<UsOrderStatus, string> = {
	PENDING: "미체결",
	FILLED: "체결",
	CANCELED: "취소",
	REJECTED: "거절",
};

const statusColor:
	Record<UsOrderStatus, string> = {
	PENDING: "orange",
	FILLED: "green",
	CANCELED: "gray",
	REJECTED: "red",
};

function unwrapApiData<T>(
	raw: unknown,
): T {
	const value =
		raw as {
			success?: boolean;
			data?: T;
			output?: T;
		};

	if (
		value?.success === true &&
		value.data !== undefined
	) {
		return value.data;
	}

	if (
		value?.data !==
		undefined
	) {
		return value.data;
	}

	if (
		value?.output !==
		undefined
	) {
		return value.output;
	}

	return raw as T;
}

function formatDateTime(
	value?: string | null,
): string {
	if (!value) {
		return "-";
	}

	const date =
		new Date(value);

	if (
		Number.isNaN(
			date.getTime(),
		)
	) {
		return value;
	}

	return date.toLocaleString(
		"ko-KR",
		{
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		},
	);
}

function UsCandlestickChart({
	data,
	height = 340,
}: {
	data: UsChartPoint[];
	height?: number;
}) {
	const containerRef =
		useRef<HTMLDivElement | null>(
			null,
		);

	const chartRef =
		useRef<IChartApi | null>(
			null,
		);

	useEffect(() => {
		if (
			!containerRef.current
		) {
			return;
		}

		containerRef.current.innerHTML =
			"";

		if (data.length === 0) {
			return;
		}

		const chart =
			createChart(
				containerRef.current,
				{
					width:
						containerRef
							.current
							.clientWidth,
					height,
					layout: {
						background: {
							color:
								"#ffffff",
						},
						textColor:
							"#1A202C",
					},
					grid: {
						vertLines: {
							color:
								"#edf2f7",
						},
						horzLines: {
							color:
								"#edf2f7",
						},
					},
					rightPriceScale: {
						borderColor:
							"#e2e8f0",
					},
					timeScale: {
						borderColor:
							"#e2e8f0",
						timeVisible:
							false,
					},
				},
			);

		chartRef.current =
			chart;

		const candles =
			chart.addCandlestickSeries(
				{
					upColor:
						"#38A169",
					downColor:
						"#E53E3E",
					borderUpColor:
						"#38A169",
					borderDownColor:
						"#E53E3E",
					wickUpColor:
						"#38A169",
					wickDownColor:
						"#E53E3E",
				},
			);

		const volume =
			chart.addHistogramSeries(
				{
					priceFormat: {
						type:
							"volume",
					},
					priceScaleId:
						"",
				},
			);

		volume
			.priceScale()
			.applyOptions({
				scaleMargins: {
					top: 0.82,
					bottom: 0,
				},
			});

		candles.setData(
			data.map(
				(point) => ({
					time:
						point.time as any,
					open:
						point.open,
					high:
						point.high,
					low:
						point.low,
					close:
						point.close,
				}),
			) as CandlestickData[],
		);

		volume.setData(
			data.map(
				(point) => ({
					time:
						point.time as any,
					value:
						point.volume ||
						0,
					color:
						point.close >=
						point.open
							? "#38A169"
							: "#E53E3E",
				}),
			) as HistogramData[],
		);

		chart
			.timeScale()
			.fitContent();

		const resizeObserver =
			new ResizeObserver(
				(entries) => {
					const entry =
						entries[0];

					if (!entry) {
						return;
					}

					chart.applyOptions({
						width:
							entry
								.contentRect
								.width,
					});
				},
			);

		resizeObserver.observe(
			containerRef.current,
		);

		return () => {
			resizeObserver.disconnect();
			chart.remove();
			chartRef.current =
				null;
		};
	}, [
		data,
		height,
	]);

	if (data.length === 0) {
		return (
			<Flex
				h={`${height}px`}
				align="center"
				justify="center"
				color="gray.500"
			>
				차트 데이터가 없습니다.
			</Flex>
		);
	}

	return (
		<Box
			ref={containerRef}
			w="100%"
			h={`${height}px`}
		/>
	);
}


function UsStockDetailPanel({
	quote,
	isLoading,
}: {
	quote:
		| UsStockQuote
		| null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<Flex
				h="320px"
				align="center"
				justify="center"
			>
				<Spinner />
			</Flex>
		);
	}

	if (!quote) {
		return (
			<Flex
				h="260px"
				align="center"
				justify="center"
				color="gray.500"
			>
				종목 상세정보를 불러오지 못했습니다.
			</Flex>
		);
	}

	const isEtf =
		quote.assetType === "ETF";

	return (
		<Stack spacing="5">
			<Box>
				<Flex
					align="center"
					gap="2"
					wrap="wrap"
				>
					<Heading size="md">
						{quote.name}
					</Heading>

					<Badge
						colorScheme={
							isEtf
								? "teal"
								: "blue"
						}
					>
						{isEtf
							? "ETF"
							: "주식"}
					</Badge>
				</Flex>

				<Text
					mt="1"
					fontSize="sm"
					color="gray.500"
				>
					{quote.symbol}
					{" · "}
					{quote.market}
					{" · "}
					{quote.longName}
				</Text>
			</Box>

			<Box
				p="4"
				borderWidth="1px"
				borderRadius="lg"
				bg="gray.50"
			>
				<Text
					fontWeight="900"
					mb="2"
				>
					{isEtf
						? "ETF 설명"
						: "기업 설명"}
				</Text>

				<Text
					color="gray.700"
					lineHeight="1.8"
				>
					{quote.summary ??
						(isEtf
							? "여러 종목에 분산 투자하도록 설계된 미국 상장지수펀드입니다."
							: "미국 증시에 상장된 기업입니다. 가격 흐름뿐 아니라 수익성과 기업가치 지표를 함께 확인하세요.")}
				</Text>
			</Box>

			{isEtf ? (
				<SimpleGrid
					columns={{
						base: 1,
						md: 3,
					}}
					spacing="4"
				>
					<Box
						p="4"
						borderWidth="1px"
						borderRadius="lg"
					>
						<Text
							fontSize="sm"
							color="gray.500"
						>
							ETF 분류
						</Text>
						<Text
							mt="1"
							fontWeight="900"
						>
							{quote.category ??
								quote.etpTypeName ??
								"미국 ETF"}
						</Text>
					</Box>

					<Box
						p="4"
						borderWidth="1px"
						borderRadius="lg"
					>
						<Text
							fontSize="sm"
							color="gray.500"
						>
							추종 지수
						</Text>
						<Text
							mt="1"
							fontWeight="900"
						>
							{quote.benchmark ??
								"정보 없음"}
						</Text>
					</Box>

					<Box
						p="4"
						borderWidth="1px"
						borderRadius="lg"
					>
						<Text
							fontSize="sm"
							color="gray.500"
						>
							운용사
						</Text>
						<Text
							mt="1"
							fontWeight="900"
						>
							{quote.issuer ??
								"정보 없음"}
						</Text>
					</Box>
				</SimpleGrid>
			) : (
				<SimpleGrid
					columns={{
						base: 2,
						md: 4,
					}}
					spacing="4"
				>
					<Stat>
						<StatLabel>
							시가총액
						</StatLabel>
						<StatNumber fontSize="lg">
							{Number(
								quote.marketCap ??
									0,
							) > 0
								? compactUsd.format(
										Number(
											quote.marketCap,
										),
									)
								: "-"}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>PER</StatLabel>
						<StatNumber fontSize="lg">
							{formatRatio(
								quote.per,
							)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>PBR</StatLabel>
						<StatNumber fontSize="lg">
							{formatRatio(
								quote.pbr,
							)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>EPS</StatLabel>
						<StatNumber fontSize="lg">
							{formatUsdOrDash(
								quote.eps,
							)}
						</StatNumber>
					</Stat>
				</SimpleGrid>
			)}

			<SimpleGrid
				columns={{
					base: 2,
					md: 4,
				}}
				spacing="4"
			>
				<Stat>
					<StatLabel>
						52주 최고
					</StatLabel>
					<StatNumber fontSize="lg">
						{formatUsdOrDash(
							quote.fiftyTwoWeekHigh,
						)}
					</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>
						52주 최저
					</StatLabel>
					<StatNumber fontSize="lg">
						{formatUsdOrDash(
							quote.fiftyTwoWeekLow,
						)}
					</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>
						거래량
					</StatLabel>
					<StatNumber fontSize="lg">
						{numberFormat.format(
							quote.volume,
						)}
					</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>
						전일 종가
					</StatLabel>
					<StatNumber fontSize="lg">
						{usd.format(
							quote.previousClose,
						)}
					</StatNumber>
				</Stat>
			</SimpleGrid>

			<Text
				fontSize="xs"
				color="gray.500"
			>
				※ PER·PBR·EPS·시가총액은 KIS 현재가상세 API가 제공한 경우에만 표시됩니다.
			</Text>
		</Stack>
	);
}

function UsPriceHistoryTable({
	data,
}: {
	data: UsChartPoint[];
}) {
	const recentData =
		[...data]
			.sort(
				(a, b) =>
					b.time -
					a.time,
			)
			.slice(0, 8);

	return (
		<Box>
			<Flex
				align="center"
				mb="3"
			>
				<Box>
					<Heading size="sm">
						가격 기록
					</Heading>
					<Text
						fontSize="xs"
						color="gray.500"
					>
						현재 차트 데이터 기준
					</Text>
				</Box>
			</Flex>

			<TableContainer>
				<Table size="sm">
					<Thead>
						<Tr>
							<Th>날짜</Th>
							<Th isNumeric>
								종가
							</Th>
							<Th isNumeric>
								거래량
							</Th>
						</Tr>
					</Thead>

					<Tbody>
						{recentData.map(
							(point) => (
								<Tr
									key={
										point.time
									}
								>
									<Td>
										{new Date(
											point.time *
												1000,
										).toLocaleDateString(
											"ko-KR",
										)}
									</Td>
									<Td isNumeric>
										{usd.format(
											point.close,
										)}
									</Td>
									<Td isNumeric>
										{numberFormat.format(
											point.volume,
										)}
									</Td>
								</Tr>
							),
						)}

						{recentData.length ===
							0 && (
							<Tr>
								<Td
									colSpan={3}
									textAlign="center"
									py="8"
									color="gray.500"
								>
									가격 기록이 없습니다.
								</Td>
							</Tr>
						)}
					</Tbody>
				</Table>
			</TableContainer>
		</Box>
	);
}

function UsDetailSelectorCard({
	title,
	description,
	selected,
	onClick,
	children,
}: {
	title: string;
	description: string;
	selected: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Card
			as="button"
			type="button"
			w="100%"
			minH="210px"
			textAlign="left"
			borderWidth="1px"
			borderColor={
				selected
					? "brand.500"
					: "app.borderSoft"
			}
			bg="white"
			boxShadow={
				selected
					? "0 10px 28px rgba(242, 100, 56, 0.10)"
					: "0 8px 24px rgba(73, 52, 30, 0.04)"
			}
			cursor="pointer"
			transition="border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease"
			_hover={{
				borderColor: "brand.400",
				transform: "translateY(-1px)",
			}}
			onClick={onClick}
		>
			<CardHeader pb="2">
				<Flex align="center">
					<Box>
						<Heading
							size="sm"
							color={
								selected
									? "brand.600"
									: "app.text"
							}
						>
							{title}
						</Heading>
						<Text
							mt="1"
							fontSize="10px"
							color="app.subtleText"
						>
							{description}
						</Text>
					</Box>
					<Spacer />
					{selected && (
						<Badge
							bg="orange.50"
							color="brand.600"
							borderRadius="full"
						>
							선택됨
						</Badge>
					)}
				</Flex>
			</CardHeader>
			<CardBody pt="2">
				{children}
			</CardBody>
		</Card>
	);
}

interface UsMarketPanelProps {
	onStockChange?: (
		stock: {
			symbol: string;
			name: string;
			market: string;
		},
	) => void;
}

export default function UsMarketPanel({
	onStockChange,
}: UsMarketPanelProps) {
	const toast =
		useToast();

	const [
		selectedSymbol,
		setSelectedSymbol,
	] = useState("NVDA");

	const [
		selectedExchange,
		setSelectedExchange,
	] =
		useState<UsExchangeCode>(
			"NAS",
		);

	const [
		searchQuery,
		setSearchQuery,
	] = useState("");

	const [
		searchResults,
		setSearchResults,
	] = useState<
		UsSearchResult[]
	>([]);

	const [
		quote,
		setQuote,
	] =
		useState<UsStockQuote | null>(
			null,
		);

	useEffect(() => {
		const symbol =
			quote?.symbol ??
			selectedSymbol;

		if (!symbol) {
			return;
		}

		onStockChange?.({
			symbol,
			name:
				quote?.name ??
				symbol,
			market:
				quote?.market ??
				(
					selectedExchange ===
					"NAS"
						? "NASDAQ"
						: selectedExchange ===
							  "NYS"
							? "NYSE"
							: "AMEX"
				),
		});
	}, [
		onStockChange,
		selectedSymbol,
		selectedExchange,
		quote?.symbol,
		quote?.name,
		quote?.market,
	]);


	const [
		chartData,
		setChartData,
	] = useState<
		UsChartPoint[]
	>([]);

	const [
		chartPeriod,
		setChartPeriod,
	] =
		useState<UsChartPeriod>(
			"1m",
		);

	const [
		marketStatus,
		setMarketStatus,
	] =
		useState<UsMarketStatus | null>(
			null,
		);

	const [
		portfolio,
		setPortfolio,
	] =
		useState<UsPortfolio | null>(
			null,
		);

	const [
		orders,
		setOrders,
	] = useState<
		UsTradeOrder[]
	>([]);

	const [
		orderType,
		setOrderType,
	] =
		useState<UsOrderType>(
			"LIMIT",
		);

	const [
		orderPanelMode,
		setOrderPanelMode,
	] =
		useState<UsOrderPanelMode>(
			"BUY",
		);

	const [
		detailSection,
		setDetailSection,
	] =
		useState<UsDetailSection>(
			"information",
		);

	const [
		quantity,
		setQuantity,
	] = useState(1);

	const [
		limitPrice,
		setLimitPrice,
	] = useState(0);

	const [
		isLoadingQuote,
		setIsLoadingQuote,
	] = useState(false);

	const [
		isLoadingChart,
		setIsLoadingChart,
	] = useState(false);

	const [
		isLoadingTrading,
		setIsLoadingTrading,
	] = useState(false);

	const [
		isToppingUp,
		setIsToppingUp,
	] = useState(false);

	const [
		isSearching,
		setIsSearching,
	] = useState(false);

	const [
		isSubmitting,
		setIsSubmitting,
	] = useState(false);

	const isMarketClosed =
		!marketStatus?.isOpen &&
		!marketStatus
			?.orderAllowedByOverride;

	const isMarketOrderBlocked =
		orderType === "MARKET" &&
		isMarketClosed;

	const selectedHolding =
		useMemo(
			() =>
				portfolio
					?.holdings
					.find(
						(holding) =>
							holding.symbol ===
								selectedSymbol &&
							holding.exchange ===
								selectedExchange,
					) ??
				null,
			[
				portfolio,
				selectedExchange,
				selectedSymbol,
			],
		);

	const loadMarketStatus =
		async () => {
			try {
				const response =
					await api.get(
						"/markets/US/status",
					);

				setMarketStatus(
					unwrapApiData<UsMarketStatus>(
						response.data,
					),
				);
			} catch (error) {
				console.error(
					"미국시장 상태 조회 실패:",
					error,
				);
			}
		};

	const loadQuote =
		async (
			symbol =
				selectedSymbol,
			exchange =
				selectedExchange,
		) => {
			try {
				setIsLoadingQuote(
					true,
				);

				const response =
					await api.get(
						`/us-stocks/${exchange}/${symbol}/info`,
					);

				const data =
					unwrapApiData<UsStockQuote>(
						response.data,
					);

				setQuote(data);
				setSelectedExchange(
					data.exchange,
				);

				setLimitPrice(
					Number(
						data.price.toFixed(
							2,
						),
					),
				);

				return data;
			} catch (error: any) {
				console.error(
					"미국 종목 시세 조회 실패:",
					error,
				);

				toast({
					title:
						"미국 종목 시세를 불러오지 못했습니다.",
					description:
						error?.response
							?.data
							?.message ??
						"KIS 해외주식 시세 API 설정을 확인하세요.",
					status: "error",
					duration: 3200,
					isClosable: true,
				});

				return null;
			} finally {
				setIsLoadingQuote(
					false,
				);
			}
		};

	const loadChart =
		async (
			symbol =
				selectedSymbol,
			exchange =
				selectedExchange,
			period =
				chartPeriod,
		) => {
			try {
				setIsLoadingChart(
					true,
				);

				const response =
					await api.get(
						`/us-stocks/${exchange}/${symbol}/historical?period=${period}`,
					);

				setChartData(
					unwrapApiData<
						UsChartPoint[]
					>(
						response.data,
					),
				);
			} catch (error) {
				console.error(
					"미국 종목 차트 조회 실패:",
					error,
				);

				setChartData([]);
			} finally {
				setIsLoadingChart(
					false,
				);
			}
		};

	const loadTradingData =
		async (
			evaluate = true,
		) => {
			try {
				setIsLoadingTrading(
					true,
				);

				const [
					portfolioResponse,
					orderResponse,
				] =
					await Promise.all([
						api.get(
							`/us-trading/portfolio?evaluate=${evaluate}`,
						),
						api.get(
							"/us-trading/orders?limit=50",
						),
					]);

				setPortfolio(
					unwrapApiData<UsPortfolio>(
						portfolioResponse.data,
					),
				);

				setOrders(
					unwrapApiData<
						UsTradeOrder[]
					>(
						orderResponse.data,
					),
				);
			} catch (error: any) {
				console.error(
					"미국 모의계좌 조회 실패:",
					error,
				);

				if (
					error?.response
						?.status !== 401
				) {
					toast({
						title:
							"미국 모의계좌를 불러오지 못했습니다.",
						description:
							error
								?.response
								?.data
								?.message ??
							"서버 연결 상태를 확인하세요.",
						status:
							"error",
						duration:
							3000,
						isClosable:
							true,
					});
				}
			} finally {
				setIsLoadingTrading(
					false,
				);
			}
		};

	const searchStocks =
		async () => {
			const query =
				searchQuery.trim();

			if (!query) {
				return;
			}

			try {
				setIsSearching(
					true,
				);

				const response =
					await api.get(
						`/us-stocks/search/${encodeURIComponent(
							query,
						)}`,
					);

				const results =
					unwrapApiData<
						UsSearchResult[]
					>(
						response.data,
					);

				setSearchResults(
					results,
				);

				if (
					results.length === 0
				) {
					toast({
						title:
							"검색 결과가 없습니다.",
						description:
							"영문 티커를 정확히 입력해 보세요.",
						status: "info",
						duration:
							2200,
						isClosable:
							true,
					});
				}
			} catch (error: any) {
				toast({
					title:
						"미국 종목 검색에 실패했습니다.",
					description:
						error?.response
							?.data
							?.message ??
						"검색 API를 확인하세요.",
					status: "error",
					duration: 3000,
					isClosable: true,
				});
			} finally {
				setIsSearching(
					false,
				);
			}
		};

	const selectStock =
		async (
			item: UsSearchResult,
		) => {
			setSelectedSymbol(
				item.symbol,
			);

			setSelectedExchange(
				item.exchange,
			);

			setSearchResults([]);

			const loadedQuote =
				await loadQuote(
					item.symbol,
					item.exchange,
				);

			await loadChart(
				item.symbol,
				loadedQuote?.exchange ??
					item.exchange,
				chartPeriod,
			);
		};

	const submitOrder =
		async (
			side: UsOrderSide,
		) => {
			if (!quote) {
				return;
			}

			if (
				orderType ===
					"MARKET" &&
				isMarketClosed
			) {
				toast({
					title:
						"현재 미국 시장가 주문을 할 수 없습니다.",
					description:
						"지정가 예약 주문은 장 마감 후에도 등록할 수 있습니다.",
					status:
						"warning",
					duration:
						2600,
					isClosable:
						true,
				});
				return;
			}

			if (
				orderType ===
					"LIMIT" &&
				limitPrice <= 0
			) {
				toast({
					title:
						"지정가를 입력하세요.",
					status:
						"warning",
					duration:
						2200,
				});
				return;
			}

			try {
				setIsSubmitting(
					true,
				);

				const response =
					await api.post(
						"/us-trading/orders",
						{
							symbol:
								quote.symbol,
							name:
								quote.name,
							exchange:
								quote.exchange,
							side,
							orderType,
							quantity,
							limitPrice:
								orderType ===
								"LIMIT"
									? limitPrice
									: undefined,
						},
					);

				const order =
					unwrapApiData<UsTradeOrder>(
						response.data,
					);

				toast({
					title:
						order.status ===
						"PENDING"
							? "미국 지정가 예약 주문 등록"
							: "미국 주식 주문 체결",
					description:
						order.status ===
						"PENDING"
							? "다음 미국 정규장 중 지정 가격 조건을 충족하면 자동 체결됩니다."
							: `${order.name} ${order.quantity}주 주문이 체결되었습니다.`,
					status:
						"success",
					duration:
						3000,
					isClosable:
						true,
				});

				await loadTradingData(
					true,
				);
			} catch (error: any) {
				toast({
					title:
						"미국 주식 주문 실패",
					description:
						error?.response
							?.data
							?.message ??
						"주문 정보를 확인하세요.",
					status: "error",
					duration: 3200,
					isClosable: true,
				});
			} finally {
				setIsSubmitting(
					false,
				);
			}
		};

	const cancelOrder =
		async (
			orderId: string,
		) => {
			try {
				await api.post(
					`/us-trading/orders/${orderId}/cancel`,
				);

				toast({
					title:
						"미국 지정가 주문을 취소했습니다.",
					status:
						"success",
					duration:
						2200,
				});

				await loadTradingData(
					false,
				);
			} catch (error: any) {
				toast({
					title:
						"주문 취소 실패",
					description:
						error?.response
							?.data
							?.message,
					status:
						"error",
					duration:
						2600,
				});
			}
		};

	const checkPending =
		async () => {
			try {
				const response =
					await api.post(
						"/us-trading/orders/check-pending",
					);

				const result =
					unwrapApiData<{
						filledCount:
							number;
						pendingCount:
							number;
						marketOpen:
							boolean;
					}>(
						response.data,
					);

				toast({
					title:
						result.marketOpen
							? "미체결 주문 확인 완료"
							: "현재 미국 정규장이 닫혀 있습니다.",
					description:
						result.marketOpen
							? `${result.filledCount}건 체결, ${result.pendingCount}건 대기 중`
							: "예약 지정가 주문은 다음 정규장에 다시 확인됩니다.",
					status:
						result.marketOpen
							? "success"
							: "info",
					duration:
						2600,
					isClosable:
						true,
				});

				await loadTradingData(
					true,
				);
			} catch (error: any) {
				toast({
					title:
						"미체결 주문 확인 실패",
					description:
						error?.response
							?.data
							?.message,
					status:
						"error",
					duration:
						2600,
				});
			}
		};

	const topUpAccount =
		async () => {
			try {
				setIsToppingUp(
					true,
				);

				const response =
					await api.post(
						"/us-trading/top-up",
					);

				const result =
					unwrapApiData<{
						amount: number;
					}>(response.data);

				toast({
					title:
						"미국 모의투자 현금이 충전되었습니다.",
					description:
						`${usd.format(
							result.amount,
						)}이 계좌에 추가되었습니다.`,
					status: "success",
					duration: 2400,
					isClosable: true,
				});

				await loadTradingData(
					true,
				);
			} catch (error: any) {
				toast({
					title:
						"미국 모의계좌 충전 실패",
					description:
						error?.response
							?.data?.message ??
						"잠시 후 다시 시도하세요.",
					status: "error",
					duration: 2800,
					isClosable: true,
				});
			} finally {
				setIsToppingUp(
					false,
				);
			}
		};


	const resetAccount =
		async () => {
			const accepted =
				window.confirm(
					"미국 모의계좌의 보유종목과 주문내역을 모두 초기화하고 잔액을 $0로 만들까요?",
				);

			if (!accepted) {
				return;
			}

			try {
				await api.post(
					"/us-trading/reset",
				);

				toast({
					title:
						"미국 모의계좌를 초기화했습니다.",
					status:
						"success",
					duration:
						2400,
				});

				await loadTradingData(
					true,
				);
			} catch (error: any) {
				toast({
					title:
						"미국 모의계좌 초기화 실패",
					description:
						error?.response
							?.data
							?.message,
					status:
						"error",
					duration:
						2800,
				});
			}
		};

	useEffect(() => {
		void Promise.all([
			loadQuote(),
			loadChart(),
			loadTradingData(
				true,
			),
			loadMarketStatus(),
		]);

		const timer =
			window.setInterval(
				() => {
					void loadMarketStatus();
				},
				30_000,
			);

		return () => {
			window.clearInterval(
				timer,
			);
		};

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (
			marketStatus &&
			isMarketClosed &&
			orderType ===
				"MARKET"
		) {
			setOrderType(
				"LIMIT",
			);
		}
	}, [
		isMarketClosed,
		marketStatus,
		orderType,
	]);

	const isUp =
		Number(
			quote?.changeRate ||
				0,
		) >= 0;

	const account =
		portfolio?.account;

	const pendingOrders =
		useMemo(
			() =>
				orders.filter(
					(order) =>
						order.status ===
							"PENDING" &&
						order.symbol ===
							selectedSymbol,
				),
			[
				orders,
				selectedSymbol,
			],
		);

	const currentOrderPrice =
		orderType === "LIMIT"
			? limitPrice
			: Number(
					quote?.price ??
						0,
				);

	const maximumQuantity =
		useMemo(() => {
			if (
				orderPanelMode ===
				"SELL"
			) {
				return Math.max(
					1,
					Math.floor(
						Number(
							selectedHolding?.quantity ??
								1,
						),
					),
				);
			}

			const unitPrice =
				orderType === "LIMIT"
					? limitPrice
					: Number(
							quote?.price ??
								0,
						);

			const availableCash =
				Number(
					account?.availableCash ??
						0,
				);

			return unitPrice > 0
				? Math.max(
						1,
						Math.floor(
							availableCash /
								unitPrice,
						),
					)
				: 1;
		}, [
			account?.availableCash,
			limitPrice,
			orderPanelMode,
			orderType,
			quote?.price,
			selectedHolding?.quantity,
		]);

	const prepareOrderCorrection = (
		order: UsTradeOrder,
	) => {
		setOrderPanelMode(
			order.side,
		);
		setOrderType(
			"LIMIT",
		);
		setQuantity(
			Math.max(
				1,
				Number(
					order.quantity,
				),
			),
		);
		setLimitPrice(
			Number(
				order.limitPrice ??
					order.orderPrice ??
					quote?.price ??
					0,
			),
		);

		toast({
			title:
				"정정할 주문 값을 불러왔습니다.",
			description:
				"기존 주문을 취소한 뒤 변경된 가격과 수량으로 다시 제출하세요.",
			status: "info",
			duration: 2600,
			isClosable: true,
		});
	};


	return (
		<Box
			px={{
				base: 4,
				md: 6,
				xl: 8,
			}}
			py={{
				base: 5,
				md: 7,
			}}
			bg="app.background"
			minH="100vh"
		>
			<Flex
				mb="5"
				align="end"
				gap="4"
				wrap="wrap"
			>
				<Box>
					<Heading
						size="lg"
						letterSpacing="-0.035em"
					>
						실시간 차트
					</Heading>
					<Text
						color="app.subtleText"
						mt="1"
						fontSize="sm"
					>
						미국 주식 시세를 확인하고 모의투자 주문을 실행합니다.
					</Text>
				</Box>

				<Spacer />

				<Badge
					px="3"
					py="1.5"
					borderRadius="full"
					bg="orange.50"
					color="brand.600"
					borderWidth="1px"
					borderColor="orange.100"
					fontSize="12px"
				>
					미국 주식 · USD 모의투자
				</Badge>
			</Flex>

			<RelatedFinancialTerms
				title="현재 화면의 주요 투자 용어"
				description="미국 주식과 ETF 화면에서 자주 보이는 기업 지표와 거래 방식을 확인하세요."
				termIds={[
					"per",
					"pbr",
					"etf",
					"exchange_rate",
					"volatility",
					"limit_order",
				]}
			/>

			<Card
				mb="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
				overflow="hidden"
			>
				<CardBody
					px={{
						base: 5,
						lg: 7,
					}}
					py={{
						base: 5,
						lg: 6,
					}}
				>
					{isLoadingQuote ||
					!quote ? (
						<Flex
							h="126px"
							align="center"
							justify="center"
						>
							<Spinner color="brand.500" />
						</Flex>
					) : (
						<Flex
							align={{
								base: "stretch",
								lg: "center",
							}}
							direction={{
								base: "column",
								lg: "row",
							}}
							gap={{
								base: 5,
								lg: 8,
							}}
						>
							<Box minW={{ lg: "290px" }}>
								<Text
									fontSize="12px"
									color="app.subtleText"
									fontWeight="700"
								>
									{quote.symbol} · {quote.market}
								</Text>

								<Flex
									mt="1"
									align="center"
									gap="8px"
									wrap="wrap"
								>
									<Heading
										size="lg"
										letterSpacing="-0.035em"
									>
										{quote.name}
									</Heading>

									<Badge
										variant="outline"
										borderColor="#E4CDB8"
										color="#695B4F"
									>
										{quote.assetType ===
										"ETF"
											? "ETF"
											: "주식"}
									</Badge>
								</Flex>

								<Flex
									mt="3"
									align="baseline"
									gap="3"
									wrap="wrap"
								>
									<Heading
										size="xl"
										letterSpacing="-0.04em"
									>
										{usd.format(
											quote.price,
										)}
									</Heading>

									<Text
										color={
											isUp
												? "#F05B45"
												: "#2F67D8"
										}
										fontWeight="900"
									>
										{isUp
											? "▲"
											: "▼"}{" "}
										{usd.format(
											Math.abs(
												quote.changePrice,
											),
										)}{" "}
										(
										{quote.changeRate.toFixed(
											2,
										)}
										%)
									</Text>
								</Flex>
							</Box>

							<Box
								display={{
									base: "none",
									lg: "block",
								}}
								w="1px"
								h="70px"
								bg="app.borderSoft"
							/>

							<Grid
								templateColumns={{
									base:
										"repeat(2, minmax(0, 1fr))",
									md:
										"repeat(4, 110px)",
								}}
								gap={{
									base: 4,
									md: 4,
								}}
								alignItems="center"
								flex="0 0 auto"
								ml={{
									base: "0",
									lg: "50px",
									xl: "180px",
								}}
							>
								{[
									{
										label:
											"전일 종가",
										value:
											formatUsdOrDash(
												quote.previousClose,
											),
										color:
											"app.text",
									},
									{
										label:
											"52주 최고",
										value:
											formatUsdOrDash(
												quote.fiftyTwoWeekHigh,
											),
										color:
											"#F05B45",
									},
									{
										label:
											"52주 최저",
										value:
											formatUsdOrDash(
												quote.fiftyTwoWeekLow,
											),
										color:
											"#2F67D8",
									},
									{
										label:
											"거래량",
										value:
											numberFormat.format(
												quote.volume,
											),
										color:
											"app.text",
									},
								].map(
									({
										label,
										value,
										color,
									}) => (
										<Box
											key={
												label
											}
											minW="0"
										>
											<Text
												fontSize="9px"
												color="app.subtleText"
												fontWeight="700"
											>
												{label}
											</Text>
											<Text
												mt="1.5"
												fontSize={{
													base:
														"12px",
													xl:
														"13px",
												}}
												fontWeight="800"
												color={
													color
												}
												whiteSpace="nowrap"
											>
												{value}
											</Text>
										</Box>
									),
								)}
							</Grid>
						</Flex>
					)}
				</CardBody>
			</Card>

			<Grid
				templateColumns={{
					base: "1fr",
					"2xl":
						"minmax(0, 1fr) 382px",
				}}
				gap="5"
				alignItems="start"
			>
				<GridItem minW="0">
					<Card
						borderColor="app.borderSoft"
						boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
						overflow="hidden"
					>
						<CardHeader pb="0">
							<Flex
								align={{
									base:
										"stretch",
									lg:
										"center",
								}}
								direction={{
									base:
										"column",
									lg:
										"row",
								}}
								gap="4"
							>
								<Box>
									<Heading size="md">
										차트
									</Heading>
									<Text
										mt="1"
										fontSize="11px"
										color="app.subtleText"
									>
										현재 선택:{" "}
										{chartPeriod ===
										"1m"
											? "1개월"
											: chartPeriod ===
												  "6m"
												? "6개월"
												: "1년"}
									</Text>
								</Box>

								<Spacer />

								<HStack
									spacing="2"
									wrap="wrap"
								>
									{(
										[
											[
												"1개월",
												"1m",
											],
											[
												"6개월",
												"6m",
											],
											[
												"1년",
												"1y",
											],
										] as const
									).map(
										([
											label,
											period,
										]) => {
											const active =
												chartPeriod ===
												period;

											return (
												<Button
													key={
														period
													}
													size="sm"
													h="32px"
													px="4"
													fontSize="11px"
													fontWeight="800"
													variant="outline"
													borderColor={
														active
															? "brand.500"
															: "app.borderSoft"
													}
													bg={
														active
															? "orange.50"
															: "white"
													}
													color={
														active
															? "brand.600"
															: "app.subtleText"
													}
													onClick={() => {
														setChartPeriod(
															period,
														);

														void loadChart(
															selectedSymbol,
															selectedExchange,
															period,
														);
													}}
												>
													{label}
												</Button>
											);
										},
									)}
								</HStack>
							</Flex>
						</CardHeader>

						<CardBody pt="4">
							{isLoadingChart ? (
								<Flex
									h={{
										base:
											"420px",
										xl:
											"540px",
									}}
									align="center"
									justify="center"
								>
									<Spinner color="brand.500" />
								</Flex>
							) : (
								<UsCandlestickChart
									data={chartData}
									height={540}
								/>
							)}
						</CardBody>
					</Card>
				</GridItem>

				<GridItem minW="0">
					<Card
						position={{
							"2xl":
								"sticky",
						}}
						top={{
							"2xl":
								"102px",
						}}
						borderColor="app.borderSoft"
						boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
					>
						<CardHeader
							pb="3"
							borderBottomWidth="1px"
							borderColor="app.borderSoft"
						>
							<Flex align="flex-end">
								<Flex
									align="flex-end"
									gap="8px"
									minW="0"
								>
									<Heading
										size="md"
										lineHeight="1"
									>
										주문
									</Heading>
									<Text
										pb="1px"
										fontSize="10px"
										color="app.subtleText"
										fontWeight="700"
										whiteSpace="nowrap"
									>
										{quote?.name ??
											"종목"}{" "}
										·{" "}
										{quote?.symbol ??
											"-"}
									</Text>
								</Flex>

								<Spacer />

								<Badge
									colorScheme={
										marketStatus?.isOpen
											? "green"
											: "orange"
									}
									borderRadius="full"
								>
									{marketStatus?.isOpen
										? "장 운영 중"
										: "장 마감"}
								</Badge>
							</Flex>
						</CardHeader>

						<CardBody>
							<Box
								position="relative"
								mb="4"
								borderWidth="1px"
								borderColor="#E8DCCB"
								borderRadius="9px"
								bg="#FFFFFF"
								overflow="hidden"
							>
								<Grid
									templateColumns="repeat(3, minmax(0, 1fr))"
									position="relative"
									zIndex="1"
								>
									{(
										[
											[
												"BUY",
												"매수",
											],
											[
												"SELL",
												"매도",
											],
											[
												"MANAGE",
												"정정/취소",
											],
										] as const
									).map(
										([
											mode,
											label,
										]) => {
											const active =
												orderPanelMode ===
												mode;

											return (
												<Button
													key={
														mode
													}
													h="42px"
													borderRadius="0"
													borderWidth="0"
													borderRightWidth={
														mode ===
														"MANAGE"
															? "0"
															: "1px"
													}
													borderColor="#E8DCCB"
													bg="transparent"
													color={
														active
															? "#F26438"
															: "#403832"
													}
													fontSize="14px"
													fontWeight={
														active
															? "900"
															: "700"
													}
													_hover={{
														bg:
															"#FFF9F2",
														color:
															"#F26438",
													}}
													onClick={() =>
														setOrderPanelMode(
															mode,
														)
													}
												>
													{label}
												</Button>
											);
										},
									)}
								</Grid>

								<Box
									position="absolute"
									left="0"
									bottom="0"
									w="33.333333%"
									h="3px"
									borderRadius="999px 999px 0 0"
									bg="#F26438"
									transform={
										orderPanelMode ===
										"BUY"
											? "translateX(0%)"
											: orderPanelMode ===
												  "SELL"
												? "translateX(100%)"
												: "translateX(200%)"
									}
									transition="transform 220ms cubic-bezier(0.4, 0, 0.2, 1)"
									willChange="transform"
									pointerEvents="none"
								/>
							</Box>

							{orderPanelMode ===
							"MANAGE" ? (
								<Box>
									<Flex
										align="center"
										mb="3"
									>
										<Text
											fontSize="12px"
											fontWeight="900"
										>
											현재 종목 미체결 주문
										</Text>
										<Spacer />
										<Button
											size="xs"
											variant="ghost"
											onClick={() =>
												void checkPending()
											}
										>
											새로고침
										</Button>
									</Flex>

									<Stack
										spacing="2"
										maxH="360px"
										overflowY="auto"
									>
										{pendingOrders.map(
											(
												order,
											) => (
												<Box
													key={
														order._id
													}
													p="3"
													borderWidth="1px"
													borderColor="app.borderSoft"
													borderRadius="9px"
													bg="#FFFCF8"
												>
													<Flex
														align="center"
														gap="2"
													>
														<Badge
															colorScheme={
																order.side ===
																"BUY"
																	? "red"
																	: "blue"
															}
														>
															{sideLabel[
																order
																	.side
															]}
														</Badge>
														<Text
															fontSize="11px"
															color="app.subtleText"
														>
															지정가
														</Text>
														<Spacer />
														<Text
															fontSize="10px"
															color="app.subtleText"
														>
															{formatDateTime(
																order.createdAt,
															)}
														</Text>
													</Flex>

													<Flex
														mt="2"
														justify="space-between"
														fontSize="12px"
													>
														<Text>
															{numberFormat.format(
																order.quantity,
															)}
															주
														</Text>
														<Text fontWeight="900">
															{usd.format(
																Number(
																	order.limitPrice ??
																		order.orderPrice ??
																		0,
																),
															)}
														</Text>
													</Flex>

													<SimpleGrid
														mt="3"
														columns={
															2
														}
														spacing="2"
													>
														<Button
															size="xs"
															variant="outline"
															onClick={() =>
																prepareOrderCorrection(
																	order,
																)
															}
														>
															정정
														</Button>

														<Button
															size="xs"
															colorScheme="red"
															variant="outline"
															onClick={() =>
																void cancelOrder(
																	order._id,
																)
															}
														>
															취소
														</Button>
													</SimpleGrid>
												</Box>
											),
										)}

										{pendingOrders.length ===
											0 && (
											<Flex
												minH="180px"
												align="center"
												justify="center"
												borderWidth="1px"
												borderColor="app.borderSoft"
												borderRadius="9px"
											>
												<Text
													fontSize="12px"
													color="app.subtleText"
												>
													미체결 주문이 없습니다.
												</Text>
											</Flex>
										)}
									</Stack>
								</Box>
							) : (
								<>
									<SimpleGrid
										columns={2}
										spacing="3"
										mb="4"
									>
										<Box
											p="3"
											borderRadius="10px"
											bg="#FAF7F2"
										>
											<Text
												fontSize="10px"
												color="app.subtleText"
											>
												주문 가능 금액
											</Text>
											<Text
												mt="1"
												fontSize="14px"
												fontWeight="900"
											>
												{usd.format(
													account?.availableCash ??
														0,
												)}
											</Text>
										</Box>

										<Box
											p="3"
											borderRadius="10px"
											bg="#FAF7F2"
										>
											<Text
												fontSize="10px"
												color="app.subtleText"
											>
												보유수량
											</Text>
											<Text
												mt="1"
												fontSize="14px"
												fontWeight="900"
											>
												{numberFormat.format(
													selectedHolding?.quantity ??
														0,
												)}
												주
											</Text>
										</Box>
									</SimpleGrid>

									<SimpleGrid
										columns={2}
										spacing="2"
										mb="4"
									>
										<Button
											h="38px"
											bg={
												orderType ===
												"MARKET"
													? "#3C352E"
													: "white"
											}
											color={
												orderType ===
												"MARKET"
													? "white"
													: "app.text"
											}
											borderWidth="1px"
											borderColor="app.borderSoft"
											onClick={() =>
												setOrderType(
													"MARKET",
												)
											}
											isDisabled={
												isMarketClosed
											}
										>
											시장가
										</Button>

										<Button
											h="38px"
											bg={
												orderType ===
												"LIMIT"
													? "#3C352E"
													: "white"
											}
											color={
												orderType ===
												"LIMIT"
													? "white"
													: "app.text"
											}
											borderWidth="1px"
											borderColor="app.borderSoft"
											onClick={() => {
												setOrderType(
													"LIMIT",
												);

												if (
													limitPrice <=
														0 &&
													quote?.price
												) {
													setLimitPrice(
														Number(
															quote.price.toFixed(
																2,
															),
														),
													);
												}
											}}
										>
											지정가
										</Button>
									</SimpleGrid>

									<Box mb="3">
										<Text
											mb="1.5"
											fontSize="11px"
											fontWeight="800"
										>
											주문 가격
										</Text>

										<Grid
											templateColumns="42px minmax(0, 1fr) 42px"
											borderWidth="1px"
											borderColor="app.borderSoft"
											borderRadius="8px"
											overflow="hidden"
										>
											<Button
												h="42px"
												minW="0"
												borderRadius="0"
												variant="ghost"
												borderRightWidth="1px"
												borderColor="app.borderSoft"
												isDisabled={
													orderType ===
														"MARKET" ||
													!quote
												}
												onClick={() =>
													setLimitPrice(
														(
															price,
														) =>
															Math.max(
																0.01,
																Number(
																	(
																		(
																			price ||
																			quote?.price ||
																			0
																		) -
																		0.01
																	).toFixed(
																		2,
																	),
																),
															),
													)
												}
											>
												−
											</Button>

											<NumberInput
												value={
													orderType ===
													"MARKET"
														? quote?.price ??
															0
														: limitPrice
												}
												min={
													0.01
												}
												step={
													0.01
												}
												precision={
													2
												}
												onChange={(
													_,
													value,
												) =>
													orderType ===
														"LIMIT" &&
													setLimitPrice(
														Number.isNaN(
															value,
														)
															? 0
															: value,
													)
												}
												isReadOnly={
													orderType ===
													"MARKET"
												}
												isDisabled={
													!quote
												}
											>
												<NumberInputField
													h="42px"
													border="0"
													borderRadius="0"
													textAlign="center"
													fontWeight="900"
													px="4px"
												/>
											</NumberInput>

											<Button
												h="42px"
												minW="0"
												borderRadius="0"
												variant="ghost"
												borderLeftWidth="1px"
												borderColor="app.borderSoft"
												isDisabled={
													orderType ===
														"MARKET" ||
													!quote
												}
												onClick={() =>
													setLimitPrice(
														(
															price,
														) =>
															Number(
																(
																	(
																		price ||
																		quote?.price ||
																		0
																	) +
																	0.01
																).toFixed(
																	2,
																),
															),
													)
												}
											>
												＋
											</Button>
										</Grid>

										<Flex
											mt="1.5"
											align="center"
										>
											<Text
												fontSize="10px"
												color="app.subtleText"
											>
												USD 0.01 단위
											</Text>
											<Spacer />
											<Button
												size="xs"
												variant="ghost"
												color="brand.600"
												onClick={() =>
													quote?.price &&
													setLimitPrice(
														Number(
															quote.price.toFixed(
																2,
															),
														),
													)
												}
												isDisabled={
													!quote ||
													orderType ===
														"MARKET"
												}
											>
												현재가
											</Button>
										</Flex>
									</Box>

									<Box>
										<Text
											mb="1.5"
											fontSize="11px"
											fontWeight="800"
										>
											주문 수량
										</Text>

										<Grid
											templateColumns="42px minmax(0, 1fr) 42px"
											borderWidth="1px"
											borderColor="app.borderSoft"
											borderRadius="8px"
											overflow="hidden"
										>
											<Button
												h="42px"
												minW="0"
												borderRadius="0"
												variant="ghost"
												borderRightWidth="1px"
												borderColor="app.borderSoft"
												onClick={() =>
													setQuantity(
														(
															value,
														) =>
															Math.max(
																1,
																value -
																	1,
															),
													)
												}
												isDisabled={
													!quote
												}
											>
												−
											</Button>

											<NumberInput
												value={
													quantity
												}
												min={1}
												onChange={(
													_,
													value,
												) =>
													setQuantity(
														Number.isNaN(
															value,
														)
															? 1
															: Math.max(
																	1,
																	Math.floor(
																		value,
																	),
																),
													)
												}
												isDisabled={
													!quote
												}
											>
												<NumberInputField
													h="42px"
													border="0"
													borderRadius="0"
													textAlign="center"
													fontWeight="900"
													px="4px"
												/>
											</NumberInput>

											<Button
												h="42px"
												minW="0"
												borderRadius="0"
												variant="ghost"
												borderLeftWidth="1px"
												borderColor="app.borderSoft"
												onClick={() =>
													setQuantity(
														(
															value,
														) =>
															value +
															1,
													)
												}
												isDisabled={
													!quote
												}
											>
												＋
											</Button>
										</Grid>

										<SimpleGrid
											columns={4}
											spacing="2"
											mt="2"
										>
											{[
												10,
												50,
												100,
											].map(
												(
													value,
												) => (
													<Button
														key={
															value
														}
														size="xs"
														variant="outline"
														borderColor="app.borderSoft"
														onClick={() =>
															setQuantity(
																value,
															)
														}
													>
														{
															value
														}
													</Button>
												),
											)}

											<Button
												size="xs"
												variant="outline"
												borderColor="app.borderSoft"
												onClick={() =>
													setQuantity(
														maximumQuantity,
													)
												}
											>
												최대
											</Button>
										</SimpleGrid>
									</Box>

									<Divider
										mt="5"
										mb="4"
										borderColor="#E8DCCB"
									/>

									<Flex
										justify="space-between"
										align="center"
									>
										<Text
											fontSize="11px"
											color="app.subtleText"
										>
											예상 총 금액
										</Text>
										<Text fontWeight="900">
											{usd.format(
												currentOrderPrice *
													quantity,
											)}
										</Text>
									</Flex>

									<Button
										mt="5"
										w="100%"
										h="50px"
										bg={
											orderPanelMode ===
											"BUY"
												? "#F26438"
												: "#4679C8"
										}
										color="white"
										_hover={{
											bg:
												orderPanelMode ===
												"BUY"
													? "#DF552C"
													: "#3869B7",
										}}
										onClick={() =>
											void submitOrder(
												orderPanelMode ===
													"BUY"
													? "BUY"
													: "SELL",
											)
										}
										isLoading={
											isSubmitting
										}
										isDisabled={
											!quote ||
											isMarketOrderBlocked
										}
									>
										{orderType ===
											"LIMIT" &&
										isMarketClosed
											? "예약 "
											: ""}
										{orderPanelMode ===
										"BUY"
											? "매수 주문하기"
											: "매도 주문하기"}
									</Button>

									<Divider my="4" />

									<Flex
										gap="2"
										wrap="wrap"
									>
										<Button
											size="xs"
											variant="outline"
											onClick={() =>
												void checkPending()
											}
										>
											미체결 확인
										</Button>
										<Button
											size="xs"
											variant="outline"
											onClick={() =>
												void topUpAccount()
											}
											isLoading={
												isToppingUp
											}
										>
											$1,000 충전
										</Button>
										<Button
											size="xs"
											variant="ghost"
											onClick={() =>
												void resetAccount()
											}
											isDisabled={
												isLoadingTrading
											}
										>
											초기화
										</Button>
									</Flex>
								</>
							)}
						</CardBody>
					</Card>
				</GridItem>
			</Grid>

			<Grid
				mt="5"
				templateColumns={{
					base: "1fr",
					md:
						"repeat(3, minmax(0, 1fr))",
				}}
				gap="5"
			>
				<UsDetailSelectorCard
					title="정보"
					description="기업·ETF 핵심 정보"
					selected={
						detailSection ===
						"information"
					}
					onClick={() =>
						setDetailSection(
							"information",
						)
					}
				>
					<Stack spacing="7px">
						{[
							[
								"시가총액",
								Number(
									quote?.marketCap ??
										0,
								) > 0
									? compactUsd.format(
											Number(
												quote?.marketCap,
											),
										)
									: "-",
							],
							[
								"PER",
								formatRatio(
									quote?.per,
								),
							],
							[
								"PBR",
								formatRatio(
									quote?.pbr,
								),
							],
							[
								"EPS",
								formatUsdOrDash(
									quote?.eps,
								),
							],
						].map(
							([
								label,
								value,
							]) => (
								<Flex
									key={
										label
									}
									align="center"
								>
									<Text
										fontSize="10px"
										color="app.subtleText"
									>
										{label}
									</Text>
									<Spacer />
									<Text
										fontSize="10px"
										fontWeight="800"
									>
										{value}
									</Text>
								</Flex>
							),
						)}
					</Stack>
				</UsDetailSelectorCard>

				<UsDetailSelectorCard
					title="보유 종목"
					description="미국 모의계좌 보유 현황"
					selected={
						detailSection ===
						"holdings"
					}
					onClick={() =>
						setDetailSection(
							"holdings",
						)
					}
				>
					<Stack spacing="8px">
						{(
							portfolio?.holdings ??
							[]
						)
							.slice(0, 4)
							.map(
								(
									holding,
								) => (
									<Flex
										key={`${holding.exchange}-${holding.symbol}`}
										align="center"
									>
										<Box minW="0">
											<Text
												fontSize="10px"
												fontWeight="800"
												noOfLines={
													1
												}
											>
												{
													holding.name
												}
											</Text>
											<Text
												fontSize="9px"
												color="app.subtleText"
											>
												{
													holding.symbol
												}{" "}
												·{" "}
												{numberFormat.format(
													holding.quantity,
												)}
												주
											</Text>
										</Box>
										<Spacer />
										<Text
											fontSize="10px"
											fontWeight="900"
											color={
												holding.profitLoss >=
												0
													? "#F05B45"
													: "#2F67D8"
											}
										>
											{holding.profitLossRate.toFixed(
												2,
											)}
											%
										</Text>
									</Flex>
								),
							)}

						{(
							portfolio?.holdings
								?.length ??
							0
						) === 0 && (
							<Text
								fontSize="10px"
								color="app.subtleText"
							>
								보유 종목이 없습니다.
							</Text>
						)}
					</Stack>
				</UsDetailSelectorCard>

				<UsDetailSelectorCard
					title="주문 내역"
					description="미체결·체결 주문 현황"
					selected={
						detailSection ===
						"orders"
					}
					onClick={() =>
						setDetailSection(
							"orders",
						)
					}
				>
					<Stack spacing="7px">
						{orders
							.slice(0, 4)
							.map(
								(
									order,
								) => (
									<Flex
										key={
											order._id
										}
										align="center"
									>
										<Badge
											colorScheme={
												order.side ===
												"BUY"
													? "red"
													: "blue"
											}
											fontSize="8px"
										>
											{
												sideLabel[
													order
														.side
												]
											}
										</Badge>
										<Text
											ml="7px"
											fontSize="9px"
											fontWeight="700"
										>
											{
												order.symbol
											}
										</Text>
										<Spacer />
										<Text
											fontSize="9px"
											color="app.subtleText"
										>
											{
												statusLabel[
													order
														.status
												]
											}
										</Text>
									</Flex>
								),
							)}

						{orders.length ===
							0 && (
							<Text
								fontSize="10px"
								color="app.subtleText"
							>
								주문 내역이 없습니다.
							</Text>
						)}
					</Stack>
				</UsDetailSelectorCard>
			</Grid>

			<Card
				mt="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.04)"
			>
				<CardHeader pb="3">
					<Flex align="center">
						<Box>
							<Heading size="sm">
								{detailSection ===
								"information"
									? "미국 종목 상세 정보"
									: detailSection ===
										  "holdings"
										? "보유 종목"
										: "주문 / 체결 내역"}
							</Heading>
							<Text
								mt="1"
								fontSize="11px"
								color="app.subtleText"
							>
								{detailSection ===
								"information"
									? "KIS 미국 종목 API에서 제공되는 기업·ETF 정보를 표시합니다."
									: detailSection ===
										  "holdings"
										? "미국 모의계좌의 평가 현황을 확인합니다."
										: "미국 주식 주문 상태와 체결 결과를 확인합니다."}
							</Text>
						</Box>

						<Spacer />

						{detailSection ===
							"holdings" && (
							<Button
								size="xs"
								variant="outline"
								onClick={() =>
									void loadTradingData(
										true,
									)
								}
								isLoading={
									isLoadingTrading
								}
							>
								평가금액 갱신
							</Button>
						)}
					</Flex>
				</CardHeader>

				<CardBody pt="0">
					{detailSection ===
						"information" && (
						<Grid
							templateColumns={{
								base:
									"1fr",
								xl:
									"minmax(0, 1.2fr) minmax(320px, 0.8fr)",
							}}
							gap="5"
						>
							<Box
								p="4"
								borderWidth="1px"
								borderColor="app.borderSoft"
								borderRadius="10px"
							>
								<UsStockDetailPanel
									quote={
										quote
									}
									isLoading={
										isLoadingQuote
									}
								/>
							</Box>

							<Box
								p="4"
								borderWidth="1px"
								borderColor="app.borderSoft"
								borderRadius="10px"
							>
								<UsPriceHistoryTable
									data={
										chartData
									}
								/>
							</Box>
						</Grid>
					)}

					{detailSection ===
						"holdings" && (
						<Stack spacing="3">
							{(
								portfolio?.holdings ??
								[]
							).map(
								(
									holding,
								) => (
									<Box
										key={`${holding.exchange}-${holding.symbol}`}
										p="4"
										borderWidth="1px"
										borderColor="app.borderSoft"
										borderRadius="10px"
										cursor="pointer"
										_hover={{
											bg:
												"#FFFAF5",
										}}
										onClick={() =>
											void selectStock(
												{
													symbol:
														holding.symbol,
													name:
														holding.name,
													shortname:
														holding.name,
													longname:
														holding.name,
													exchange:
														holding.exchange,
													exchDisp:
														holding.market,
													market:
														holding.market,
													currency:
														"USD",
													assetType:
														"STOCK",
													tradable:
														true,
												},
											)
										}
									>
										<Flex align="center">
											<Box>
												<Text fontWeight="900">
													{
														holding.name
													}
												</Text>
												<Text
													mt="1"
													fontSize="11px"
													color="app.subtleText"
												>
													{
														holding.symbol
													}{" "}
													·{" "}
													{numberFormat.format(
														holding.quantity,
													)}
													주
												</Text>
											</Box>

											<Spacer />

											<Box textAlign="right">
												<Text
													fontWeight="900"
													color={
														holding.profitLoss >=
														0
															? "#F05B45"
															: "#2F67D8"
													}
												>
													{usd.format(
														holding.profitLoss,
													)}
												</Text>
												<Text
													fontSize="11px"
													color={
														holding.profitLossRate >=
														0
															? "#F05B45"
															: "#2F67D8"
													}
												>
													{holding.profitLossRate.toFixed(
														2,
													)}
													%
												</Text>
											</Box>
										</Flex>

										<Text
											mt="2"
											fontSize="11px"
											color="app.subtleText"
										>
											평균{" "}
											{usd.format(
												holding.avgPrice,
											)}{" "}
											· 현재{" "}
											{usd.format(
												holding.currentPrice,
											)}
										</Text>
									</Box>
								),
							)}

							{(
								portfolio?.holdings
									?.length ??
								0
							) === 0 && (
								<Flex
									minH="180px"
									align="center"
									justify="center"
								>
									<Text color="app.subtleText">
										보유 종목이 없습니다.
									</Text>
								</Flex>
							)}
						</Stack>
					)}

					{detailSection ===
						"orders" && (
						<TableContainer>
							<Table size="sm">
								<Thead bg="#FFFCF8">
									<Tr>
										<Th>
											시간
										</Th>
										<Th>
											구분
										</Th>
										<Th>
											유형
										</Th>
										<Th>
											상태
										</Th>
										<Th>
											종목
										</Th>
										<Th isNumeric>
											수량
										</Th>
										<Th isNumeric>
											주문가
										</Th>
										<Th isNumeric>
											체결가
										</Th>
										<Th>
											관리
										</Th>
									</Tr>
								</Thead>

								<Tbody>
									{orders.map(
										(
											order,
										) => (
											<Tr
												key={
													order._id
												}
											>
												<Td fontSize="10px">
													{formatDateTime(
														order.createdAt,
													)}
												</Td>
												<Td>
													<Badge
														colorScheme={
															order.side ===
															"BUY"
																? "red"
																: "blue"
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
												<Td fontSize="10px">
													{order.orderType ===
													"MARKET"
														? "시장가"
														: "지정가"}
												</Td>
												<Td>
													<Badge
														colorScheme={
															statusColor[
																order
																	.status
															]
														}
													>
														{
															statusLabel[
																order
																	.status
															]
														}
													</Badge>
												</Td>
												<Td fontSize="10px">
													{
														order.symbol
													}
												</Td>
												<Td
													isNumeric
													fontSize="10px"
												>
													{numberFormat.format(
														order.quantity,
													)}
												</Td>
												<Td
													isNumeric
													fontSize="10px"
												>
													{usd.format(
														Number(
															order.limitPrice ??
																order.orderPrice ??
																0,
														),
													)}
												</Td>
												<Td
													isNumeric
													fontSize="10px"
												>
													{order.executedPrice
														? usd.format(
																order.executedPrice,
															)
														: "-"}
												</Td>
												<Td>
													{order.status ===
													"PENDING" ? (
														<Button
															size="xs"
															variant="outline"
															onClick={() =>
																void cancelOrder(
																	order._id,
																)
															}
														>
															취소
														</Button>
													) : (
														"-"
													)}
												</Td>
											</Tr>
										),
									)}

									{orders.length ===
										0 && (
										<Tr>
											<Td
												colSpan={
													9
												}
												textAlign="center"
												py="12"
												color="app.subtleText"
											>
												주문 내역이 없습니다.
											</Td>
										</Tr>
									)}
								</Tbody>
							</Table>
						</TableContainer>
					)}
				</CardBody>
			</Card>

			<Card
				mt="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.04)"
			>
				<CardHeader pb="3">
					<Heading size="sm">
						미국 종목 검색
					</Heading>
				</CardHeader>

				<CardBody pt="0">
					<HStack>
						<Input
							value={
								searchQuery
							}
							onChange={(
								event,
							) =>
								setSearchQuery(
									event.target
										.value,
								)
							}
							onKeyDown={(
								event,
							) => {
								if (
									event.key ===
									"Enter"
								) {
									void searchStocks();
								}
							}}
							placeholder="기업명·ETF 또는 티커"
							bg="white"
						/>

						<Button
							bg="#F26438"
							color="white"
							_hover={{
								bg:
									"#DF552C",
							}}
							onClick={() =>
								void searchStocks()
							}
							isLoading={
								isSearching
							}
						>
							검색
						</Button>
					</HStack>

					<SimpleGrid
						mt="3"
						columns={{
							base: 1,
							md: 2,
							xl: 3,
						}}
						spacing="3"
					>
						{searchResults.map(
							(
								item,
							) => (
								<Box
									key={`${item.exchange}-${item.symbol}`}
									p="3"
									borderWidth="1px"
									borderColor="app.borderSoft"
									borderRadius="9px"
									cursor="pointer"
									bg="white"
									_hover={{
										bg:
											"#FFFAF5",
									}}
									onClick={() =>
										void selectStock(
											item,
										)
									}
								>
									<Flex align="center">
										<Box minW="0">
											<Text
												fontWeight="800"
												noOfLines={
													1
												}
											>
												{
													item.name
												}
											</Text>
											<Text
												fontSize="11px"
												color="app.subtleText"
											>
												{
													item.symbol
												}{" "}
												·{" "}
												{
													item.market
												}
											</Text>
										</Box>
										<Spacer />
										<Badge
											variant="outline"
											borderColor="#E4CDB8"
											color="#695B4F"
										>
											{item.assetType ===
											"ETF"
												? "ETF"
												: "주식"}
										</Badge>
									</Flex>
								</Box>
							),
						)}
					</SimpleGrid>
				</CardBody>
			</Card>
		</Box>
	);
}
