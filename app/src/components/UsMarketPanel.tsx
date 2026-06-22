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

export default function UsMarketPanel() {
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

	const resetAccount =
		async () => {
			const accepted =
				window.confirm(
					"미국 모의계좌의 보유종목과 주문내역을 모두 초기화하고 $10,000로 되돌릴까요?",
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


	return (
		<Box
			px={{
				base: 4,
				md: 8,
			}}
			py="6"
			bg="gray.50"
			minH="100vh"
		>
			<Flex
				mb="6"
				align="end"
				gap="4"
				wrap="wrap"
			>
				<Box>
					<Heading size="lg">
						거래소
					</Heading>
					<Text
						color="gray.500"
						mt="1"
					>
						KIS API 기반 미국 주식·ETF 모의투자 화면
					</Text>
				</Box>

				<Spacer />

				<Badge
					px="3"
					py="1"
					borderRadius="full"
					colorScheme="blue"
				>
					USD 모의투자
				</Badge>
			</Flex>

			<Grid
				templateColumns={{
					base: "1fr",
					xl:
						"minmax(0, 1fr) 360px",
				}}
				gap="5"
			>
				<GridItem>
					<Card mb="5">
						<CardBody>
							{isLoadingQuote ||
							!quote ? (
								<Flex
									h="120px"
									align="center"
									justify="center"
								>
									<Spinner />
								</Flex>
							) : (
								<Flex
									align="start"
									gap="6"
									wrap="wrap"
								>
									<Box minW="240px">
										<Flex
											align="center"
											gap="2"
											wrap="wrap"
										>
											<Text
												color="gray.500"
												fontWeight="700"
											>
												{quote.symbol}
												{" · "}
												{quote.market}
											</Text>

											<Badge
												colorScheme={
													quote.assetType ===
													"ETF"
														? "teal"
														: "blue"
												}
											>
												{quote.assetType ===
												"ETF"
													? "ETF"
													: "주식"}
											</Badge>
										</Flex>

										<Heading size="lg">
											{quote.name}
										</Heading>

										<Heading
											mt="3"
											size="xl"
										>
											{usd.format(
												quote.price,
											)}
										</Heading>

										<Text
											color={
												isUp
													? "red.500"
													: "blue.500"
											}
											fontWeight="800"
										>
											{isUp
												? "▲"
												: "▼"}{" "}
											{usd.format(
												Math.abs(
													quote.changePrice,
												),
											)}
											{" "}
											(
											{quote.changeRate.toFixed(
												2,
											)}
											%)
										</Text>
									</Box>

									{quote.assetType ===
									"ETF" ? (
										<SimpleGrid
											columns={{
												base: 2,
												md: 4,
											}}
											spacing="4"
											flex="1"
										>
											<Stat>
												<StatLabel>
													추종 지수
												</StatLabel>
												<StatNumber fontSize="md">
													{quote.benchmark ??
														"-"}
												</StatNumber>
											</Stat>

											<Stat>
												<StatLabel>
													운용사
												</StatLabel>
												<StatNumber fontSize="md">
													{quote.issuer ??
														"-"}
												</StatNumber>
											</Stat>

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
										</SimpleGrid>
									) : (
										<SimpleGrid
											columns={{
												base: 2,
												md: 4,
											}}
											spacing="4"
											flex="1"
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
												<StatLabel>
													PER
												</StatLabel>
												<StatNumber fontSize="lg">
													{formatRatio(
														quote.per,
													)}
												</StatNumber>
											</Stat>

											<Stat>
												<StatLabel>
													PBR
												</StatLabel>
												<StatNumber fontSize="lg">
													{formatRatio(
														quote.pbr,
													)}
												</StatNumber>
											</Stat>

											<Stat>
												<StatLabel>
													EPS
												</StatLabel>
												<StatNumber fontSize="lg">
													{formatUsdOrDash(
														quote.eps,
													)}
												</StatNumber>
											</Stat>
										</SimpleGrid>
									)}
								</Flex>
							)}
						</CardBody>
					</Card>

					<Card mb="5">
						<CardBody>
							<Tabs
								variant="enclosed"
								colorScheme="blue"
							>
								<TabList>
									<Tab>차트</Tab>
									<Tab>정보</Tab>
								</TabList>

								<TabPanels>
									<TabPanel
										px="0"
										pb="0"
									>
										<Flex
											align="center"
											gap="3"
											wrap="wrap"
											mb="4"
										>
											<Box>
												<Heading size="md">
													가격 차트
												</Heading>
												<Text
													fontSize="sm"
													color="gray.500"
													mt="1"
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
													]) => (
														<Button
															key={
																period
															}
															size="sm"
															h="30px"
															px="4"
															fontSize="12px"
															fontWeight="900"
															borderRadius="8px"
															variant={
																chartPeriod ===
																period
																	? "solid"
																	: "outline"
															}
															colorScheme={
																chartPeriod ===
																period
																	? "blue"
																	: "gray"
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
													),
												)}
											</HStack>
										</Flex>

										{isLoadingChart ? (
											<Flex
												h="390px"
												align="center"
												justify="center"
											>
												<Spinner />
											</Flex>
										) : (
											<UsCandlestickChart
												data={
													chartData
												}
												height={
													390
												}
											/>
										)}
									</TabPanel>

									<TabPanel
										px="0"
										pb="0"
									>
										<UsStockDetailPanel
											quote={
												quote
											}
											isLoading={
												isLoadingQuote
											}
										/>
									</TabPanel>
								</TabPanels>
							</Tabs>
						</CardBody>
					</Card>

					<Grid
						templateColumns={{
							base: "1fr",
							xl: "1fr 1fr",
						}}
						gap="5"
						mb="5"
					>
						<Card>
							<CardBody>
								<Heading
									size="sm"
									mb="3"
								>
									투자 지표
								</Heading>

								<SimpleGrid
									columns={2}
									spacing="4"
								>
									<Stat>
										<StatLabel>
											전일 종가
										</StatLabel>
										<StatNumber fontSize="lg">
											{formatUsdOrDash(
												quote?.previousClose,
											)}
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>
											거래량
										</StatLabel>
										<StatNumber fontSize="lg">
											{numberFormat.format(
												quote?.volume ??
													0,
											)}
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>
											52주 최고
										</StatLabel>
										<StatNumber fontSize="lg">
											{formatUsdOrDash(
												quote?.fiftyTwoWeekHigh,
											)}
										</StatNumber>
									</Stat>

									<Stat>
										<StatLabel>
											52주 최저
										</StatLabel>
										<StatNumber fontSize="lg">
											{formatUsdOrDash(
												quote?.fiftyTwoWeekLow,
											)}
										</StatNumber>
									</Stat>

									{quote?.assetType !==
										"ETF" && (
										<>
											<Stat>
												<StatLabel>
													BPS
												</StatLabel>
												<StatNumber fontSize="lg">
													{formatUsdOrDash(
														quote?.bps,
													)}
												</StatNumber>
											</Stat>

											<Stat>
												<StatLabel>
													상장주식수
												</StatLabel>
												<StatNumber fontSize="lg">
													{Number(
														quote?.sharesOutstanding ??
															0,
													) > 0
														? numberFormat.format(
																Number(
																	quote?.sharesOutstanding,
																),
															)
														: "-"}
												</StatNumber>
											</Stat>
										</>
									)}
								</SimpleGrid>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<UsPriceHistoryTable
									data={
										chartData
									}
								/>
							</CardBody>
						</Card>
					</Grid>

					<Card mt="5">
						<CardHeader pb="0">
							<Flex align="center">
								<Box>
									<Heading size="md">
										모의투자 주문
									</Heading>
									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										미국 주식·ETF 시장가/지정가 매수·매도 주문을 실행합니다.
									</Text>
								</Box>

								<Spacer />

								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										void checkPending()
									}
								>
									미체결 확인
								</Button>
							</Flex>
						</CardHeader>

						<CardBody>
							<Box
								mb="5"
								p="4"
								borderWidth="1px"
								borderRadius="12px"
								borderColor={
									marketStatus?.isOpen
										? "green.200"
										: "orange.200"
								}
								bg={
									marketStatus?.isOpen
										? "green.50"
										: "orange.50"
								}
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
									gap="2"
								>
									<Badge
										colorScheme={
											marketStatus?.isOpen
												? "green"
												: "orange"
										}
										fontSize="sm"
										px="3"
										py="1"
										borderRadius="full"
									>
										{marketStatus?.isOpen
											? "정규장 운영 중"
											: "정규장 마감"}
									</Badge>

									<Box>
										<Text fontWeight="900">
											{marketStatus?.message ??
												"미국시장 상태를 확인하고 있습니다."}
										</Text>

										<Text
											fontSize="xs"
											color="gray.600"
										>
											뉴욕시간{" "}
											{marketStatus?.localDate ??
												"-"}{" "}
											{marketStatus?.localTime ??
												"-"}
											{" · "}
											정규장{" "}
											{marketStatus?.openTime ??
												"09:30"}
											~
											{marketStatus?.closeTime ??
												"16:00"}{" "}
											ET
										</Text>
									</Box>
								</Flex>
							</Box>

							<SimpleGrid
								columns={{
									base: 1,
									md: 4,
								}}
								spacing="4"
								mb="5"
							>
								<Stat>
									<StatLabel>
										보유 현금
									</StatLabel>
									<StatNumber fontSize="lg">
										{usd.format(
											account?.cash ??
												0,
										)}
									</StatNumber>
								</Stat>

								<Stat>
									<StatLabel>
										주문 가능 금액
									</StatLabel>
									<StatNumber fontSize="lg">
										{usd.format(
											account?.availableCash ??
												0,
										)}
									</StatNumber>
								</Stat>

								<Stat>
									<StatLabel>
										예약 금액
									</StatLabel>
									<StatNumber fontSize="lg">
										{usd.format(
											account?.reservedCash ??
												0,
										)}
									</StatNumber>
								</Stat>

								<Stat>
									<StatLabel>
										선택 종목 보유수량
									</StatLabel>
									<StatNumber fontSize="lg">
										{numberFormat.format(
											selectedHolding?.quantity ??
												0,
										)}
										주
									</StatNumber>
								</Stat>
							</SimpleGrid>

							<Flex
								gap="3"
								wrap="wrap"
								align="center"
							>
								<HStack>
									<Button
										size="sm"
										colorScheme={
											orderType ===
											"MARKET"
												? "blue"
												: "gray"
										}
										variant={
											orderType ===
											"MARKET"
												? "solid"
												: "outline"
										}
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
										size="sm"
										colorScheme={
											orderType ===
											"LIMIT"
												? "blue"
												: "gray"
										}
										variant={
											orderType ===
											"LIMIT"
												? "solid"
												: "outline"
										}
										onClick={() =>
											setOrderType(
												"LIMIT",
											)
										}
									>
										지정가
									</Button>
								</HStack>

								<NumberInput
									value={
										quantity
									}
									min={1}
									maxW="140px"
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
									<NumberInputField placeholder="수량" />
								</NumberInput>

								{orderType ===
									"LIMIT" && (
									<NumberInput
										value={
											limitPrice ||
											""
										}
										min={0.01}
										step={0.01}
										precision={2}
										maxW="180px"
										onChange={(
											_,
											value,
										) =>
											setLimitPrice(
												Number.isNaN(
													value,
												)
													? 0
													: value,
											)
										}
										isDisabled={
											!quote
										}
									>
										<NumberInputField placeholder="지정가" />
									</NumberInput>
								)}

								<Button
									colorScheme="red"
									onClick={() =>
										void submitOrder(
											"BUY",
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
										? "예약 매수"
										: "매수"}
								</Button>

								<Button
									colorScheme="blue"
									onClick={() =>
										void submitOrder(
											"SELL",
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
										? "예약 매도"
										: "매도"}
								</Button>

								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										void resetAccount()
									}
									isDisabled={
										isLoadingTrading
									}
								>
									계좌 초기화
								</Button>
							</Flex>

							<Text
								mt="3"
								fontSize="sm"
								color="gray.500"
							>
								※ 시장가 주문은 미국 정규장 중에만 가능합니다. 지정가 주문은 장 마감 후에도 예약되며 다음 정규장 중 가격 조건을 충족하면 자동 체결됩니다.
							</Text>
						</CardBody>
					</Card>

					<Card mt="5">
						<CardHeader pb="0">
							<Heading size="md">
								주문 / 체결 내역
							</Heading>
						</CardHeader>

						<CardBody overflowX="auto">
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>시간</Th>
										<Th>구분</Th>
										<Th>주문유형</Th>
										<Th>상태</Th>
										<Th>종목</Th>
										<Th isNumeric>
											수량
										</Th>
										<Th isNumeric>
											주문가
										</Th>
										<Th isNumeric>
											체결가
										</Th>
										<Th isNumeric>
											실현손익
										</Th>
										<Th>관리</Th>
									</Tr>
								</Thead>

								<Tbody>
									{orders.map(
										(order) => (
											<Tr
												key={
													order._id
												}
											>
												<Td>
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
														{sideLabel[
															order.side
														]}
													</Badge>
												</Td>

												<Td>
													{order.orderType ===
													"MARKET"
														? "시장가"
														: "지정가"}
												</Td>

												<Td>
													<Badge
														colorScheme={
															statusColor[
																order.status
															]
														}
													>
														{statusLabel[
															order.status
														]}
													</Badge>
												</Td>

												<Td>
													{order.name}
													(
													{order.symbol}
													)
												</Td>

												<Td isNumeric>
													{numberFormat.format(
														order.quantity,
													)}
												</Td>

												<Td isNumeric>
													{usd.format(
														Number(
															order.limitPrice ??
																order.orderPrice ??
																0,
														),
													)}
												</Td>

												<Td isNumeric>
													{order.executedPrice
														? usd.format(
																order.executedPrice,
															)
														: "-"}
												</Td>

												<Td
													isNumeric
													color={
														order.realizedProfit >
														0
															? "red.500"
															: order.realizedProfit <
																  0
																? "blue.500"
																: "gray.700"
													}
												>
													{order.realizedProfit
														? usd.format(
																order.realizedProfit,
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
													10
												}
											>
												<Text color="gray.500">
													아직 주문 내역이 없습니다.
												</Text>
											</Td>
										</Tr>
									)}
								</Tbody>
							</Table>
						</CardBody>
					</Card>
				</GridItem>

				<GridItem>
					<Card mb="5">
						<CardHeader pb="0">
							<Heading size="md">
								종목 검색
							</Heading>
						</CardHeader>

						<CardBody>
							<Stack>
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
									/>

									<Button
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

								<Stack spacing="2">
									{searchResults.map(
										(item) => (
											<Box
												key={`${item.exchange}-${item.symbol}`}
												p="3"
												borderWidth="1px"
												borderRadius="lg"
												cursor="pointer"
												_hover={{
													bg: "gray.50",
												}}
												onClick={() =>
													void selectStock(
														item,
													)
												}
											>
												<Flex align="center">
													<Box>
														<Text fontWeight="800">
															{item.name}
														</Text>

														<Text
															fontSize="sm"
															color="gray.500"
														>
															{item.symbol}
															{" · "}
															{item.market}
														</Text>
													</Box>

													<Spacer />

													<Badge
														colorScheme={
															item.assetType ===
															"ETF"
																? "teal"
																: "blue"
														}
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
								</Stack>
							</Stack>
						</CardBody>
					</Card>

					<Card mb="5">
						<CardHeader pb="0">
							<Flex align="center">
								<Heading size="md">
									보유 종목
								</Heading>

								<Spacer />

								<Button
									size="sm"
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
							</Flex>
						</CardHeader>

						<CardBody>
							<Stack spacing="3">
								{portfolio?.holdings.map(
									(holding) => (
										<Box
											key={`${holding.exchange}-${holding.symbol}`}
											p="3"
											borderWidth="1px"
											borderRadius="lg"
											cursor="pointer"
											_hover={{
												bg: "gray.50",
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
													<Text fontWeight="800">
														{holding.name}
													</Text>

													<Text
														fontSize="sm"
														color="gray.500"
													>
														{holding.symbol}
														{" · "}
														{numberFormat.format(
															holding.quantity,
														)}
														주
													</Text>
												</Box>

												<Spacer />

												<Text
													fontWeight="800"
													color={
														holding.profitLoss >=
														0
															? "red.500"
															: "blue.500"
													}
												>
													{holding.profitLossRate.toFixed(
														2,
													)}
													%
												</Text>
											</Flex>

											<Text
												mt="2"
												fontSize="sm"
												color="gray.600"
											>
												평균{" "}
												{usd.format(
													holding.avgPrice,
												)}
												{" · "}
												현재{" "}
												{usd.format(
													holding.currentPrice,
												)}
											</Text>
										</Box>
									),
								)}

								{(!portfolio?.holdings ||
									portfolio.holdings
										.length ===
										0) && (
									<Text color="gray.500">
										아직 보유 종목이 없습니다.
									</Text>
								)}
							</Stack>
						</CardBody>
					</Card>
				</GridItem>
			</Grid>
		</Box>
	);
}
