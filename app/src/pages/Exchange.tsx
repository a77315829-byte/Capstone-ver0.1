import React, { useEffect, useMemo, useRef, useState } from "react";
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
import AiAssistantPanel from "../components/AiAssistantPanel";
import MarketSimulatorPanel from "../components/MarketSimulatorPanel";

type ChartPeriod = "1d" | "5d" | "1m" | "6m" | "YTD" | "1y" | "all";
type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

type StockSummary = {
	symbol: string;
	name: string;
	market?: string;
	assetType?: string;
	tradable?: boolean;
	price: number;
	changeRate: number;
	changePrice: number;
	volume: number;
	high: number;
	low: number;
	open: number;
	fetchedAt?: string;
};
type StockDetail = {
	symbol: string;
	name: string;
	market: string;
	assetType: string;
	tradable: boolean;

	price: number;
	changePrice: number;
	changeRate: number;
	open: number;
	high: number;
	low: number;
	volume: number;

	marketCap?: number | null;
	per?: number | null;
	pbr?: number | null;
	eps?: number | null;
	bps?: number | null;
	roe?: number | null;
	revenue?: number | null;
	operatingProfit?: number | null;
	netIncome?: number | null;

	summary?: string;
	fetchedAt?: string;
};
type OrderBookLevel = {
	level: number;
	askPrice: number;
	askVolume: number;
	bidPrice: number;
	bidVolume: number;
};

type OrderBookData = {
	symbol: string;
	totalAskVolume: number;
	totalBidVolume: number;
	expectedPrice: number;
	expectedVolume: number;
	levels: OrderBookLevel[];
	fetchedAt: string;
};

type SearchResultPrice = {
	price: number;
	changeRate: number;
	changePrice: number;
};
type TradingOrderSide = "BUY" | "SELL";
type TradingOrderType = "MARKET" | "LIMIT";
type TradingOrderStatus = "PENDING" | "FILLED" | "CANCELED" | "REJECTED";

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

type SearchResult = {
	symbol: string;
	name: string;
	market?: string;
	assetType?: string;
	tradable?: boolean;
	price?: number;
	changeRate?: number;
};

type ChartPoint = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
};


type ChartOption = {
	label: string;
	period: ChartPeriod;
	interval: ChartInterval;
};


const chartOptions: ChartOption[] = [
	{ label: "1분", period: "1d", interval: "1m" },
	{ label: "5분", period: "1d", interval: "5m" },
	{ label: "15분", period: "1d", interval: "15m" },
	{ label: "1시간", period: "1d", interval: "1h" },
	{ label: "4시간", period: "1d", interval: "4h" },
	{ label: "1주", period: "5d", interval: "1d" },
	{ label: "1개월", period: "1m", interval: "1d" },
	{ label: "1년", period: "1y", interval: "1d" },
];

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

const formatNumber = new Intl.NumberFormat("ko-KR");

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function unwrapApiData(raw: any): any {
	if (raw?.success === true && raw?.data !== undefined) return raw.data;
	if (raw?.data !== undefined) return raw.data;
	if (raw?.output !== undefined) return raw.output;
	return raw;
}

function normalizeStockInfo(symbol: string, raw: any): StockSummary {
	const data = unwrapApiData(raw);

	const price = Number(
		data?.price ??
			data?.regularMarketPrice ??
			data?.stck_prpr ??
			data?.output?.stck_prpr ??
			0,
	);

	const previousClose = Number(
		data?.regularMarketPreviousClose ??
			data?.stck_sdpr ??
			data?.output?.stck_sdpr ??
			0,
	);

	const changePrice = Number(
		data?.changePrice ??
			data?.regularMarketChange ??
			data?.prdy_vrss ??
			data?.output?.prdy_vrss ??
			(price && previousClose ? price - previousClose : 0),
	);

	const changeRate = Number(
		data?.changeRate ??
			data?.regularMarketChangePercent ??
			data?.prdy_ctrt ??
			data?.output?.prdy_ctrt ??
			0,
	);

	const name =
		data?.name ??
		data?.longName ??
		data?.longname ??
		data?.shortName ??
		data?.shortname ??
		data?.hts_kor_isnm ??
		data?.output?.hts_kor_isnm ??
		symbol;

	return {
		symbol: data?.symbol ?? data?.code ?? symbol,
		name,
		market: data?.market ?? data?.exchange ?? "KRX",
		assetType: data?.assetType ?? "STOCK",
		tradable: data?.tradable ?? true,
		price,
		changePrice,
		changeRate,
		volume: Number(
			data?.volume ??
				data?.regularMarketVolume ??
				data?.acml_vol ??
				data?.output?.acml_vol ??
				0,
		),
		high: Number(
			data?.high ??
				data?.regularMarketDayHigh ??
				data?.stck_hgpr ??
				data?.output?.stck_hgpr ??
				0,
		),
		low: Number(
			data?.low ??
				data?.regularMarketDayLow ??
				data?.stck_lwpr ??
				data?.output?.stck_lwpr ??
				0,
		),
		open: Number(
			data?.open ??
				data?.regularMarketOpen ??
				data?.stck_oprc ??
				data?.output?.stck_oprc ??
				0,
		),
		fetchedAt: data?.fetchedAt,
	};
}

function normalizeSearchResults(raw: any): SearchResult[] {
	const list = unwrapApiData(raw);

	if (!Array.isArray(list)) return [];

	return list
		.map((item: any) => ({
			symbol: item?.symbol ?? item?.code ?? item?.pdno ?? "",
			name:
				item?.name ??
				item?.longName ??
				item?.longname ??
				item?.shortName ??
				item?.shortname ??
				item?.shortname ??
				item?.prdt_name ??
				item?.longname ??
				"",
			market:
				item?.market ??
				item?.exchange ??
				item?.exchDisp ??
				item?.mket_id_cd ??
				"KOSPI/KOSDAQ",
			assetType: item?.assetType ?? item?.quoteType ?? "STOCK",
			tradable: item?.tradable ?? true,
			price:
				item?.price !== undefined || item?.regularMarketPrice !== undefined
					? Number(item?.price ?? item?.regularMarketPrice)
					: undefined,
			changeRate:
				item?.changeRate !== undefined ||
				item?.regularMarketChangePercent !== undefined
					? Number(item?.changeRate ?? item?.regularMarketChangePercent)
					: undefined,
		}))
		.filter((item) => item.symbol);
}

function normalizeHistorical(raw: any): ChartPoint[] {
	const list = unwrapApiData(raw);

	if (!Array.isArray(list)) return [];

	return list
		.map((item: any) => {
			if (Array.isArray(item)) {
				const close = Number(item[1] ?? 0);
				return {
					time: Math.floor(Number(item[0]) / 1000),
					open: close,
					high: close,
					low: close,
					close,
					volume: 0,
				};
			}

			const close = Number(
				item?.close ??
					item?.stck_clpr ??
					item?.stck_prpr ??
					item?.regularMarketPrice ??
					item?.price ??
					0,
			);

			return {
				time:
					Number(item?.time) ||
					Math.floor(Number(item?.timestamp ?? Date.now()) / 1000),
				open: Number(item?.open ?? item?.stck_oprc ?? close),
				high: Number(item?.high ?? item?.stck_hgpr ?? close),
				low: Number(item?.low ?? item?.stck_lwpr ?? close),
				close,
				volume: Number(item?.volume ?? item?.acml_vol ?? item?.cntg_vol ?? 0),
			};
		})
		.filter((item: ChartPoint) => item.close > 0 && item.time > 0)
		.sort((a: ChartPoint, b: ChartPoint) => a.time - b.time);
}
function normalizeStockDetail(raw: any): StockDetail | null {
	const data = unwrapApiData(raw);

	if (!data) return null;

	return {
		symbol: data.symbol ?? "",
		name: data.name ?? data.longName ?? data.shortName ?? data.symbol ?? "",
		market: data.market ?? "KRX",
		assetType: data.assetType ?? "STOCK",
		tradable: data.tradable ?? true,

		price: Number(data.price ?? 0),
		changePrice: Number(data.changePrice ?? 0),
		changeRate: Number(data.changeRate ?? 0),
		open: Number(data.open ?? 0),
		high: Number(data.high ?? 0),
		low: Number(data.low ?? 0),
		volume: Number(data.volume ?? 0),

		marketCap: data.marketCap ?? null,
		per: data.per ?? null,
		pbr: data.pbr ?? null,
		eps: data.eps ?? null,
		bps: data.bps ?? null,
		roe: data.roe ?? null,
		revenue: data.revenue ?? null,
		operatingProfit: data.operatingProfit ?? null,
		netIncome: data.netIncome ?? null,

		summary: data.summary ?? "",
		fetchedAt: data.fetchedAt,
	};
}

function formatOptionalNumber(value?: number | null, suffix = "") {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return "정보 없음";
	}

	return `${formatNumber.format(value)}${suffix}`;
}

function formatDateTime(timestampSeconds: number) {
	const date = new Date(timestampSeconds * 1000);

	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const mi = String(date.getMinutes()).padStart(2, "0");

	return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function InteractiveStockChart({
	data,
	height = 390,
}: {
	data: ChartPoint[];
	height?: number;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const chartRef = useRef<IChartApi | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		containerRef.current.innerHTML = "";

		if (data.length === 0) {
			return;
		}

		const chart = createChart(containerRef.current, {
			width: containerRef.current.clientWidth,
			height,
			layout: {
				background: { color: "#ffffff" },
				textColor: "#1A202C",
			},
			grid: {
				vertLines: { color: "#edf2f7" },
				horzLines: { color: "#edf2f7" },
			},
			crosshair: {
				mode: 1,
			},
			rightPriceScale: {
				borderColor: "#e2e8f0",
			},
			timeScale: {
				borderColor: "#e2e8f0",
				timeVisible: true,
				secondsVisible: false,
			},
		});

		chartRef.current = chart;

		const candleSeries = chart.addCandlestickSeries({
			upColor: "#e53e3e",
			downColor: "#3182ce",
			borderUpColor: "#e53e3e",
			borderDownColor: "#3182ce",
			wickUpColor: "#e53e3e",
			wickDownColor: "#3182ce",
		});

		const volumeSeries = chart.addHistogramSeries({
			priceFormat: {
				type: "volume",
			},
			priceScaleId: "",
		});

		volumeSeries.priceScale().applyOptions({
			scaleMargins: {
				top: 0.82,
				bottom: 0,
			},
		});

		const candleData: CandlestickData[] = data.map((item) => ({
			time: item.time as any,
			open: item.open,
			high: item.high,
			low: item.low,
			close: item.close,
		}));

		const volumeData: HistogramData[] = data.map((item) => ({
			time: item.time as any,
			value: item.volume || 0,
			color: item.close >= item.open ? "#e53e3e" : "#3182ce",
		}));

		candleSeries.setData(candleData);
		volumeSeries.setData(volumeData);
		chart.timeScale().fitContent();

		const tooltip = document.createElement("div");
		tooltip.style.position = "absolute";
		tooltip.style.display = "none";
		tooltip.style.pointerEvents = "none";
		tooltip.style.zIndex = "20";
		tooltip.style.padding = "10px 12px";
		tooltip.style.border = "1px solid #e2e8f0";
		tooltip.style.borderRadius = "8px";
		tooltip.style.background = "rgba(255, 255, 255, 0.96)";
		tooltip.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.12)";
		tooltip.style.fontSize = "12px";
		tooltip.style.lineHeight = "1.5";
		tooltipRef.current = tooltip;
		containerRef.current.appendChild(tooltip);

		chart.subscribeCrosshairMove((param: any) => {
			if (!tooltipRef.current || !containerRef.current) return;

			if (
				!param.point ||
				param.point.x < 0 ||
				param.point.y < 0 ||
				param.point.x > containerRef.current.clientWidth ||
				param.point.y > height
			) {
				tooltipRef.current.style.display = "none";
				return;
			}

			const seriesData = param.seriesData.get(candleSeries) as
				| CandlestickData
				| undefined;

			if (!seriesData) {
				tooltipRef.current.style.display = "none";
				return;
			}

			const currentPoint = data.find(
				(item) => Number(item.time) === Number(seriesData.time),
			);

			const volume = currentPoint?.volume ?? 0;
			const isUp = seriesData.close >= seriesData.open;
			const color = isUp ? "#e53e3e" : "#3182ce";

			tooltipRef.current.innerHTML = `
				<div style="font-weight:700; margin-bottom:4px;">
					${formatDateTime(Number(seriesData.time))}
				</div>
				<div>시가: <b>${won.format(seriesData.open)}</b></div>
				<div>고가: <b style="color:#e53e3e;">${won.format(seriesData.high)}</b></div>
				<div>저가: <b style="color:#3182ce;">${won.format(seriesData.low)}</b></div>
				<div>종가: <b style="color:${color};">${won.format(seriesData.close)}</b></div>
				<div>거래량: <b>${formatNumber.format(volume)}</b></div>
			`;

			const tooltipWidth = 170;
			const tooltipHeight = 140;

			let left = param.point.x + 16;
			let top = param.point.y + 16;

			if (left + tooltipWidth > containerRef.current.clientWidth) {
				left = param.point.x - tooltipWidth - 16;
			}

			if (top + tooltipHeight > height) {
				top = param.point.y - tooltipHeight - 16;
			}

			tooltipRef.current.style.left = `${left}px`;
			tooltipRef.current.style.top = `${top}px`;
			tooltipRef.current.style.display = "block";
		});

		const resizeObserver = new ResizeObserver(() => {
			if (containerRef.current) {
				chart.applyOptions({
					width: containerRef.current.clientWidth,
				});
			}
		});

		resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
			chart.remove();
		};
	}, [data, height]);

	if (data.length === 0) {
		return (
			<Flex
				h={`${height}px`}
				align="center"
				justify="center"
				bg="gray.50"
				borderRadius="lg"
			>
				<Text color="gray.500">차트 데이터를 불러오면 이 영역에 표시됩니다.</Text>
			</Flex>
		);
	}

	return (
		<Box
			ref={containerRef}
			position="relative"
			width="100%"
			height={`${height}px`}
			bg="white"
		/>
	);
}
function OrderBookPanel({
	orderBook,
	isLoading,
	currentPrice,
}: {
	orderBook: OrderBookData | null;
	isLoading: boolean;
	currentPrice: number;
}) {
	if (isLoading) {
		return (
			<Flex h="260px" align="center" justify="center">
				<Spinner />
			</Flex>
		);
	}

	if (!orderBook || orderBook.levels.length === 0) {
		return (
			<Flex h="260px" align="center" justify="center">
				<Text color="gray.500">호가 정보를 불러오지 못했습니다.</Text>
			</Flex>
		);
	}

	const maxVolume = Math.max(
		...orderBook.levels.flatMap((item) => [item.askVolume, item.bidVolume]),
		1,
	);

	const asks = [...orderBook.levels].reverse();
	const bids = orderBook.levels;

	return (
		<Box>
			<Flex mb="3" align="center">
				<Box>
					<Heading size="sm">호가창</Heading>
					<Text fontSize="sm" color="gray.500">
						매도/매수 10호가
					</Text>
				</Box>
				<Spacer />
				<Text fontSize="sm" color="gray.500">
					{new Date(orderBook.fetchedAt).toLocaleTimeString("ko-KR")}
				</Text>
			</Flex>

			<Box borderWidth="1px" borderRadius="lg" overflow="hidden">
				{asks.map((item) => {
					const width = `${Math.max((item.askVolume / maxVolume) * 100, 4)}%`;

					return (
						<Flex
							key={`ask-${item.level}`}
							position="relative"
							px="3"
							py="1.5"
							align="center"
							bg="red.50"
							borderBottomWidth="1px"
						>
							<Box
								position="absolute"
								right="0"
								top="0"
								h="100%"
								w={width}
								bg="red.100"
								opacity={0.8}
							/>
							<Text zIndex={1} flex="1" color="red.500" fontWeight="700">
								{won.format(item.askPrice)}
							</Text>
							<Text zIndex={1} fontSize="sm">
								{formatNumber.format(item.askVolume)}
							</Text>
						</Flex>
					);
				})}

				<Flex px="3" py="2" align="center" bg="white" borderBottomWidth="1px">
					<Text fontWeight="900">현재가</Text>
					<Spacer />
					<Text fontWeight="900">{won.format(currentPrice)}</Text>
				</Flex>

				{bids.map((item) => {
					const width = `${Math.max((item.bidVolume / maxVolume) * 100, 4)}%`;

					return (
						<Flex
							key={`bid-${item.level}`}
							position="relative"
							px="3"
							py="1.5"
							align="center"
							bg="blue.50"
							borderBottomWidth="1px"
						>
							<Box
								position="absolute"
								left="0"
								top="0"
								h="100%"
								w={width}
								bg="blue.100"
								opacity={0.8}
							/>
							<Text zIndex={1} flex="1" color="blue.500" fontWeight="700">
								{won.format(item.bidPrice)}
							</Text>
							<Text zIndex={1} fontSize="sm">
								{formatNumber.format(item.bidVolume)}
							</Text>
						</Flex>
					);
				})}
			</Box>

			<SimpleGrid columns={2} spacing="3" mt="3">
				<Box bg="gray.50" p="3" borderRadius="lg">
					<Text fontSize="sm" color="gray.500">
						총 매도잔량
					</Text>
					<Text fontWeight="800">
						{formatNumber.format(orderBook.totalAskVolume)}
					</Text>
				</Box>

				<Box bg="gray.50" p="3" borderRadius="lg">
					<Text fontSize="sm" color="gray.500">
						총 매수잔량
					</Text>
					<Text fontWeight="800">
						{formatNumber.format(orderBook.totalBidVolume)}
					</Text>
				</Box>
			</SimpleGrid>
		</Box>
	);
}
function PriceHistoryTable({
	chartPoints,
}: {
	chartPoints: ChartPoint[];
}) {
	const rows = [...chartPoints].slice(-8).reverse();

	return (
		<Box>
			<Flex mb="3" align="center">
				<Box>
					<Heading size="sm">가격 기록</Heading>
					<Text fontSize="sm" color="gray.500">
						현재 차트 데이터 기준
					</Text>
				</Box>
			</Flex>

			<Box borderWidth="1px" borderRadius="lg" overflow="hidden">
				<Table size="sm">
					<Thead>
						<Tr>
							<Th>일자/시간</Th>
							<Th isNumeric>종가</Th>
							<Th isNumeric>등락률</Th>
							<Th isNumeric>거래량</Th>
						</Tr>
					</Thead>
					<Tbody>
						{rows.map((point, index) => {
							const prev = rows[index + 1];
							const changeRate =
								prev && prev.close > 0
									? ((point.close - prev.close) / prev.close) * 100
									: 0;

							return (
								<Tr key={`${point.time}-${index}`}>
									<Td>
										{new Date(point.time * 1000).toLocaleString("ko-KR", {
											month: "2-digit",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Td>
									<Td isNumeric>{won.format(point.close)}</Td>
									<Td
										isNumeric
										color={
											changeRate > 0
												? "red.500"
												: changeRate < 0
													? "blue.500"
													: "gray.500"
										}
									>
										{changeRate > 0 ? "+" : ""}
										{changeRate.toFixed(2)}%
									</Td>
									<Td isNumeric>{formatNumber.format(point.volume ?? 0)}</Td>
								</Tr>
							);
						})}

						{rows.length === 0 && (
							<Tr>
								<Td colSpan={4}>
									<Text color="gray.500">가격 기록이 없습니다.</Text>
								</Td>
							</Tr>
						)}
					</Tbody>
				</Table>
			</Box>
		</Box>
	);
}
function StockDetailPanel({
	detail,
	isLoading,
}: {
	detail: StockDetail | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<Flex h="320px" align="center" justify="center">
				<Spinner />
			</Flex>
		);
	}

	if (!detail) {
		return (
			<Flex h="320px" align="center" justify="center">
				<Text color="gray.500">종목 상세정보를 불러오지 못했습니다.</Text>
			</Flex>
		);
	}

	return (
		<Stack spacing="5">
			<Box>
				<Heading size="md">{detail.name}</Heading>
				<Text mt="1" color="gray.500">
					{detail.symbol} · {detail.market} · {detail.assetType}
				</Text>
				<Text mt="3" color="gray.700">
					{detail.summary || "요약 정보가 없습니다."}
				</Text>
			</Box>

			<Divider />

			<SimpleGrid columns={{ base: 2, md: 4 }} spacing="4">
				<Stat>
					<StatLabel>현재가</StatLabel>
					<StatNumber fontSize="lg">{won.format(detail.price)}</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>등락률</StatLabel>
					<StatNumber
						fontSize="lg"
						color={detail.changeRate >= 0 ? "red.500" : "blue.500"}
					>
						{detail.changeRate.toFixed(2)}%
					</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>거래량</StatLabel>
					<StatNumber fontSize="lg">
						{formatNumber.format(detail.volume)}
					</StatNumber>
				</Stat>

				<Stat>
					<StatLabel>거래 가능 여부</StatLabel>
					<StatNumber fontSize="lg">
						{detail.tradable ? "가능" : "제한"}
					</StatNumber>
				</Stat>
			</SimpleGrid>

			<Divider />

			<Box>
				<Heading size="sm" mb="3">
					재무 요약
				</Heading>

				<SimpleGrid columns={{ base: 2, md: 4 }} spacing="4">
					<Stat>
						<StatLabel>시가총액</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.marketCap)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>PER</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.per, "배")}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>PBR</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.pbr, "배")}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>ROE</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.roe, "%")}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>EPS</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.eps)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>BPS</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.bps)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>매출액</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.revenue)}
						</StatNumber>
					</Stat>

					<Stat>
						<StatLabel>영업이익</StatLabel>
						<StatNumber fontSize="md">
							{formatOptionalNumber(detail.operatingProfit)}
						</StatNumber>
					</Stat>
				</SimpleGrid>

				<Text mt="3" fontSize="sm" color="gray.500">
					※ 현재 재무지표는 API 구조만 연결된 상태입니다. 실제 PER, PBR, ROE,
					매출액 등은 재무제표 API 연결 후 표시됩니다.
				</Text>
			</Box>
		</Stack>
	);
}

export default function Exchange() {
	const toast = useToast();

	const [selectedSymbol, setSelectedSymbol] = useState("005930");
	const [searchKeyword, setSearchKeyword] = useState("삼성전자");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [stock, setStock] = useState<StockSummary | null>(null);
	const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
	const [isLoadingStock, setIsLoadingStock] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
	const [isLoadingDetail, setIsLoadingDetail] = useState(false);

	const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
	const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);

	const [searchPrices, setSearchPrices] = useState<Record<string, SearchResultPrice>>({});

	const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1d");
	const [chartInterval, setChartInterval] = useState<ChartInterval>("1m");

	const [quantity, setQuantity] = useState(1);
	const [orderType, setOrderType] =
	useState<TradingOrderType>("MARKET");

	const [limitPrice, setLimitPrice] =
	useState<number>(0);

	const [portfolio, setPortfolio] =
	useState<PortfolioData | null>(null);

	const [tradeOrders, setTradeOrders] =
	useState<TradeOrderData[]>([]);

	const [isLoadingTrading, setIsLoadingTrading] =
	useState(false);

	const [isSubmittingOrder, setIsSubmittingOrder] =
	useState(false);

	const selectedHolding = useMemo(() => {
	if (!stock || !portfolio?.holdings) return null;

	return (
		portfolio.holdings.find(
			(holding) => holding.symbol === stock.symbol,
		) ?? null
	);
}, [stock, portfolio]);

	const isUp = (stock?.changeRate ?? 0) >= 0;

	const selectedChartLabel = useMemo(() => {
		return (
			chartOptions.find(
				(option) =>
					option.period === chartPeriod && option.interval === chartInterval,
			)?.label ?? "1분"
		);
	}, [chartPeriod, chartInterval]);

	const fetchStockWithChartOption = async (
		symbol: string,
		period: ChartPeriod,
		interval: ChartInterval,
	) => {
		try {
			setIsLoadingStock(true);

			const infoRes = await api.get(`/stocks/${symbol}/info`);
			setStock(normalizeStockInfo(symbol, infoRes.data));
			fetchStockDetail(symbol);
			fetchOrderBook(symbol);
			

			await new Promise((resolve) => setTimeout(resolve, 500));

			try {
				const historicalRes = await api.get(
					`/stocks/${symbol}/historical?period=${period}&interval=${interval}`,
				);
				setChartPoints(normalizeHistorical(historicalRes.data));
			} catch (chartError) {
				console.error(chartError);
				setChartPoints([]);
				toast({
					title: "차트 데이터를 불러오지 못했습니다.",
					description: "잠시 후 다시 시도하세요.",
					status: "warning",
					isClosable: true,
				});
			}
		} catch (error: any) {
			console.error(error);

			const message =
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				"백엔드 KIS API 연결 상태를 확인하세요.";

			toast({
				title: "종목 정보를 불러오지 못했습니다.",
				description: message,
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsLoadingStock(false);
		}
	};
	const fetchOrderBook = async (symbol: string) => {
	try {
		setIsLoadingOrderBook(true);

		const res = await api.get(`/stocks/${symbol}/orderbook`);
		setOrderBook(unwrapApiData(res.data));
	} catch (error) {
		console.error(error);
		setOrderBook(null);
	} finally {
		setIsLoadingOrderBook(false);
	}
};
	
	const fetchStockDetail = async (symbol: string) => {
	try {
		setIsLoadingDetail(true);

		const res = await api.get(`/stocks/${symbol}/detail`);
		setStockDetail(normalizeStockDetail(res.data));
	} catch (error) {
		console.error(error);
		setStockDetail(null);

		toast({
			title: "종목 상세정보를 불러오지 못했습니다.",
			status: "warning",
			isClosable: true,
		});
	} finally {
		setIsLoadingDetail(false);
	}
};

	const fetchStock = async (symbol: string) => {
		await fetchStockWithChartOption(symbol, chartPeriod, chartInterval);
	};
	const loadTradingData = async () => {
	try {
		setIsLoadingTrading(true);

		const [portfolioRes, ordersRes] = await Promise.all([
			api.get("/trading/portfolio?evaluate=false"),
			api.get("/trading/orders?limit=50"),
		]);

		setPortfolio(unwrapApiData(portfolioRes.data));
		setTradeOrders(unwrapApiData(ordersRes.data));
	} catch (error) {
		console.error(error);

		toast({
			title: "모의투자 정보를 불러오지 못했습니다.",
			status: "warning",
			isClosable: true,
		});
	} finally {
		setIsLoadingTrading(false);
	}
};
const refreshPortfolioEvaluation = async () => {
	try {
		setIsLoadingTrading(true);

		const res = await api.get("/trading/portfolio?evaluate=true");
		setPortfolio(unwrapApiData(res.data));

		toast({
			title: "포트폴리오 평가금액을 갱신했습니다.",
			status: "success",
			isClosable: true,
		});
	} catch (error) {
		console.error(error);

		toast({
			title: "평가금액 갱신 실패",
			status: "warning",
			isClosable: true,
		});
	} finally {
		setIsLoadingTrading(false);
	}
};

const submitTradeOrder = async (side: TradingOrderSide) => {
	if (!stock) {
		toast({
			title: "종목을 먼저 선택하세요.",
			status: "warning",
			isClosable: true,
		});
		return;
	}

	if (!quantity || quantity <= 0) {
		toast({
			title: "수량은 1 이상이어야 합니다.",
			status: "warning",
			isClosable: true,
		});
		return;
	}

	if (orderType === "LIMIT" && (!limitPrice || limitPrice <= 0)) {
		toast({
			title: "지정가를 입력하세요.",
			status: "warning",
			isClosable: true,
		});
		return;
	}

	try {
		setIsSubmittingOrder(true);

		const body = {
			symbol: stock.symbol,
			name: stock.name,
			side,
			orderType,
			quantity,
			limitPrice: orderType === "LIMIT" ? limitPrice : undefined,
		};

		const res = await api.post("/trading/orders", body);
		const order = unwrapApiData(res.data) as TradeOrderData;

		const statusText =
			order.status === "FILLED"
				? "체결"
				: order.status === "PENDING"
					? "미체결 주문 등록"
					: order.status;

		toast({
			title:
				side === "BUY"
					? `매수 주문 ${statusText}`
					: `매도 주문 ${statusText}`,
			description:
				order.orderType === "MARKET"
					? "시장가 주문이 처리되었습니다."
					: "지정가 주문이 처리되었습니다.",
			status: "success",
			isClosable: true,
		});

		await loadTradingData();
	} catch (error: any) {
		console.error(error);

		toast({
			title: "주문 처리 실패",
			description:
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				"주문 처리 중 오류가 발생했습니다.",
			status: "error",
			isClosable: true,
		});
	} finally {
		setIsSubmittingOrder(false);
	}
};

const cancelPendingOrder = async (orderId: string) => {
	try {
		await api.post(`/trading/orders/${orderId}/cancel`);

		toast({
			title: "미체결 주문이 취소되었습니다.",
			status: "success",
			isClosable: true,
		});

		await loadTradingData();
	} catch (error: any) {
		console.error(error);

		toast({
			title: "주문 취소 실패",
			description:
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				"주문 취소 중 오류가 발생했습니다.",
			status: "error",
			isClosable: true,
		});
	}
};

const checkPendingTradeOrders = async () => {
	try {
		const res = await api.post("/trading/orders/check-pending");
		const result = unwrapApiData(res.data);

		toast({
			title: "미체결 주문 확인 완료",
			description: `체결 ${result.filledCount ?? 0}건 / 확인 ${
				result.checkedCount ?? 0
			}건`,
			status: "info",
			isClosable: true,
		});

		await loadTradingData();
	} catch (error) {
		console.error(error);

		toast({
			title: "미체결 주문 확인 실패",
			status: "warning",
			isClosable: true,
		});
	}
};

const resetTradingAccount = async () => {
	try {
		await api.post("/trading/reset");

		toast({
			title: "모의투자 계좌가 초기화되었습니다.",
			status: "success",
			isClosable: true,
		});

		await loadTradingData();
	} catch (error) {
		console.error(error);

		toast({
			title: "계좌 초기화 실패",
			status: "error",
			isClosable: true,
		});
	}
};

	const searchStocks = async () => {
		if (!searchKeyword.trim()) return;

		try {
			setIsSearching(true);
			const res = await api.get(
				`/stocks/search/${encodeURIComponent(searchKeyword)}`,
			);
			const results = normalizeSearchResults(res.data);

			setSearchResults(results);
			const topResults = results.slice(0, 10);

const priceEntries = await Promise.all(
	topResults.map(async (item: any) => {
		try {
			const infoRes = await api.get(`/stocks/${item.symbol}/info`);
			const info = unwrapApiData(infoRes.data);

			return [
				item.symbol,
				{
					price: Number(info.price ?? info.regularMarketPrice ?? 0),
					changeRate: Number(
						info.changeRate ?? info.regularMarketChangePercent ?? 0,
					),
					changePrice: Number(
						info.changePrice ?? info.regularMarketChange ?? 0,
					),
				},
			] as const;
		} catch {
			return [
				item.symbol,
				{
					price: 0,
					changeRate: 0,
					changePrice: 0,
				},
			] as const;
		}
	}),
);

setSearchPrices(Object.fromEntries(priceEntries));

			if (results.length === 0) {
				toast({
					title: "검색 결과가 없습니다.",
					status: "info",
					isClosable: true,
				});
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "종목 검색에 실패했습니다.",
				description: "검색 API 또는 KIS 종목 조회 API를 확인하세요.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsSearching(false);
		}
	};

	const selectStock = (item: SearchResult) => {
		if (item.tradable === false) {
			toast({
				title: "현재 상세 조회를 지원하지 않는 상품입니다.",
				description: "국내 주식/ETF 중심으로 먼저 지원합니다.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		setSelectedSymbol(item.symbol);
		fetchStockWithChartOption(item.symbol, chartPeriod, chartInterval);
	};

	const changeChartOption = (period: ChartPeriod, interval: ChartInterval) => {
		setChartPeriod(period);
		setChartInterval(interval);
		fetchStockWithChartOption(selectedSymbol, period, interval);
	};

	useEffect(() => {
		fetchStock(selectedSymbol);
		loadTradingData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	

	

	return (
		<Box className="Exchange" px={{ base: 4, md: 8 }} py="6" bg="gray.50">
			<Flex mb="6" align="end" gap="4" wrap="wrap">
				<Box>
					<Heading size="lg">거래소</Heading>
					<Text color="gray.500" mt="1">
						KIS API 기반 실시간 모의투자 화면
					</Text>
				</Box>
				<Spacer />
				<Badge px="3" py="1" borderRadius="full" colorScheme="blue">
					실시간 모의투자
				</Badge>
			</Flex>

			<Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) 360px" }} gap="5">
				<GridItem>
					<Card mb="5">
						<CardBody>
							{isLoadingStock || !stock ? (
								<Flex h="120px" align="center" justify="center">
									<Spinner />
								</Flex>
							) : (
								<Flex align="start" gap="6" wrap="wrap">
									<Box minW="240px">
										<Text color="gray.500" fontWeight="700">
											{stock.symbol} · {stock.market}
										</Text>
										<Heading size="lg">{stock.name}</Heading>
										<Heading mt="3" size="xl">
											{won.format(stock.price)}
										</Heading>
										<Text
											color={isUp ? "red.500" : "blue.500"}
											fontWeight="800"
										>
											{isUp ? "▲" : "▼"} {won.format(Math.abs(stock.changePrice))}{" "}
											({stock.changeRate.toFixed(2)}%)
										</Text>
									</Box>

									<SimpleGrid columns={{ base: 2, md: 4 }} spacing="4" flex="1">
										<Stat>
											<StatLabel>시가</StatLabel>
											<StatNumber fontSize="lg">
												{won.format(stock.open)}
											</StatNumber>
										</Stat>
										<Stat>
											<StatLabel>고가</StatLabel>
											<StatNumber fontSize="lg">
												{won.format(stock.high)}
											</StatNumber>
										</Stat>
										<Stat>
											<StatLabel>저가</StatLabel>
											<StatNumber fontSize="lg">
												{won.format(stock.low)}
											</StatNumber>
										</Stat>
										<Stat>
											<StatLabel>거래량</StatLabel>
											<StatNumber fontSize="lg">
												{formatNumber.format(stock.volume)}
											</StatNumber>
										</Stat>
									</SimpleGrid>
								</Flex>
							)}
						</CardBody>
					</Card>

					<Card mb="5">
	<CardBody>
		<Tabs variant="enclosed" colorScheme="blue">
			<TabList>
				<Tab>차트</Tab>
				<Tab>정보</Tab>
			</TabList>

			<TabPanels>
				<TabPanel px="0" pb="0">
					<Flex align="center" gap="3" wrap="wrap" mb="4">
						<Box>
							<Heading size="md">가격 차트</Heading>
							<Text fontSize="sm" color="gray.500" mt="1">
								현재 선택: {selectedChartLabel}
							</Text>
						</Box>
						<Spacer />
						<HStack spacing="2" wrap="wrap">
							{chartOptions.map((option) => (
								<Button
									key={option.label}
									size="xs"
									variant={
										chartPeriod === option.period &&
										chartInterval === option.interval
											? "solid"
											: "outline"
									}
									colorScheme={
										chartPeriod === option.period &&
										chartInterval === option.interval
											? "blue"
											: "gray"
									}
									onClick={() =>
										changeChartOption(option.period, option.interval)
									}
									isDisabled={isLoadingStock}
								>
									{option.label}
								</Button>
							))}
						</HStack>
					</Flex>

					{isLoadingStock ? (
						<Flex h="390px" align="center" justify="center">
							<Spinner />
						</Flex>
					) : (
						<InteractiveStockChart data={chartPoints} height={390} />
					)}
				</TabPanel>

				<TabPanel px="0" pb="0">
					<StockDetailPanel
						detail={stockDetail}
						isLoading={isLoadingDetail}
					/>
				</TabPanel>
			</TabPanels>
		</Tabs>
	</CardBody>
</Card>

					<Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="5" mb="5">
	<Card>
		<CardBody>
			<OrderBookPanel
				orderBook={orderBook}
				isLoading={isLoadingOrderBook}
				currentPrice={stock?.price ?? 0}
			/>
		</CardBody>
	</Card>

	<Card>
		<CardBody>
			<PriceHistoryTable chartPoints={chartPoints} />
		</CardBody>
	</Card>
</Grid>

					<Card mt="5">
	<CardHeader pb="0">
		<Flex align="center">
			<Box>
				<Heading size="md">모의투자 주문</Heading>
				<Text mt="1" fontSize="sm" color="gray.500">
					시장가/지정가 매수·매도 주문을 실행합니다.
				</Text>
			</Box>
			<Spacer />
			<Button size="sm" variant="outline" onClick={checkPendingTradeOrders}>
				미체결 확인
			</Button>
		</Flex>
	</CardHeader>

	<CardBody>
		<SimpleGrid columns={{ base: 1, md: 4 }} spacing="4" mb="5">
			<Stat>
				<StatLabel>보유 현금</StatLabel>
				<StatNumber fontSize="lg">
					{won.format(portfolio?.account?.cash ?? 0)}
				</StatNumber>
			</Stat>

			<Stat>
				<StatLabel>주문 가능 금액</StatLabel>
				<StatNumber fontSize="lg">
					{won.format(portfolio?.account?.availableCash ?? 0)}
				</StatNumber>
			</Stat>

			<Stat>
				<StatLabel>예약 금액</StatLabel>
				<StatNumber fontSize="lg">
					{won.format(portfolio?.account?.reservedCash ?? 0)}
				</StatNumber>
			</Stat>

			<Stat>
				<StatLabel>선택 종목 보유수량</StatLabel>
				<StatNumber fontSize="lg">
					{formatNumber.format(selectedHolding?.quantity ?? 0)}주
				</StatNumber>
			</Stat>
		</SimpleGrid>

		<Flex gap="3" wrap="wrap" align="center">
			<HStack>
				<Button
					size="sm"
					colorScheme={orderType === "MARKET" ? "blue" : "gray"}
					variant={orderType === "MARKET" ? "solid" : "outline"}
					onClick={() => setOrderType("MARKET")}
				>
					시장가
				</Button>
				<Button
					size="sm"
					colorScheme={orderType === "LIMIT" ? "blue" : "gray"}
					variant={orderType === "LIMIT" ? "solid" : "outline"}
					onClick={() => setOrderType("LIMIT")}
				>
					지정가
				</Button>
			</HStack>

			<NumberInput
				value={quantity}
				min={1}
				maxW="140px"
				onChange={(_, value) =>
					setQuantity(Number.isNaN(value) ? 1 : value)
				}
			>
				<NumberInputField placeholder="수량" />
			</NumberInput>

			{orderType === "LIMIT" && (
				<NumberInput
					value={limitPrice || ""}
					min={1}
					maxW="180px"
					onChange={(_, value) =>
						setLimitPrice(Number.isNaN(value) ? 0 : value)
					}
				>
					<NumberInputField placeholder="지정가" />
				</NumberInput>
			)}

			<Button
				colorScheme="red"
				onClick={() => submitTradeOrder("BUY")}
				isLoading={isSubmittingOrder}
				isDisabled={!stock}
			>
				매수
			</Button>

			<Button
				colorScheme="blue"
				onClick={() => submitTradeOrder("SELL")}
				isLoading={isSubmittingOrder}
				isDisabled={!stock}
			>
				매도
			</Button>

			<Button
				variant="ghost"
				size="sm"
				onClick={resetTradingAccount}
				isDisabled={isLoadingTrading}
			>
				계좌 초기화
			</Button>
		</Flex>

		<Text mt="3" fontSize="sm" color="gray.500">
			※ 관망 판단은 AI라면 기능에서만 제공합니다. 실제 모의투자 주문은 매수와 매도만 지원합니다.
		</Text>
	</CardBody>
</Card>

					<Card mt="5">
	<CardHeader pb="0">
		<Heading size="md">주문 / 체결 내역</Heading>
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
					<Th isNumeric>수량</Th>
					<Th isNumeric>주문가</Th>
					<Th isNumeric>체결가</Th>
					<Th isNumeric>실현손익</Th>
					<Th>관리</Th>
				</Tr>
			</Thead>

			<Tbody>
				{tradeOrders.map((order) => (
					<Tr key={order._id}>
						<Td>{new Date(order.createdAt).toLocaleString("ko-KR")}</Td>

						<Td>
							<Badge colorScheme={order.side === "BUY" ? "red" : "blue"}>
								{order.side === "BUY" ? "매수" : "매도"}
							</Badge>
						</Td>

						<Td>
							{order.orderType === "MARKET" ? "시장가" : "지정가"}
						</Td>

						<Td>
							<Badge
								colorScheme={
									order.status === "FILLED"
										? "green"
										: order.status === "PENDING"
											? "yellow"
											: order.status === "CANCELED"
												? "gray"
												: "red"
								}
							>
								{order.status === "FILLED"
									? "체결"
									: order.status === "PENDING"
										? "미체결"
										: order.status === "CANCELED"
											? "취소"
											: "거절"}
							</Badge>
						</Td>

						<Td>
							{order.name}({order.symbol})
						</Td>

						<Td isNumeric>{formatNumber.format(order.quantity)}</Td>

						<Td isNumeric>
							{order.limitPrice
								? won.format(order.limitPrice)
								: won.format(order.orderPrice || 0)}
						</Td>

						<Td isNumeric>
							{order.executedPrice ? won.format(order.executedPrice) : "-"}
						</Td>

						<Td
							isNumeric
							color={
								order.realizedProfit > 0
									? "red.500"
									: order.realizedProfit < 0
										? "blue.500"
										: "gray.700"
							}
						>
							{order.realizedProfit
								? won.format(order.realizedProfit)
								: "-"}
						</Td>

						<Td>
							{order.status === "PENDING" ? (
								<Button
									size="xs"
									variant="outline"
									onClick={() => cancelPendingOrder(order._id)}
								>
									취소
								</Button>
							) : (
								"-"
							)}
						</Td>
					</Tr>
				))}

				{tradeOrders.length === 0 && (
					<Tr>
						<Td colSpan={10}>
							<Text color="gray.500">아직 주문 내역이 없습니다.</Text>
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
							<Heading size="md">종목 검색</Heading>
						</CardHeader>
						<CardBody>
							<Stack>
								<HStack>
									<Input
										value={searchKeyword}
										onChange={(e) => setSearchKeyword(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") searchStocks();
										}}
										placeholder="종목명 또는 종목코드"
									/>
									<Button onClick={searchStocks} isLoading={isSearching}>
										검색
									</Button>
								</HStack>

								<Stack spacing="2">
									{searchResults.map((item) => {
	const priceInfo = searchPrices[item.symbol];

	return (
		<Box
			key={item.symbol}
			p="3"
			borderWidth="1px"
			borderRadius="lg"
			cursor="pointer"
			_hover={{ bg: "gray.50" }}
			onClick={() =>
				fetchStockWithChartOption(item.symbol, chartPeriod, chartInterval)
			}
		>
			<Flex align="center">
				<Box>
					<Text fontWeight="800">{item.name}</Text>
					<Text fontSize="sm" color="gray.500">
						{item.symbol} · {item.market}
					</Text>
				</Box>

				<Spacer />

				<Box textAlign="right">
					<Text fontWeight="800">
						{priceInfo?.price ? won.format(priceInfo.price) : "조회 전"}
					</Text>
					<Text
						fontSize="sm"
						color={
							(priceInfo?.changeRate ?? 0) > 0
								? "red.500"
								: (priceInfo?.changeRate ?? 0) < 0
									? "blue.500"
									: "gray.500"
						}
					>
						{priceInfo
							? `${priceInfo.changeRate > 0 ? "+" : ""}${priceInfo.changeRate.toFixed(2)}%`
							: ""}
					</Text>
				</Box>
			</Flex>
		</Box>
	);
})}
								</Stack>
							</Stack>
						</CardBody>
					</Card>

					<Card mb="5">
	<CardHeader pb="0">
		<Flex align="center">
			<Heading size="md">보유 종목</Heading>

			<Spacer />

			<Button
				size="sm"
				variant="outline"
				onClick={refreshPortfolioEvaluation}
				isLoading={isLoadingTrading}
			>
				평가금액 갱신
			</Button>
		</Flex>
	</CardHeader>

	<CardBody>
		<Stack spacing="3">
			{portfolio?.holdings?.map((holding) => (
				<Box
					key={holding.symbol}
					p="3"
					borderWidth="1px"
					borderRadius="lg"
					cursor="pointer"
					_hover={{ bg: "gray.50" }}
					onClick={() =>
						fetchStockWithChartOption(
							holding.symbol,
							chartPeriod,
							chartInterval,
						)
					}
				>
					<Flex align="center">
						<Box>
							<Text fontWeight="800">{holding.name}</Text>
							<Text fontSize="sm" color="gray.500">
								{holding.symbol} · {formatNumber.format(holding.quantity)}주
							</Text>
						</Box>
						<Spacer />
						<Text
							fontWeight="800"
							color={holding.profitLoss >= 0 ? "red.500" : "blue.500"}
						>
							{holding.profitLossRate.toFixed(2)}%
						</Text>
					</Flex>

					<Text mt="2" fontSize="sm" color="gray.600">
						평균 {won.format(holding.avgPrice)} · 현재{" "}
						{won.format(holding.currentPrice)}
					</Text>
				</Box>
			))}

			{(!portfolio?.holdings || portfolio.holdings.length === 0) && (
				<Text color="gray.500">아직 보유 종목이 없습니다.</Text>
			)}
		</Stack>
	</CardBody>
</Card>
				</GridItem>
			</Grid>
			<AiAssistantPanel
			stock={stock}
			chartPoints={chartPoints}
			chartPeriod={chartPeriod}
			chartInterval={chartInterval}
			
		/>
		<MarketSimulatorPanel stock={stock} />
		</Box>
	);
}