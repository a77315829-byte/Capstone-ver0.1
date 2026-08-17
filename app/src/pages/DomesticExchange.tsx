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
import type { MarketStatus } from "../types/marketSession.types";
import AiRamenPanel from "../components/AiRamenPanel";
import MarketSimulatorPanel from "../components/MarketSimulatorPanel";
import RelatedFinancialTerms from "../components/RelatedFinancialTerms";
import CompactStockNews from "../components/CompactStockNews";


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

type MarketExecutionItem = {
	time: string;
	price: number;
	quantity: number;
	changePrice: number;
	changeRate: number;
	cumulativeVolume: number;
	strength: number;
	direction: "UP" | "DOWN" | "FLAT";
};

type MarketExecutionData = {
	symbol: string;
	items: MarketExecutionItem[];
	fetchedAt: string;
};

type InvestorTrendPeriod = "1d" | "5d" | "30d" | "60d";

type InvestorTrendData = {
	symbol: string;
	period: InvestorTrendPeriod;
	requestedDays: number;
	availableDays: number;
	individual: number;
	foreign: number;
	institution: number;
	corporation: number;
	fetchedAt: string;
};

type SearchResultPrice = {
	price: number;
	changeRate: number;
	changePrice: number;
};
type TradingOrderSide = "BUY" | "SELL";
type TradingOrderType = "MARKET" | "LIMIT";
type OrderPanelMode = "BUY" | "SELL" | "MANAGE";
type DetailSection = "orderbook" | "executions" | "information";
type RightPanelMode = "ORDER" | "AI";
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
	totalDeposits?: number;
	manualDeposits?: number;
	salaryPlanDeposits?: number;
	salaryPlanFunding?: {
		enabled: boolean;
		amount: number;
		planId?: string | null;
		lastAppliedPeriod?: string | null;
	};
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

function IntegratedOrderBookPanel({
	orderBook,
	isLoading,
	stock,
	investorTrend,
	isLoadingInvestorTrend,
	investorPeriod,
	onInvestorPeriodChange,
}: {
	orderBook: OrderBookData | null;
	isLoading: boolean;
	stock: StockSummary | null;
	investorTrend: InvestorTrendData | null;
	isLoadingInvestorTrend: boolean;
	investorPeriod: InvestorTrendPeriod;
	onInvestorPeriodChange: (period: InvestorTrendPeriod) => void;
}) {
	if (isLoading) {
		return (
			<Flex minH="410px" align="center" justify="center">
				<Spinner color="brand.500" />
			</Flex>
		);
	}

	if (!orderBook || orderBook.levels.length === 0 || !stock) {
		return (
			<Flex minH="410px" align="center" justify="center">
				<Text color="app.subtleText">호가 정보를 불러오지 못했습니다.</Text>
			</Flex>
		);
	}

	const levels = orderBook.levels.slice(0, 8);
	const asks = [...levels].reverse();
	const bids = levels;
	const previousClose = stock.price - stock.changePrice;
	const estimatedTradingValue = stock.price * stock.volume;
	const maxDepthVolume = Math.max(
		...levels.flatMap((level) => [level.askVolume, level.bidVolume]),
		1,
	);

	const askRows = asks.map((level, index) => ({
		key: `ask-${level.level}`,
		price: level.askPrice,
		volume: level.askVolume,
		cumulative: asks
			.slice(0, index + 1)
			.reduce((sum, row) => sum + row.askVolume, 0),
	}));

	const bidRows = bids.map((level, index) => ({
		key: `bid-${level.level}`,
		price: level.bidPrice,
		volume: level.bidVolume,
		cumulative: bids
			.slice(0, index + 1)
			.reduce((sum, row) => sum + row.bidVolume, 0),
	}));

	const renderOrderRows = (
		rows: Array<{
			key: string;
			price: number;
			volume: number;
			cumulative: number;
		}>,
		side: "ask" | "bid",
	) => {
		const isAsk = side === "ask";

		return rows.map((row, index) => (
			<Grid
				key={row.key}
				templateColumns="1fr 1fr 1fr"
				minH="31px"
				alignItems="center"
				px={{ base: "7px", md: "10px" }}
				bg={
					index === rows.length - 1
						? isAsk
							? "#FFF2EF"
							: "#EEF3FF"
						: isAsk
							? "#FFF8F6"
							: "#F7F9FF"
				}
				borderBottomWidth={index === rows.length - 1 ? "0" : "1px"}
				borderColor={isAsk ? "#F8DFD8" : "#DFE7FA"}
			>
				<Text fontSize="10px" color="app.subtleText">
					{formatNumber.format(row.cumulative)}
				</Text>
				<Text textAlign="center" fontSize="10px" color="app.subtleText">
					{formatNumber.format(row.volume)}
				</Text>
				<Text
					textAlign="right"
					fontSize="11px"
					fontWeight="900"
					color={isAsk ? "#F05B45" : "#2F67D8"}
				>
					{formatNumber.format(row.price)}
				</Text>
			</Grid>
		));
	};

	return (
		<Grid
			templateColumns={{
				base: "1fr",
				xl: "minmax(0, 2.1fr) minmax(300px, 0.95fr)",
			}}
			borderWidth="1px"
			borderColor="app.borderSoft"
			borderRadius="12px"
			overflow="hidden"
			bg="white"
		>
			<GridItem
				p={{ base: "12px", md: "16px" }}
				borderRightWidth={{ base: "0", xl: "1px" }}
				borderBottomWidth={{ base: "1px", xl: "0" }}
				borderColor="app.borderSoft"
			>
				<Grid
					templateColumns={{
						base: "1fr",
						lg: "minmax(0, 1fr) 146px minmax(0, 1fr)",
					}}
					gap={{ base: "14px", lg: "16px" }}
					alignItems="stretch"
				>
					<Box>
						<Text
							mb="8px"
							textAlign="center"
							fontSize="12px"
							fontWeight="900"
							color="#D74633"
						>
							매도 호가
						</Text>
						<Grid
							templateColumns="1fr 1fr 1fr"
							px={{ base: "7px", md: "10px" }}
							pb="6px"
							fontSize="9px"
							color="app.subtleText"
						>
							<Text>누적(주)</Text>
							<Text textAlign="center">수량(주)</Text>
							<Text textAlign="right">가격(원)</Text>
						</Grid>
						<Box
							borderWidth="1px"
							borderColor="#F4D6CE"
							borderRadius="8px"
							overflow="hidden"
						>
							{renderOrderRows(askRows, "ask")}
						</Box>

						<Flex
							mt="16px"
							minH="48px"
							align="center"
							px="14px"
							borderWidth="1px"
							borderColor="#F1D4CA"
							borderRadius="8px"
							bg="#FFFCFA"
						>
							<Text fontSize="12px" fontWeight="900" color="#E34834">
								총 매도잔량
							</Text>
							<Spacer />
							<Text fontSize="14px" fontWeight="900">
								{formatNumber.format(orderBook.totalAskVolume)}주
							</Text>
						</Flex>
					</Box>

					<Flex
						direction="column"
						align="center"
						justify="center"
						py={{ base: "8px", lg: "0" }}
					>
						<Text fontSize="11px" fontWeight="900">현재가</Text>
						<Text mt="2px" fontSize="9px" color="app.subtleText">
							{new Date(orderBook.fetchedAt).toLocaleTimeString("ko-KR", {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})}
						</Text>
						<Text mt="17px" fontSize="26px" fontWeight="900" letterSpacing="-0.04em">
							{formatNumber.format(stock.price)}
						</Text>
						<Text
							mt="5px"
							fontSize="11px"
							fontWeight="900"
							textAlign="center"
							color={stock.changeRate >= 0 ? "#F05B45" : "#2F67D8"}
						>
							{stock.changeRate >= 0 ? "▲" : "▼"}{" "}
							{formatNumber.format(Math.abs(stock.changePrice))}
							<br />
							({stock.changeRate.toFixed(2)}%)
						</Text>

						<Stack mt="18px" spacing="7px" w="100%">
							{[
								["전일 종가", previousClose],
								["시가", stock.open],
								["고가", stock.high],
								["저가", stock.low],
								["거래량", stock.volume],
							].map(([label, value]) => (
								<Flex key={String(label)} justify="space-between" gap="8px">
									<Text fontSize="9px" color="app.subtleText">
										{label}
									</Text>
									<Text
										fontSize="9px"
										fontWeight="800"
										color={
											label === "고가"
												? "#F05B45"
												: label === "저가"
													? "#2F67D8"
													: "app.text"
										}
									>
										{formatNumber.format(Number(value))}
									</Text>
								</Flex>
							))}
							<Flex justify="space-between" gap="8px">
								<Text fontSize="9px" color="app.subtleText">
									거래대금(추정)
								</Text>
								<Text fontSize="9px" fontWeight="800">
									{won.format(estimatedTradingValue)}
								</Text>
							</Flex>
						</Stack>
					</Flex>

					<Box>
						<Text
							mb="8px"
							textAlign="center"
							fontSize="12px"
							fontWeight="900"
							color="#2F67D8"
						>
							매수 호가
						</Text>
						<Grid
							templateColumns="1fr 1fr 1fr"
							px={{ base: "7px", md: "10px" }}
							pb="6px"
							fontSize="9px"
							color="app.subtleText"
						>
							<Text>누적(주)</Text>
							<Text textAlign="center">수량(주)</Text>
							<Text textAlign="right">가격(원)</Text>
						</Grid>
						<Box
							borderWidth="1px"
							borderColor="#CFDBFA"
							borderRadius="8px"
							overflow="hidden"
						>
							{renderOrderRows(bidRows, "bid")}
						</Box>

						<Flex
							mt="16px"
							minH="48px"
							align="center"
							px="14px"
							borderWidth="1px"
							borderColor="#CDD8F7"
							borderRadius="8px"
							bg="#FBFCFF"
						>
							<Text fontSize="12px" fontWeight="900" color="#2F67D8">
								총 매수잔량
							</Text>
							<Spacer />
							<Text fontSize="14px" fontWeight="900">
								{formatNumber.format(orderBook.totalBidVolume)}주
							</Text>
						</Flex>
					</Box>
				</Grid>
			</GridItem>

			<GridItem>
				<Box
					p={{ base: "14px", md: "16px" }}
					minH="204px"
					borderBottomWidth="1px"
					borderColor="app.borderSoft"
				>
					<Text fontSize="12px" fontWeight="900">호가 잔량 그래프</Text>
					<Stack mt="12px" spacing="8px">
						{levels.map((level) => {
							const askWidth = Math.max(
								(level.askVolume / maxDepthVolume) * 100,
								5,
							);
							const bidWidth = Math.max(
								(level.bidVolume / maxDepthVolume) * 100,
								5,
							);
							const referencePrice =
								level.askPrice || level.bidPrice || stock.price;

							return (
								<Grid
									key={`depth-${level.level}`}
									templateColumns="1fr 58px 1fr"
									gap="7px"
									alignItems="center"
								>
									<Flex justify="flex-end">
										<Box
											h="12px"
											w={`${askWidth}%`}
											minW="7px"
											borderRadius="2px 0 0 2px"
											bg="#FAD3D3"
										/>
									</Flex>
									<Text
										textAlign="center"
										fontSize="9px"
										fontWeight={
											Math.abs(referencePrice - stock.price) < 1
												? "900"
												: "600"
										}
										color={
											Math.abs(referencePrice - stock.price) < 1
												? "app.text"
												: "app.subtleText"
										}
									>
										{formatNumber.format(referencePrice)}
									</Text>
									<Box
										h="12px"
										w={`${bidWidth}%`}
										minW="7px"
										borderRadius="0 2px 2px 0"
										bg="#78A4EF"
									/>
								</Grid>
							);
						})}
					</Stack>
				</Box>

				<Box p={{ base: "14px", md: "16px" }} minH="204px">
					<Flex align="center">
						<Text fontSize="12px" fontWeight="900">투자자별 매매동향</Text>
						<Spacer />
						<Text fontSize="9px" color="app.subtleText">단위: 주</Text>
					</Flex>

					<HStack mt="10px" spacing="0">
						{([
							["당일", "1d"],
							["5일", "5d"],
							["30일", "30d"],
							["60일", "60d"],
						] as const).map(([label, period], index) => {
							const active = investorPeriod === period;
							return (
								<Button
									key={period}
									size="xs"
									h="28px"
									px="11px"
									borderRadius={index === 0 ? "7px 0 0 7px" : index === 3 ? "0 7px 7px 0" : "0"}
									borderWidth="1px"
									borderLeftWidth={index === 0 ? "1px" : "0"}
									borderColor={active ? "brand.500" : "app.borderSoft"}
									bg={active ? "orange.50" : "white"}
									color={active ? "brand.600" : "app.subtleText"}
									fontSize="9px"
									onClick={() => onInvestorPeriodChange(period)}
								>
									{label}
								</Button>
							);
						})}
					</HStack>

					{isLoadingInvestorTrend ? (
						<Flex h="125px" align="center" justify="center"><Spinner size="sm" color="brand.500" /></Flex>
					) : investorTrend ? (
						<Grid mt="14px" templateColumns="minmax(0, 1fr) 104px" gap="12px" alignItems="center">
							<Stack spacing="8px">
								{([
									["개인", investorTrend.individual, "#2F67D8"],
									["외국인", investorTrend.foreign, "#F05B45"],
									["기관", investorTrend.institution, "#36A269"],
									["기타법인", investorTrend.corporation, "#E49B28"],
								] as const).map(([label, value, color]) => (
									<Flex key={label} align="center">
										<Text fontSize="10px" color="app.subtleText">{label}</Text>
										<Spacer />
										<Text fontSize="10px" fontWeight="900" color={Number(value) >= 0 ? color : "#2F67D8"}>
											{Number(value) > 0 ? "+" : ""}{formatNumber.format(Number(value))}
										</Text>
									</Flex>
								))}
								<Text fontSize="9px" color="app.subtleText">
									최근 {investorTrend.availableDays}거래일 집계
									{investorTrend.availableDays < investorTrend.requestedDays ? ` / 요청 ${investorTrend.requestedDays}일` : ""}
								</Text>
							</Stack>

							<Flex
								w="96px"
								h="96px"
								borderRadius="full"
								borderWidth="14px"
								borderColor="#F4DDD2"
								align="center"
								justify="center"
								textAlign="center"
							>
								<Text fontSize="9px" fontWeight="800" color="app.subtleText">순매수<br />집계</Text>
							</Flex>
						</Grid>
					) : (
						<Flex h="125px" align="center" justify="center" textAlign="center">
							<Text fontSize="11px" color="app.subtleText">투자자 동향 데이터가 없습니다.<br />장 종료 후 당일 데이터가 반영될 수 있습니다.</Text>
						</Flex>
					)}
				</Box>
			</GridItem>
		</Grid>
	);
}

function CompactTradePanel({
	orders,
}: {
	orders: TradeOrderData[];
}) {
	const rows = orders.slice(0, 8);

	return (
		<Box overflowX="auto">
			<Table size="sm" minW="440px">
				<Thead>
					<Tr>
						<Th px="2">시간</Th>
						<Th px="2">체결가(원)</Th>
						<Th px="2" isNumeric>수량</Th>
						<Th px="2">구분</Th>
					</Tr>
				</Thead>
				<Tbody>
					{rows.map((order) => (
						<Tr key={order._id}>
							<Td px="2" fontSize="11px">
								{new Date(order.createdAt).toLocaleTimeString("ko-KR", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								})}
							</Td>
							<Td
								px="2"
								fontSize="11px"
								fontWeight="800"
								color={order.side === "BUY" ? "#F05B45" : "#2F67D8"}
							>
								{formatNumber.format(
									order.executedPrice ??
									order.limitPrice ??
									order.orderPrice ??
									0,
								)}
							</Td>
							<Td px="2" isNumeric fontSize="11px">
								{formatNumber.format(order.filledQuantity || order.quantity)}
							</Td>
							<Td px="2" fontSize="11px">
								<Text
									color={order.side === "BUY" ? "#F05B45" : "#2F67D8"}
									fontWeight="800"
								>
									{order.side === "BUY" ? "매수" : "매도"}
								</Text>
							</Td>
						</Tr>
					))}
					{rows.length === 0 && (
						<Tr>
							<Td colSpan={4} textAlign="center" py="12" color="app.subtleText">
								체결 내역이 없습니다.
							</Td>
						</Tr>
					)}
				</Tbody>
			</Table>
		</Box>
	);
}

function CompactStockInfo({
	detail,
	isLoading,
}: {
	detail: StockDetail | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<Flex h="250px" align="center" justify="center">
				<Spinner color="brand.500" />
			</Flex>
		);
	}

	const rows = [
		["종목명", detail?.name ?? "-"],
		["종목코드", detail?.symbol ?? "-"],
		["시장", detail?.market ?? "-"],
		["업종", detail?.assetType ?? "-"],
		["시가총액", formatOptionalNumber(detail?.marketCap)],
		["PER", formatOptionalNumber(detail?.per)],
		["PBR", formatOptionalNumber(detail?.pbr)],
		["ROE", formatOptionalNumber(detail?.roe, "%")],
	];

	return (
		<Stack spacing="0">
			{rows.map(([label, value], index) => (
				<Flex
					key={label}
					py="7px"
					borderBottomWidth={index === rows.length - 1 ? "0" : "1px"}
					borderColor="#F1E8DE"
					align="center"
				>
					<Text fontSize="11px" color="app.subtleText">{label}</Text>
					<Spacer />
					<Text fontSize="11px" fontWeight="800" textAlign="right">{value}</Text>
				</Flex>
			))}
		</Stack>
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
function buildPriceSparkline(
	points: ChartPoint[],
	width = 320,
	height = 126,
): {
	path: string;
	minPoint: { x: number; y: number } | null;
	maxPoint: { x: number; y: number } | null;
} {
	const values = points
		.filter((point) => Number.isFinite(point.close) && point.close > 0)
		.slice(-120);

	if (values.length < 2) {
		return { path: "", minPoint: null, maxPoint: null };
	}

	const prices = values.map((point) => point.close);
	const minPrice = Math.min(...prices);
	const maxPrice = Math.max(...prices);
	const range = Math.max(maxPrice - minPrice, 1);

	const coordinates = values.map((point, index) => ({
		x: (index / Math.max(values.length - 1, 1)) * width,
		y: height - ((point.close - minPrice) / range) * (height - 24) - 12,
		price: point.close,
	}));

	const path = coordinates
		.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
		.join(" ");

	const minIndex = prices.indexOf(minPrice);
	const maxIndex = prices.indexOf(maxPrice);
	const minCoordinate = coordinates[minIndex];
	const maxCoordinate = coordinates[maxIndex];

	return {
		path,
		minPoint: minCoordinate ? { x: minCoordinate.x, y: minCoordinate.y } : null,
		maxPoint: maxCoordinate ? { x: maxCoordinate.x, y: maxCoordinate.y } : null,
	};
}

function formatCompactKrw(value?: number | null): string {
	const number = Number(value ?? 0);

	if (!Number.isFinite(number) || number <= 0) {
		return "-";
	}

	if (number >= 1_000_000_000_000) {
		return `${(number / 1_000_000_000_000).toFixed(2)}조원`;
	}

	if (number >= 100_000_000) {
		return `${(number / 100_000_000).toFixed(0)}억원`;
	}

	return won.format(number);
}

function CompanyMetric({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<Box
			px="10px"
			py="12px"
			borderRightWidth="1px"
			borderBottomWidth="1px"
			borderColor="#EADCCD"
			textAlign="center"
			minH="60px"
		>
			<Text fontSize="9px" color="app.subtleText">{label}</Text>
			<Text mt="5px" fontSize="11px" fontWeight="800" lineHeight="1.3">{value}</Text>
		</Box>
	);
}

function FinanceSummaryRow({
	label,
	current,
}: {
	label: string;
	current: React.ReactNode;
}) {
	return (
		<Grid templateColumns="1.15fr repeat(3, 1fr)" alignItems="center" minH="44px">
			<Text px="12px" fontSize="10px" color="#5D554D">{label}</Text>
			<Text px="8px" textAlign="center" fontSize="10px" fontWeight="800">{current}</Text>
			<Text px="8px" textAlign="center" fontSize="10px" color="app.subtleText">-</Text>
			<Text px="8px" textAlign="center" fontSize="10px" color="app.subtleText">-</Text>
		</Grid>
	);
}

function StockDetailPanel({
	detail,
	isLoading,
	historyPoints,
}: {
	detail: StockDetail | null;
	isLoading: boolean;
	historyPoints: ChartPoint[];
}) {
	if (isLoading) {
		return (
			<Flex h="420px" align="center" justify="center">
				<Spinner color="brand.500" />
			</Flex>
		);
	}

	if (!detail) {
		return (
			<Flex h="360px" align="center" justify="center">
				<Text color="app.subtleText">종목 상세정보를 불러오지 못했습니다.</Text>
			</Flex>
		);
	}

	const validHistory = historyPoints
		.filter((point) => Number.isFinite(point.close) && point.close > 0)
		.sort((a, b) => a.time - b.time);
	const high52 = validHistory.length > 0
		? Math.max(...validHistory.map((point) => point.high || point.close))
		: detail.high;
	const low52 = validHistory.length > 0
		? Math.min(...validHistory.map((point) => point.low || point.close))
		: detail.low;
	const recentMonth = validHistory.slice(-21);
	const monthTradingValue = recentMonth.reduce(
		(sum, point) => sum + point.close * Number(point.volume ?? 0),
		0,
	);
	const operatingMargin = Number(detail.revenue ?? 0) > 0
		? (Number(detail.operatingProfit ?? 0) / Number(detail.revenue)) * 100
		: null;
	const sparkline = buildPriceSparkline(validHistory);

	return (
		<Grid
			templateColumns={{ base: "1fr", xl: "0.92fr 1.16fr 1.12fr" }}
			gap="14px"
			alignItems="stretch"
		>
			<Box
				p="16px"
				borderWidth="1px"
				borderColor="app.borderSoft"
				borderRadius="10px"
				bg="white"
				minH="430px"
			>
				<Heading size="sm">기업 개요</Heading>
				<Flex mt="22px" align="center" gap="14px">
					<Flex
						w="58px"
						h="58px"
						borderRadius="full"
						bg="#E4E4E4"
						align="center"
						justify="center"
						fontSize="18px"
						fontWeight="900"
						color="#A3A3A3"
					>
						{detail.name.slice(0, 1)}
					</Flex>
					<Box minW="0">
						<Text fontSize="18px" fontWeight="900" noOfLines={1}>{detail.name}</Text>
						<Text mt="3px" fontSize="10px" color="app.subtleText">{detail.symbol}</Text>
						<Badge mt="7px" px="8px" py="2px" borderRadius="full" variant="outline" borderColor="#E4CDB8" color="#695B4F">
							{detail.market}
						</Badge>
					</Box>
				</Flex>

				<Text mt="20px" minH="72px" fontSize="11px" lineHeight="1.8" color="#554C44">
					{detail.summary || `${detail.name}은(는) ${detail.market} 시장에 상장된 ${detail.assetType} 종목입니다.`}
				</Text>

				<Grid mt="18px" templateColumns="repeat(3, minmax(0, 1fr))" borderTopWidth="1px" borderLeftWidth="1px" borderColor="#EADCCD">
					<CompanyMetric label="시가총액" value={formatCompactKrw(detail.marketCap)} />
					<CompanyMetric label="상장주식수" value="-" />
					<CompanyMetric label="외국인 보유율" value="-" />
					<CompanyMetric label="액면가" value="-" />
					<CompanyMetric label="EPS" value={formatOptionalNumber(detail.eps, "원")} />
					<CompanyMetric label="BPS" value={formatOptionalNumber(detail.bps, "원")} />
					<CompanyMetric label="PER" value={formatOptionalNumber(detail.per, "배")} />
					<CompanyMetric label="PBR" value={formatOptionalNumber(detail.pbr, "배")} />
					<CompanyMetric label="ROE" value={formatOptionalNumber(detail.roe, "%")} />
				</Grid>

				<Button mt="18px" w="100%" size="sm" variant="outline" borderColor="#E4CDB8" isDisabled>
					기업 공식 홈페이지 바로가기
				</Button>
			</Box>

			<Box
				p="16px"
				borderWidth="1px"
				borderColor="app.borderSoft"
				borderRadius="10px"
				bg="white"
				minH="430px"
			>
				<Heading size="sm">재무 요약</Heading>
				<HStack mt="18px" spacing="0">
					<Button size="xs" px="22px" borderRadius="7px 0 0 7px" bg="white" color="brand.600" borderWidth="1px" borderColor="#E8CDB7">연간</Button>
					<Button size="xs" px="22px" borderRadius="0 7px 7px 0" variant="outline" borderColor="#E8CDB7" color="app.subtleText">분기</Button>
				</HStack>

				<Box mt="10px" borderWidth="1px" borderColor="#E8D8C8" borderRadius="8px" overflow="hidden">
					<Grid templateColumns="1.15fr repeat(3, 1fr)" minH="46px" alignItems="center" bg="#FFFCF8" borderBottomWidth="1px" borderColor="#E8D8C8">
						<Text px="12px" fontSize="9px" color="app.subtleText">구분</Text>
						<Text textAlign="center" fontSize="9px" color="app.subtleText">최근</Text>
						<Text textAlign="center" fontSize="9px" color="app.subtleText">전기</Text>
						<Text textAlign="center" fontSize="9px" color="app.subtleText">전년</Text>
					</Grid>
					<Stack spacing="0" divider={<Divider borderColor="#EFE4D9" />}>
						<FinanceSummaryRow label="매출액" current={formatOptionalNumber(detail.revenue)} />
						<FinanceSummaryRow label="영업이익" current={formatOptionalNumber(detail.operatingProfit)} />
						<FinanceSummaryRow label="당기순이익" current={formatOptionalNumber(detail.netIncome)} />
						<FinanceSummaryRow label="영업이익률" current={operatingMargin === null ? "-" : `${operatingMargin.toFixed(2)}%`} />
						<FinanceSummaryRow label="ROE" current={formatOptionalNumber(detail.roe, "%")} />
					</Stack>
				</Box>
				<Text mt="14px" fontSize="9px" color="app.subtleText">
					현재 KIS 응답에서 제공되는 최신 재무값만 표시하며, 비교 기간 데이터는 제공되지 않으면 -로 표시됩니다.
				</Text>
			</Box>

			<Box
				p="16px"
				borderWidth="1px"
				borderColor="app.borderSoft"
				borderRadius="10px"
				bg="white"
				minH="430px"
			>
				<Heading size="sm">주가 정보</Heading>
				<Stack mt="20px" spacing="15px">
					<Flex>
						<Text fontSize="11px" color="app.subtleText">52주 최고</Text>
						<Spacer />
						<Text fontSize="11px" fontWeight="900" color="#F05B45">{high52 > 0 ? won.format(high52) : "-"}</Text>
					</Flex>
					<Flex>
						<Text fontSize="11px" color="app.subtleText">52주 최저</Text>
						<Spacer />
						<Text fontSize="11px" fontWeight="900" color="#2F67D8">{low52 > 0 ? won.format(low52) : "-"}</Text>
					</Flex>
					<Flex>
						<Text fontSize="11px" color="app.subtleText">1일 변동폭</Text>
						<Spacer />
						<Text fontSize="11px" fontWeight="800">{detail.low > 0 && detail.high > 0 ? `${formatNumber.format(detail.low)}~${formatNumber.format(detail.high)}원` : "-"}</Text>
					</Flex>
					<Flex>
						<Text fontSize="11px" color="app.subtleText">1개월 거래대금(추정)</Text>
						<Spacer />
						<Text fontSize="11px" fontWeight="800">{formatCompactKrw(monthTradingValue)}</Text>
					</Flex>
				</Stack>

				<Divider my="20px" borderColor="#EADCCD" />
				<Flex align="center">
					<Text fontSize="12px" fontWeight="800">52주 주가 범위</Text>
					<Spacer />
					<Text fontSize="11px" color="#F05B45" fontWeight="900">최고 {high52 > 0 ? formatNumber.format(high52) : "-"}</Text>
				</Flex>
				<Box mt="12px" h="150px" position="relative">
					{sparkline.path ? (
						<svg viewBox="0 0 320 126" width="100%" height="126" preserveAspectRatio="none">
							<path d={sparkline.path} fill="none" stroke="#77736F" strokeWidth="2" vectorEffect="non-scaling-stroke" />
							{sparkline.minPoint && <circle cx={sparkline.minPoint.x} cy={sparkline.minPoint.y} r="4" fill="#2457E6" />}
							{sparkline.maxPoint && <circle cx={sparkline.maxPoint.x} cy={sparkline.maxPoint.y} r="4" fill="#F05B45" />}
						</svg>
					) : (
						<Flex h="126px" align="center" justify="center" color="app.subtleText" fontSize="10px">52주 차트 데이터가 없습니다.</Flex>
					)}
					<Text position="absolute" left="0" bottom="0" fontSize="10px" color="#2457E6" fontWeight="900">최저 {low52 > 0 ? formatNumber.format(low52) : "-"}</Text>
				</Box>
			</Box>
		</Grid>
	);
}


function DetailSelectorCard({
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
			textAlign="left"
			w="100%"
			h="100%"
			minH="300px"
			borderWidth="1px"
			borderColor={selected ? "brand.500" : "app.borderSoft"}
			boxShadow={
				selected
					? "0 10px 28px rgba(242, 100, 56, 0.10)"
					: "0 8px 24px rgba(73, 52, 30, 0.04)"
			}
			bg="white"
			cursor="pointer"
			onClick={onClick}
			transition="border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease"
			_hover={{
				borderColor: "brand.400",
				transform: "translateY(-1px)",
			}}
		>
			<CardHeader pb="2">
				<Flex align="center">
					<Box>
						<Heading size="sm" color={selected ? "brand.600" : "app.text"}>
							{title}
						</Heading>
						<Text mt="1" fontSize="10px" color="app.subtleText">
							{description}
						</Text>
					</Box>
					<Spacer />
					{selected && (
						<Badge bg="orange.50" color="brand.600" borderRadius="full">
							선택됨
						</Badge>
					)}
				</Flex>
			</CardHeader>
			<CardBody pt="2">{children}</CardBody>
		</Card>
	);
}

type ExecutionTrendBucket = {
	label: string;
	volume: number;
	strength: number;
	count: number;
};

function buildExecutionTrendBuckets(
	items: MarketExecutionItem[],
): ExecutionTrendBucket[] {
	const bucketMap = new Map<string, ExecutionTrendBucket>();

	for (const item of [...items].reverse()) {
		const label = item.time.slice(0, 5);
		const current = bucketMap.get(label) ?? {
			label,
			volume: 0,
			strength: 0,
			count: 0,
		};

		current.volume += Number(item.quantity || 0);
		if (Number(item.strength) > 0) {
			current.strength += Number(item.strength);
			current.count += 1;
		}
		bucketMap.set(label, current);
	}

	return Array.from(bucketMap.values())
		.map((bucket) => ({
			...bucket,
			strength:
				bucket.count > 0
					? bucket.strength / bucket.count
					: 0,
		}))
		.slice(-7);
}

function formatCompactWon(value: number): string {
	const absolute = Math.abs(value);
	if (absolute >= 1_000_000_000_000) {
		return `${(value / 1_000_000_000_000).toFixed(1)}조원`;
	}
	if (absolute >= 100_000_000) {
		return `${(value / 100_000_000).toFixed(1)}억원`;
	}
	if (absolute >= 10_000) {
		return `${(value / 10_000).toFixed(1)}만원`;
	}
	return `${formatNumber.format(value)}원`;
}

function ExecutionSummaryMetric({
	label,
	value,
	subValue,
	accent,
}: {
	label: string;
	value: string;
	subValue?: string;
	accent?: string;
}) {
	return (
		<Flex
			direction="column"
			align="center"
			justify="center"
			minH="72px"
			px="12px"
			borderLeftWidth={{ base: "0", md: "1px" }}
			borderTopWidth={{ base: "1px", md: "0" }}
			borderColor="app.borderSoft"
		>
			<Text fontSize="10px" color="app.subtleText">
				{label}
			</Text>
			<Text mt="5px" fontSize="18px" fontWeight="900" color={accent ?? "app.text"}>
				{value}
			</Text>
			{subValue && (
				<Text mt="2px" fontSize="9px" fontWeight="800" color={accent ?? "app.subtleText"}>
					{subValue}
				</Text>
			)}
		</Flex>
	);
}

function ExecutionVolumeTrend({
	buckets,
}: {
	buckets: ExecutionTrendBucket[];
}) {
	const maxVolume = Math.max(
		...buckets.map((bucket) => bucket.volume),
		1,
	);

	return (
		<Box
			p="14px"
			borderWidth="1px"
			borderColor="app.borderSoft"
			borderRadius="10px"
			bg="white"
		>
			<Text fontSize="11px" fontWeight="900">
				시간별 체결량 추이
			</Text>
			<Box mt="12px" h="120px" position="relative">
				<Stack position="absolute" inset="0" justify="space-between" pointerEvents="none">
					{[0, 1, 2, 3].map((line) => (
						<Box key={line} borderTopWidth="1px" borderColor="#EEE3D8" />
					))}
				</Stack>
				<Flex position="relative" zIndex="1" h="100%" align="flex-end" gap="8px" px="8px">
					{buckets.map((bucket) => (
						<Flex
							key={bucket.label}
							flex="1"
							h="100%"
							minW="0"
							direction="column"
							justify="flex-end"
							align="center"
						>
							<Text mb="4px" fontSize="8px" fontWeight="800">
								{formatNumber.format(bucket.volume)}
							</Text>
							<Box
								w="100%"
								maxW="28px"
								h={`${Math.max((bucket.volume / maxVolume) * 78, 5)}px`}
								bg="#FFD7D2"
							/>
							<Text mt="5px" fontSize="8px" color="app.subtleText">
								{bucket.label}
							</Text>
						</Flex>
					))}
				</Flex>
			</Box>
		</Box>
	);
}

function ExecutionStrengthTrend({
	buckets,
}: {
	buckets: ExecutionTrendBucket[];
}) {
	const values = buckets.map((bucket) => bucket.strength);
	const minValue = Math.min(...values, 0);
	const maxValue = Math.max(...values, 150, 1);
	const range = Math.max(maxValue - minValue, 1);
	const coordinates = buckets.map((bucket, index) => ({
		x: buckets.length <= 1 ? 160 : 14 + (index / (buckets.length - 1)) * 292,
		y: 96 - ((bucket.strength - minValue) / range) * 76,
		label: bucket.label,
	}));
	const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

	return (
		<Box
			p="14px"
			borderWidth="1px"
			borderColor="app.borderSoft"
			borderRadius="10px"
			bg="white"
		>
			<Text fontSize="11px" fontWeight="900">
				체결강도 추이
			</Text>
			<Box mt="10px" position="relative" h="118px">
				{[0, 1, 2, 3].map((line) => (
					<Box
						key={line}
						position="absolute"
						left="0"
						right="0"
						top={`${line * 29}px`}
						borderTopWidth="1px"
						borderColor="#EEE3D8"
					/>
				))}
				<svg width="100%" height="104" viewBox="0 0 320 104" preserveAspectRatio="none">
					<polyline
						fill="none"
						stroke="#F26438"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						points={points}
					/>
					{coordinates.map((point, index) => (
						<circle
							key={`${point.label}-${index}`}
							cx={point.x}
							cy={point.y}
							r="3"
							fill="#FFFFFF"
							stroke="#F26438"
							strokeWidth="2"
						/>
					))}
				</svg>
				<Flex mt="-2px" justify="space-between">
					{buckets.map((bucket) => (
						<Text key={bucket.label} fontSize="8px" color="app.subtleText">
							{bucket.label}
						</Text>
					))}
				</Flex>
			</Box>
		</Box>
	);
}

function InvestorTrendCard({
	investorTrend,
	isLoading,
	period,
	onPeriodChange,
}: {
	investorTrend: InvestorTrendData | null;
	isLoading: boolean;
	period: InvestorTrendPeriod;
	onPeriodChange: (period: InvestorTrendPeriod) => void;
}) {
	const entries = investorTrend
		? [
			{ label: "개인", value: investorTrend.individual, color: "#2F67D8" },
			{ label: "외국인", value: investorTrend.foreign, color: "#F05B45" },
			{ label: "기관", value: investorTrend.institution, color: "#36A269" },
			{ label: "기타법인", value: investorTrend.corporation, color: "#E49B28" },
		]
		: [];
	const totalAbsolute = entries.reduce((sum, entry) => sum + Math.abs(entry.value), 0);
	let cursor = 0;
	const gradientStops = entries.map((entry) => {
		const start = cursor;
		const width = totalAbsolute > 0 ? (Math.abs(entry.value) / totalAbsolute) * 100 : 25;
		cursor += width;
		return `${entry.color} ${start}% ${cursor}%`;
	});
	const donutBackground = `conic-gradient(${gradientStops.join(", ") || "#E8E0D8 0 100%"})`;

	return (
		<Box
			p="14px"
			borderWidth="1px"
			borderColor="app.borderSoft"
			borderRadius="10px"
			bg="white"
		>
			<Flex align="center">
				<Text fontSize="11px" fontWeight="900">
					투자자별 매매동향
				</Text>
				<Spacer />
				<HStack spacing="2px">
					{([[
						"당일",
						"1d",
					], ["5일", "5d"], ["30일", "30d"], ["60일", "60d"]] as const).map(([label, value]) => (
						<Button
							key={value}
							size="xs"
							h="23px"
							px="7px"
							fontSize="8px"
							variant="outline"
							borderColor={period === value ? "brand.500" : "app.borderSoft"}
							color={period === value ? "brand.600" : "app.subtleText"}
							bg={period === value ? "orange.50" : "white"}
							onClick={() => onPeriodChange(value)}
						>
							{label}
						</Button>
					))}
				</HStack>
			</Flex>

			{isLoading ? (
				<Flex h="128px" align="center" justify="center">
					<Spinner size="sm" color="brand.500" />
				</Flex>
			) : investorTrend ? (
				<Grid mt="12px" templateColumns="minmax(0, 1fr) 94px" gap="12px" alignItems="center">
					<Stack spacing="8px">
						{entries.map((entry) => (
							<Flex key={entry.label} align="center">
								<Text w="62px" fontSize="9px" color="app.subtleText">
									{entry.label}
								</Text>
								<Text fontSize="10px" fontWeight="900" color={entry.value >= 0 ? "#F05B45" : "#2F67D8"}>
									{entry.value > 0 ? "+" : ""}{formatNumber.format(entry.value)}
								</Text>
							</Flex>
						))}
						<Text fontSize="8px" color="app.subtleText">
							최근 {investorTrend.availableDays}거래일 · 단위 주
						</Text>
					</Stack>
					<Flex
						w="88px"
						h="88px"
						borderRadius="full"
						bg={donutBackground}
						align="center"
						justify="center"
					>
						<Flex w="54px" h="54px" borderRadius="full" bg="white" align="center" justify="center" textAlign="center">
							<Text fontSize="8px" fontWeight="800" color="app.subtleText">
								순매수<br />비중
							</Text>
						</Flex>
					</Flex>
				</Grid>
			) : (
				<Flex h="128px" align="center" justify="center" textAlign="center">
					<Text fontSize="10px" color="app.subtleText">
						투자자 동향 데이터가 없습니다.<br />장 종료 후 반영될 수 있습니다.
					</Text>
				</Flex>
			)}
		</Box>
	);
}

function MarketExecutionPanel({
	data,
	isLoading,
	stock,
	investorTrend,
	isLoadingInvestorTrend,
	investorPeriod,
	onInvestorPeriodChange,
}: {
	data: MarketExecutionData | null;
	isLoading: boolean;
	stock: StockSummary | null;
	investorTrend: InvestorTrendData | null;
	isLoadingInvestorTrend: boolean;
	investorPeriod: InvestorTrendPeriod;
	onInvestorPeriodChange: (period: InvestorTrendPeriod) => void;
}) {
	if (isLoading) {
		return (
			<Flex minH="520px" align="center" justify="center">
				<Spinner color="brand.500" />
			</Flex>
		);
	}

	const rows = data?.items ?? [];
	if (rows.length === 0) {
		return (
			<Flex minH="420px" align="center" justify="center" textAlign="center">
				<Box>
					<Text fontSize="13px" fontWeight="900">
						체결 데이터가 없습니다.
					</Text>
					<Text mt="2" fontSize="11px" color="app.subtleText">
						장 운영시간 또는 KIS 조회 환경을 확인하세요.
					</Text>
				</Box>
			</Flex>
		);
	}

	const latest = rows[0];
	const latestPrice = latest?.price ?? stock?.price ?? 0;
	const changePrice = latest?.changePrice || stock?.changePrice || 0;
	const changeRate = latest?.changeRate || stock?.changeRate || 0;
	const latestStrength = latest?.strength ?? 0;
	const cumulativeVolume = latest?.cumulativeVolume || stock?.volume || 0;
	const estimatedTradingValue = latestPrice * cumulativeVolume;
	const directionColor = changeRate >= 0 ? "#F05B45" : "#2F67D8";
	const trendBuckets = buildExecutionTrendBuckets(rows);

	return (
		<Stack spacing="12px">
			<Box p="14px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px" bg="white">
				<Flex align="center" mb="9px">
					<Text fontSize="11px" fontWeight="900">실시간 체결 요약</Text>
					<Text ml="10px" fontSize="8px" color="app.subtleText">
						{data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString("ko-KR") : "-"} 기준
					</Text>
				</Flex>
				<Divider />
				<SimpleGrid mt="5px" columns={{ base: 2, md: 5 }}>
					<ExecutionSummaryMetric
						label="체결강도"
						value={latestStrength > 0 ? `${latestStrength.toFixed(1)}%` : "-"}
						subValue={latestStrength > 100 ? "매수우위" : latestStrength > 0 ? "매도우위" : undefined}
						accent={latestStrength >= 100 ? "#F05B45" : "#2F67D8"}
					/>
					<ExecutionSummaryMetric label="최근 체결가" value={won.format(latestPrice)} />
					<ExecutionSummaryMetric
						label="전일 대비"
						value={`${changePrice >= 0 ? "▲" : "▼"} ${formatNumber.format(Math.abs(changePrice))}원`}
						subValue={`(${changeRate >= 0 ? "+" : ""}${changeRate.toFixed(2)}%)`}
						accent={directionColor}
					/>
					<ExecutionSummaryMetric label="거래량" value={`${formatNumber.format(cumulativeVolume)}주`} />
					<ExecutionSummaryMetric label="거래대금(추정)" value={formatCompactWon(estimatedTradingValue)} />
				</SimpleGrid>
			</Box>

			<Grid
				templateColumns={{ base: "1fr", xl: "minmax(0, 1.75fr) minmax(310px, 0.85fr)" }}
				gap="12px"
			>
				<Box borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px" overflow="hidden" bg="white">
					<Flex px="14px" py="10px" align="center" borderBottomWidth="1px" borderColor="app.borderSoft">
						<Text fontSize="11px" fontWeight="900">실시간 체결 내역</Text>
						<Spacer />
						<Text fontSize="8px" color="app.subtleText">최근 {rows.length}건</Text>
					</Flex>
					<TableContainer maxH="500px" overflowY="auto">
						<Table size="sm">
							<Thead bg="#FFFCF8" position="sticky" top="0" zIndex="1">
								<Tr>
									<Th fontSize="8px">시간</Th>
									<Th isNumeric fontSize="8px">체결가(원)</Th>
									<Th isNumeric fontSize="8px">전일대비</Th>
									<Th isNumeric fontSize="8px">체결량(주)</Th>
									<Th isNumeric fontSize="8px">누적거래량(주)</Th>
									<Th isNumeric fontSize="8px">체결강도</Th>
									<Th textAlign="center" fontSize="8px">체결 방향</Th>
								</Tr>
							</Thead>
							<Tbody>
								{rows.map((item, index) => {
									const olderItem = rows[index + 1];
									const referencePrice = olderItem?.price ?? item.price - item.changePrice;
									const tickDirection = item.price > referencePrice ? "UP" : item.price < referencePrice ? "DOWN" : "FLAT";
									const tickColor = tickDirection === "UP" ? "#F05B45" : tickDirection === "DOWN" ? "#2F67D8" : "app.text";
									const rowChangeColor = item.changePrice >= 0 ? "#F05B45" : "#2F67D8";

									return (
										<Tr key={`${item.time}-${index}`} _hover={{ bg: "#FFFAF5" }}>
											<Td fontSize="9px">{item.time}</Td>
											<Td isNumeric fontSize="10px" fontWeight="900" color={tickColor}>{formatNumber.format(item.price)}</Td>
											<Td isNumeric fontSize="9px" color={rowChangeColor}>
												{item.changePrice >= 0 ? "▲" : "▼"} {formatNumber.format(Math.abs(item.changePrice))} ({item.changeRate >= 0 ? "+" : ""}{item.changeRate.toFixed(2)}%)
											</Td>
											<Td isNumeric fontSize="9px">{formatNumber.format(item.quantity)}</Td>
											<Td isNumeric fontSize="9px">{formatNumber.format(item.cumulativeVolume)}</Td>
											<Td isNumeric fontSize="9px">{item.strength > 0 ? `${item.strength.toFixed(1)}%` : "-"}</Td>
											<Td textAlign="center" fontSize="9px" fontWeight="900" color={tickColor}>
												{tickDirection === "UP" ? "상승" : tickDirection === "DOWN" ? "하락" : "보합"}
											</Td>
										</Tr>
									);
								})}
							</Tbody>
						</Table>
					</TableContainer>
				</Box>

				<Stack spacing="12px">
					<ExecutionVolumeTrend buckets={trendBuckets} />
					<ExecutionStrengthTrend buckets={trendBuckets} />
					<InvestorTrendCard
						investorTrend={investorTrend}
						isLoading={isLoadingInvestorTrend}
						period={investorPeriod}
						onPeriodChange={onInvestorPeriodChange}
					/>
				</Stack>
			</Grid>
		</Stack>
	);
}


interface DomesticExchangeProps {
	onStockChange?: (
		stock: {
			symbol: string;
			name: string;
			market: string;
		},
	) => void;
}

export default function DomesticExchange({
	onStockChange,
}: DomesticExchangeProps) {
	const toast = useToast();

	const initialSymbol =
		new URLSearchParams(
			window.location.search,
		)
			.get("symbol")
			?.trim()
			.toUpperCase() ||
		"005930";

	const [selectedSymbol, setSelectedSymbol] =
		useState(initialSymbol);
	const [searchKeyword, setSearchKeyword] = useState("삼성전자");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [stock, setStock] = useState<StockSummary | null>(null);

	useEffect(() => {
		const symbol =
			stock?.symbol ??
			selectedSymbol;

		if (!symbol) {
			return;
		}

		onStockChange?.({
			symbol,
			name:
				stock?.name ??
				symbol,
			market:
				stock?.market ??
				"KRX",
		});
	}, [
		onStockChange,
		selectedSymbol,
		stock?.symbol,
		stock?.name,
		stock?.market,
	]);

	const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
	const [detailHistory, setDetailHistory] = useState<ChartPoint[]>([]);
	const [isLoadingStock, setIsLoadingStock] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
	const [isLoadingDetail, setIsLoadingDetail] = useState(false);

	const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
	const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);

	const [marketExecutions, setMarketExecutions] = useState<MarketExecutionData | null>(null);
	const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
	const [investorTrend, setInvestorTrend] = useState<InvestorTrendData | null>(null);
	const [isLoadingInvestorTrend, setIsLoadingInvestorTrend] = useState(false);
	const [investorPeriod, setInvestorPeriod] = useState<InvestorTrendPeriod>("1d");

	const [searchPrices, setSearchPrices] = useState<Record<string, SearchResultPrice>>({});

	const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1d");
	const [chartInterval, setChartInterval] = useState<ChartInterval>("1m");
	const [rightPanelMode, setRightPanelMode] =
		useState<RightPanelMode>("ORDER");
	const [isMarketSimulatorOpen, setIsMarketSimulatorOpen] =
		useState(false);
	const isAiRamenOpen = rightPanelMode === "AI";

	useEffect(() => {
		const handleStockSelected = (
			event: Event,
		) => {
			const selected = (
				event as CustomEvent<{
					symbol?: string;
					marketType?: string;
				}>
			).detail;

			if (
				selected?.marketType !== "KR" ||
				!selected.symbol
			) {
				return;
			}

			const nextSymbol =
				selected.symbol
					.trim()
					.toUpperCase();

			setSelectedSymbol(nextSymbol);

			void fetchStockWithChartOption(
				nextSymbol,
				chartPeriod,
				chartInterval,
			);
		};

		window.addEventListener(
			"antitude:stock-selected",
			handleStockSelected,
		);

		return () => {
			window.removeEventListener(
				"antitude:stock-selected",
				handleStockSelected,
			);
		};
	}, [
		chartPeriod,
		chartInterval,
	]);


	const [quantity, setQuantity] = useState(1);
	const [orderPanelMode, setOrderPanelMode] =
		useState<OrderPanelMode>("BUY");
	const [detailSection, setDetailSection] =
		useState<DetailSection>("orderbook");
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

	const [isToppingUp, setIsToppingUp] =
		useState(false);

	const [marketStatus, setMarketStatus] =
		useState<MarketStatus | null>(null);

	const [isLoadingMarketStatus, setIsLoadingMarketStatus] =
		useState(false);

	const loadMarketStatus = async () => {
		try {
			setIsLoadingMarketStatus(true);

			const response =
				await api.get(
					"/markets/KRX/status",
				);

			setMarketStatus(
				unwrapApiData(
					response.data,
				),
			);
		} catch (error) {
			console.error(
				"국내시장 상태 조회 실패:",
				error,
			);

			setMarketStatus(null);
		} finally {
			setIsLoadingMarketStatus(false);
		}
	};

	const isMarketClosed =
		!marketStatus?.isOpen &&
		!marketStatus?.orderAllowedByOverride;

	const isCurrentOrderBlocked =
		orderType === "MARKET" &&
		isMarketClosed;

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
			const nextStock = normalizeStockInfo(symbol, infoRes.data);
			setStock(nextStock);

			if (stock?.symbol !== nextStock.symbol || limitPrice <= 0) {
				setLimitPrice(nextStock.price);
			}

			void fetchStockDetail(symbol);
			void fetchOrderBook(symbol);
			void fetchMarketExecutions(symbol);
			void fetchInvestorTrend(symbol, investorPeriod);

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

	const fetchMarketExecutions = async (symbol: string) => {
		try {
			setIsLoadingExecutions(true);
			const response = await api.get(`/stocks/${symbol}/executions?limit=100`);
			setMarketExecutions(unwrapApiData(response.data));
		} catch (error) {
			console.error("국내 체결 조회 실패:", error);
			setMarketExecutions(null);
		} finally {
			setIsLoadingExecutions(false);
		}
	};

	const fetchInvestorTrend = async (
		symbol: string,
		period: InvestorTrendPeriod,
	) => {
		try {
			setIsLoadingInvestorTrend(true);
			const response = await api.get(`/stocks/${symbol}/investors?period=${period}`);
			setInvestorTrend(unwrapApiData(response.data));
		} catch (error) {
			console.error("국내 투자자 동향 조회 실패:", error);
			setInvestorTrend(null);
		} finally {
			setIsLoadingInvestorTrend(false);
		}
	};

	const changeInvestorPeriod = (period: InvestorTrendPeriod) => {
		setInvestorPeriod(period);
		if (stock?.symbol) void fetchInvestorTrend(stock.symbol, period);
	};

	const fetchStockDetail = async (symbol: string) => {
		try {
			setIsLoadingDetail(true);

			const [detailResult, historyResult] = await Promise.allSettled([
				api.get(`/stocks/${symbol}/detail`),
				api.get(`/stocks/${symbol}/historical?period=1y&interval=1d`),
			]);

			if (detailResult.status !== "fulfilled") {
				throw detailResult.reason;
			}

			setStockDetail(normalizeStockDetail(detailResult.value.data));
			setDetailHistory(
				historyResult.status === "fulfilled"
					? normalizeHistorical(historyResult.value.data)
					: [],
			);
		} catch (error) {
			console.error(error);
			setStockDetail(null);
			setDetailHistory([]);

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
		if (
			orderType === "MARKET" &&
			isMarketClosed
		) {
			toast({
				title:
					"현재 시장가 주문을 할 수 없습니다.",
				description:
					"시장가 주문은 정규장 중에만 가능하며, 현재는 지정가 예약 주문을 등록할 수 있습니다.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

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
				market: "KRX",
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
						: order.status === "PENDING"
							? "지정가 예약 주문이 등록되었습니다. 다음 정규장 중 지정 가격 조건을 충족하면 자동 체결됩니다."
							: "지정가 주문이 체결되었습니다.",
				status: "success",
				isClosable: true,
			});

			await loadTradingData();
		} catch (error: any) {
			console.error(error);

			if (
				error?.response?.data?.code ===
				"MARKET_CLOSED"
			) {
				const closedStatus =
					error?.response?.data
						?.data as
					| MarketStatus
					| undefined;

				if (closedStatus) {
					setMarketStatus(
						closedStatus,
					);
				}
			}

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
				description: `체결 ${result.filledCount ?? 0}건 / 확인 ${result.checkedCount ?? 0
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

	const topUpTradingAccount = async () => {
		try {
			setIsToppingUp(true);

			const response = await api.post(
				"/trading/top-up",
			);
			const result = unwrapApiData(
				response.data,
			) as {
				amount: number;
			};

			toast({
				title: "모의투자 현금이 충전되었습니다.",
				description: `${won.format(
					result.amount,
				)}이 계좌에 추가되었습니다.`,
				status: "success",
				isClosable: true,
			});

			await loadTradingData();
		} catch (error: any) {
			console.error(error);
			toast({
				title: "계좌 충전 실패",
				description:
					error?.response?.data?.message ??
					"잠시 후 다시 시도하세요.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsToppingUp(false);
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

	const priceStep = useMemo(() => {
		const prices: number[] = orderBook?.levels
			.flatMap((level) => [level.askPrice, level.bidPrice])
			.filter((price) => Number.isFinite(price) && price > 0) ?? [];

		const sorted: number[] = Array.from(new Set<number>(prices)).sort(
			(a, b) => a - b,
		);
		const differences = sorted
			.slice(1)
			.map((price, index) => {
				const previousPrice = sorted[index];

				return previousPrice === undefined
					? 0
					: price - previousPrice;
			})
			.filter((difference) => difference > 0);

		return differences.length > 0 ? Math.min(...differences) : 100;
	}, [orderBook]);

	const pendingOrders = useMemo(
		() =>
			tradeOrders.filter(
				(order) =>
					order.status === "PENDING" &&
					(!stock || order.symbol === stock.symbol),
			),
		[tradeOrders, stock],
	);

	const maximumQuantity = useMemo(() => {
		if (orderPanelMode === "SELL") {
			return Math.max(1, selectedHolding?.availableQuantity ?? selectedHolding?.quantity ?? 1);
		}

		const unitPrice = orderType === "LIMIT"
			? limitPrice
			: stock?.price ?? 0;
		const availableCash = portfolio?.account?.availableCash ?? 0;

		return unitPrice > 0
			? Math.max(1, Math.floor(availableCash / unitPrice))
			: 1;
	}, [
		limitPrice,
		orderPanelMode,
		orderType,
		portfolio?.account?.availableCash,
		selectedHolding?.availableQuantity,
		selectedHolding?.quantity,
		stock?.price,
	]);

	const prepareOrderCorrection = (order: TradeOrderData) => {
		setOrderPanelMode(order.side);
		setOrderType("LIMIT");
		setQuantity(Math.max(1, order.quantity - order.filledQuantity));
		setLimitPrice(
			Number(order.limitPrice ?? order.orderPrice ?? stock?.price ?? 0),
		);

		toast({
			title: "정정할 주문 값을 불러왔습니다.",
			description:
				"현재 백엔드에는 정정 전용 API가 확인되지 않아 기존 주문 취소 후 새 주문을 제출해야 합니다.",
			status: "info",
			isClosable: true,
		});
	};

	useEffect(() => {
		fetchStock(selectedSymbol);
		loadTradingData();
		void loadMarketStatus();

		const marketStatusTimer =
			window.setInterval(
				() => {
					void loadMarketStatus();
				},
				30_000,
			);

		return () => {
			window.clearInterval(
				marketStatusTimer,
			);
		};

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);






	useEffect(() => {
		if (detailSection !== "executions" || !stock?.symbol) return;

		void fetchMarketExecutions(stock.symbol);
		const timer = window.setInterval(() => {
			void fetchMarketExecutions(stock.symbol);
		}, 10_000);

		return () => window.clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detailSection, stock?.symbol]);

	useEffect(() => {
		if (
			marketStatus &&
			isMarketClosed &&
			orderType === "MARKET"
		) {
			setOrderType("LIMIT");
		}
	}, [
		marketStatus,
		isMarketClosed,
		orderType,
	]);

	return (
		<Box
			className="Exchange"
			px={{ base: 4, md: 6, xl: 8 }}
			py={{ base: 5, md: 7 }}
			bg="app.background"
			minH="100vh"
		>
			<Flex mb="5" align="end" gap="4" wrap="wrap">
				<Box>
					<Heading size="lg" letterSpacing="-0.035em">실시간 차트</Heading>
					<Text color="app.subtleText" mt="1" fontSize="sm">
						실시간 시세를 확인하고 모의투자 주문을 실행합니다.
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
					국내 주식 · 실시간 모의투자
				</Badge>
				<Button
					size="sm"
					h="36px"
					px="16px"
					variant="outline"
					borderColor="brand.500"
					color="brand.600"
					bg="white"
					fontWeight="900"
					_hover={{ bg: "orange.50" }}
					onClick={() => setIsMarketSimulatorOpen(true)}
				>
					시장 반응 시뮬레이터 ›
				</Button>
			</Flex>

			<RelatedFinancialTerms
				title="현재 화면의 주요 투자 용어"
				description="차트와 주문 화면에서 자주 보이는 지표와 거래 방식을 금융사전에서 확인하세요."
				termIds={[
					"per",
					"pbr",
					"volume",
					"volatility",
					"market_order",
					"limit_order",
				]}
			/>

			<Card
				mb="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
				overflow="hidden"
			>
				<CardBody px={{ base: 5, lg: 7 }} py={{ base: 5, lg: 6 }}>
					{isLoadingStock || !stock ? (
						<Flex h="126px" align="center" justify="center">
							<Spinner color="brand.500" />
						</Flex>
					) : (
						<Flex
							align={{ base: "stretch", lg: "center" }}
							direction={{ base: "column", lg: "row" }}
							gap={{ base: 5, lg: 8 }}
						>
							<Box minW={{ lg: "290px" }}>
								<Text fontSize="12px" color="app.subtleText" fontWeight="700">
									{stock.symbol} · {stock.market ?? "KRX"}
								</Text>
								<Heading mt="1" size="lg" letterSpacing="-0.035em">{stock.name}</Heading>
								<Flex mt="3" align="baseline" gap="3" wrap="wrap">
									<Heading size="xl" letterSpacing="-0.04em">{won.format(stock.price)}</Heading>
									<Text color={isUp ? "red.500" : "blue.500"} fontWeight="900">
										{isUp ? "▲" : "▼"} {won.format(Math.abs(stock.changePrice))} ({stock.changeRate.toFixed(2)}%)
									</Text>
								</Flex>
							</Box>

							<Box
								display={{ base: "none", lg: "block" }}
								w="1px"
								h="70px"
								bg="app.borderSoft"
							/>

							<Grid
								templateColumns={{
									base: "repeat(2, minmax(0, 1fr))",
									md: "repeat(4, 104px)",
								}}
								gap={{ base: 4, md: 4 }}
								alignItems="center"
								flex="0 0 auto"
								ml={{ base: "0", lg: "50px", xl: "300px" }}
							>
								{[
									{
										label: "시가",
										value: won.format(stock.open),
										color: "app.text",
									},
									{
										label: "고가",
										value: won.format(stock.high),
										color: "#F05B45",
									},
									{
										label: "저가",
										value: won.format(stock.low),
										color: "#2F67D8",
									},
									{
										label: "거래량",
										value: formatNumber.format(stock.volume),
										color: "app.text",
									},
								].map(({ label, value, color }) => (
									<Box key={label} minW="0">
										<Text
											fontSize="9px"
											color="app.subtleText"
											fontWeight="700"
										>
											{label}
										</Text>
										<Text
											mt="1.5"
											fontSize={{ base: "12px", xl: "13px" }}
											fontWeight="800"
											color={color}
											whiteSpace="nowrap"
										>
											{value}
										</Text>
									</Box>
								))}
							</Grid>
						</Flex>
					)}
				</CardBody>
			</Card>

			<Grid
				templateColumns={{ base: "1fr", "2xl": "minmax(0, 1fr) 382px" }}
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
							<Flex align={{ base: "stretch", lg: "center" }} direction={{ base: "column", lg: "row" }} gap="4">
								<Box>
									<Heading size="md">차트</Heading>
									<Text mt="1" fontSize="11px" color="app.subtleText">
										현재 선택: {selectedChartLabel}
									</Text>
								</Box>
								<Spacer />
								<HStack spacing="2" wrap="wrap">
									{chartOptions.map((option) => {
										const active = chartPeriod === option.period && chartInterval === option.interval;
										return (
											<Button
												key={option.label}
												size="sm"
												h="32px"
												px="3"
												fontSize="11px"
												fontWeight="800"
												variant="outline"
												borderColor={active ? "brand.500" : "app.borderSoft"}
												bg={active ? "orange.50" : "white"}
												color={active ? "brand.600" : "app.subtleText"}
												onClick={() => changeChartOption(option.period, option.interval)}
												isDisabled={isLoadingStock}
											>
												{option.label}
											</Button>
										);
									})}
									<Button
										size="sm"
										h="34px"
										px="16px"
										variant="outline"
										borderColor="brand.500"
										color="brand.600"
										bg={isAiRamenOpen ? "orange.50" : "white"}
										fontWeight="900"
										_hover={{ bg: "orange.50" }}
										onClick={() => setRightPanelMode("AI")}
									>
										AI 라면 ›
									</Button>
								</HStack>
							</Flex>
						</CardHeader>

						<CardBody pt="4">
							<Box minW="0">
									{isLoadingStock ? (
										<Flex h={{ base: "420px", xl: "540px" }} align="center" justify="center">
											<Spinner color="brand.500" />
										</Flex>
									) : (
										<InteractiveStockChart data={chartPoints} height={540} />
									)}
							</Box>
						</CardBody>
					</Card>
				</GridItem>

				<GridItem minW="0">

				{rightPanelMode === "AI" ? (
					<Box
						position={{ "2xl": "sticky" }}
						top={{ "2xl": "102px" }}
						minW="0"
					>
						<AiRamenPanel
							isOpen
							onClose={() => setRightPanelMode("ORDER")}
							stock={stock}
							chartPoints={chartPoints}
							chartPeriod={chartPeriod}
							chartInterval={chartInterval}
						/>
					</Box>
				) : (
					<Card
						position={{ "2xl": "sticky" }}
						top={{ "2xl": "102px" }}
						borderColor="app.borderSoft"
						boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
					>
						<CardHeader pb="3" borderBottomWidth="1px" borderColor="app.borderSoft">
							<Flex align="flex-end">
								<Flex align="flex-end" gap="8px" minW="0">
									<Heading size="md" lineHeight="1">주문</Heading>
									<Text
										pb="1px"
										fontSize="10px"
										color="app.subtleText"
										fontWeight="700"
										whiteSpace="nowrap"
									>
										{stock?.name ?? "종목"} · {stock?.symbol ?? "-"}
									</Text>
								</Flex>
								<Spacer />
								<Badge colorScheme={marketStatus?.isOpen ? "green" : "orange"} borderRadius="full">
									{marketStatus?.isOpen ? "장 운영 중" : "장 마감"}
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
								bg="#ffffff"
								overflow="hidden"
							>
								<Grid
									templateColumns="repeat(3, minmax(0, 1fr))"
									position="relative"
									zIndex="1"
								>
									{([
										["BUY", "매수"],
										["SELL", "매도"],
										["MANAGE", "정정/취소"],
									] as const).map(([mode, label]) => {
										const active = orderPanelMode === mode;

										return (
											<Button
												key={mode}
												h="42px"
												borderRadius="0"
												borderWidth="0"
												borderRightWidth={
													mode === "MANAGE"
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
												fontWeight={active ? "900" : "700"}
												_hover={{
													bg: "#FFF9F2",
													color: "#F26438",
												}}
												_focusVisible={{
													boxShadow:
														"inset 0 0 0 2px rgba(242, 100, 56, 0.18)",
												}}
												onClick={() =>
													setOrderPanelMode(mode)
												}
											>
												{label}
											</Button>
										);
									})}
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
										orderPanelMode === "BUY"
											? "translateX(0%)"
											: orderPanelMode === "SELL"
												? "translateX(100%)"
												: "translateX(200%)"
									}
									transition="transform 220ms cubic-bezier(0.4, 0, 0.2, 1)"
									willChange="transform"
									pointerEvents="none"
								/>
							</Box>

							{orderPanelMode === "MANAGE" ? (
								<Box>
									<Flex align="center" mb="3">
										<Text fontSize="12px" fontWeight="900">현재 종목 미체결 주문</Text>
										<Spacer />
										<Button size="xs" variant="ghost" onClick={checkPendingTradeOrders}>새로고침</Button>
									</Flex>

									<Stack spacing="2" maxH="360px" overflowY="auto">
										{pendingOrders.map((order) => (
											<Box key={order._id} p="3" borderWidth="1px" borderColor="app.borderSoft" borderRadius="9px" bg="#FFFCF8">
												<Flex align="center" gap="2">
													<Badge colorScheme={order.side === "BUY" ? "red" : "blue"}>
														{order.side === "BUY" ? "매수" : "매도"}
													</Badge>
													<Text fontSize="11px" color="app.subtleText">지정가</Text>
													<Spacer />
													<Text fontSize="11px" color="app.subtleText">
														{new Date(order.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
													</Text>
												</Flex>
												<Flex mt="2" justify="space-between" fontSize="12px">
													<Text>{formatNumber.format(order.quantity - order.filledQuantity)}주</Text>
													<Text fontWeight="900">{won.format(order.limitPrice ?? order.orderPrice ?? 0)}</Text>
												</Flex>
												<SimpleGrid mt="3" columns={2} spacing="2">
													<Button size="xs" variant="outline" onClick={() => prepareOrderCorrection(order)}>
														정정
													</Button>
													<Button size="xs" colorScheme="red" variant="outline" onClick={() => void cancelPendingOrder(order._id)}>
														취소
													</Button>
												</SimpleGrid>
											</Box>
										))}
										{pendingOrders.length === 0 && (
											<Flex minH="180px" align="center" justify="center" borderWidth="1px" borderColor="app.borderSoft" borderRadius="9px">
												<Text fontSize="12px" color="app.subtleText">미체결 주문이 없습니다.</Text>
											</Flex>
										)}
									</Stack>

									<Text mt="3" fontSize="10px" color="app.subtleText">
										정정은 기존 값을 주문 입력창에 불러옵니다. 정정 전용 백엔드 API 연결 여부는 별도로 확인해야 합니다.
									</Text>
								</Box>
							) : (
								<>
									<SimpleGrid columns={2} spacing="3" mb="4">
										<Box p="3" borderRadius="10px" bg="#FAF7F2">
											<Text fontSize="10px" color="app.subtleText">주문 가능 금액</Text>
											<Text mt="1" fontSize="14px" fontWeight="900">{won.format(portfolio?.account?.availableCash ?? 0)}</Text>
										</Box>
										<Box p="3" borderRadius="10px" bg="#FAF7F2">
											<Text fontSize="10px" color="app.subtleText">보유수량</Text>
											<Text mt="1" fontSize="14px" fontWeight="900">{formatNumber.format(selectedHolding?.quantity ?? 0)}주</Text>
										</Box>
									</SimpleGrid>

									<SimpleGrid columns={2} spacing="2" mb="4">
										<Button h="38px" bg={orderType === "MARKET" ? "#3C352E" : "white"} color={orderType === "MARKET" ? "white" : "app.text"} borderWidth="1px" borderColor="app.borderSoft" onClick={() => setOrderType("MARKET")} isDisabled={isMarketClosed}>
											시장가
										</Button>
										<Button h="38px" bg={orderType === "LIMIT" ? "#3C352E" : "white"} color={orderType === "LIMIT" ? "white" : "app.text"} borderWidth="1px" borderColor="app.borderSoft" onClick={() => {
											setOrderType("LIMIT");
											if (limitPrice <= 0 && stock?.price) setLimitPrice(stock.price);
										}}>
											지정가
										</Button>
									</SimpleGrid>

									<Box mb="3">
										<Text mb="1.5" fontSize="11px" fontWeight="800">주문 가격</Text>
										<Grid templateColumns="42px minmax(0, 1fr) 42px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="8px" overflow="hidden">
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderRightWidth="1px" borderColor="app.borderSoft" isDisabled={orderType === "MARKET" || !stock} onClick={() => setLimitPrice((price) => Math.max(priceStep, (price || stock?.price || 0) - priceStep))}>−</Button>
											<NumberInput
												value={orderType === "MARKET" ? stock?.price ?? 0 : limitPrice}
												min={priceStep}
												step={priceStep}
												format={(value) => {
													if (!value) return "";

													const number = Number(
														String(value).replace(/[^\d.-]/g, ""),
													);

													return Number.isFinite(number)
														? `${number.toLocaleString("ko-KR")}원`
														: "";
												}}
												parse={(value) =>
													value.replace(/[^\d.-]/g, "")
												}
												onChange={(_, value) =>
													orderType === "LIMIT" &&
													setLimitPrice(Number.isNaN(value) ? 0 : value)
												}
												isReadOnly={orderType === "MARKET"}
												isDisabled={!stock}
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
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderLeftWidth="1px" borderColor="app.borderSoft" isDisabled={orderType === "MARKET" || !stock} onClick={() => setLimitPrice((price) => (price || stock?.price || 0) + priceStep)}>＋</Button>
										</Grid>
										<Flex mt="1.5" align="center">
											<Text fontSize="10px" color="app.subtleText">호가 단위 {formatNumber.format(priceStep)}원</Text>
											<Spacer />
											<Button size="xs" variant="ghost" color="brand.600" onClick={() => stock?.price && setLimitPrice(stock.price)} isDisabled={!stock || orderType === "MARKET"}>현재가</Button>
										</Flex>
									</Box>

									<Box>
										<Text mb="1.5" fontSize="11px" fontWeight="800">주문 수량</Text>
										<Grid templateColumns="42px minmax(0, 1fr) 42px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="8px" overflow="hidden">
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderRightWidth="1px" borderColor="app.borderSoft" onClick={() => setQuantity((value) => Math.max(1, value - 1))} isDisabled={!stock}>−</Button>
											<NumberInput value={quantity} min={1} onChange={(_, value) => setQuantity(Number.isNaN(value) ? 1 : Math.max(1, Math.floor(value)))} isDisabled={!stock}>
												<NumberInputField h="42px" border="0" borderRadius="0" textAlign="center" fontWeight="900" px="4px" />
											</NumberInput>
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderLeftWidth="1px" borderColor="app.borderSoft" onClick={() => setQuantity((value) => value + 1)} isDisabled={!stock}>＋</Button>
										</Grid>

										<SimpleGrid columns={4} spacing="2" mt="2">
											{[10, 50, 100].map((value) => (
												<Button key={value} size="xs" variant="outline" borderColor="app.borderSoft" onClick={() => setQuantity(value)}>{value}</Button>
											))}
											<Button size="xs" variant="outline" borderColor="app.borderSoft" onClick={() => setQuantity(maximumQuantity)}>최대</Button>
										</SimpleGrid>
									</Box>

									<Divider mt="5" mb="4" borderColor="#E8DCCB" />

									<Flex justify="space-between" align="center">
										<Text fontSize="11px" color="app.subtleText">예상 총 금액</Text>
										<Text fontWeight="900">{won.format((orderType === "LIMIT" ? limitPrice : stock?.price ?? 0) * quantity)}</Text>
									</Flex>

									<Button
										mt="5"
										w="100%"
										h="50px"
										bg={orderPanelMode === "BUY" ? "#F26438" : "#4679C8"}
										color="white"
										_hover={{ bg: orderPanelMode === "BUY" ? "#DF552C" : "#3869B7" }}
										onClick={() => void submitTradeOrder(orderPanelMode)}
										isLoading={isSubmittingOrder}
										isDisabled={!stock || isCurrentOrderBlocked}
									>
										{orderType === "LIMIT" && isMarketClosed ? "예약 " : ""}
										{orderPanelMode === "BUY" ? "매수 주문하기" : "매도 주문하기"}
									</Button>

									<Divider my="4" />
									<Flex gap="2">
										<Button size="xs" variant="outline" onClick={checkPendingTradeOrders}>미체결 확인</Button>
										<Button size="xs" variant="outline" onClick={() => void topUpTradingAccount()} isLoading={isToppingUp}>100만 원 충전</Button>
									</Flex>
								</>
							)}
						</CardBody>
					</Card>
				
				)}
			</GridItem>
			</Grid>


			<Grid
				mt="5"
				templateColumns={{
					base: "1fr",
					md: "repeat(2, minmax(0, 1fr))",
					xl: "repeat(4, minmax(0, 1fr))",
				}}
				gap="5"
				alignItems="stretch"
			>
				<DetailSelectorCard
					title="호가"
					description="매도·매수 가격과 잔량"
					selected={detailSection === "orderbook"}
					onClick={() => {
						setDetailSection("orderbook");
						if (stock?.symbol) void fetchOrderBook(stock.symbol);
					}}
				>
					<Stack spacing="5px">
						{(orderBook?.levels ?? []).slice(0, 4).map((level) => (
							<Grid key={level.level} templateColumns="1fr 1fr 1fr" gap="2">
								<Text fontSize="10px" color="#F05B45">
									{formatNumber.format(level.askPrice)}
								</Text>
								<Text textAlign="center" fontSize="10px" color="app.subtleText">
									{formatNumber.format(level.askVolume + level.bidVolume)}
								</Text>
								<Text textAlign="right" fontSize="10px" color="#2F67D8">
									{formatNumber.format(level.bidPrice)}
								</Text>
							</Grid>
						))}
						{(!orderBook?.levels || orderBook.levels.length === 0) && (
							<Text fontSize="11px" color="app.subtleText">호가 데이터 조회 전</Text>
						)}
					</Stack>
					<Flex mt="12px" pt="10px" borderTopWidth="1px" borderColor="app.borderSoft">
						<Text fontSize="10px" color="#F05B45">
							매도 {formatNumber.format(orderBook?.totalAskVolume ?? 0)}
						</Text>
						<Spacer />
						<Text fontSize="10px" color="#2F67D8">
							매수 {formatNumber.format(orderBook?.totalBidVolume ?? 0)}
						</Text>
					</Flex>
				</DetailSelectorCard>

				<DetailSelectorCard
					title="체결"
					description="종목별 실시간 시장 체결"
					selected={detailSection === "executions"}
					onClick={() => {
						setDetailSection("executions");
						if (stock?.symbol) void fetchMarketExecutions(stock.symbol);
					}}
				>
					<Grid templateColumns="1fr 1fr 1fr" gap="2" mb="8px">
						<Text fontSize="10px" color="app.subtleText">시간</Text>
						<Text textAlign="center" fontSize="10px" color="app.subtleText">체결가</Text>
						<Text textAlign="right" fontSize="10px" color="app.subtleText">수량</Text>
					</Grid>
					{(marketExecutions?.items ?? []).slice(0, 4).map((item, index) => (
						<Grid key={`${item.time}-${index}`} templateColumns="1fr 1fr 1fr" gap="2" py="4px">
							<Text fontSize="10px" color="app.subtleText">{item.time}</Text>
							<Text textAlign="center" fontSize="10px" fontWeight="800" color={item.direction === "UP" ? "#F05B45" : item.direction === "DOWN" ? "#2F67D8" : "app.text"}>{formatNumber.format(item.price)}</Text>
							<Text textAlign="right" fontSize="10px" color="app.subtleText">{formatNumber.format(item.quantity)}</Text>
						</Grid>
					))}
					{(marketExecutions?.items?.length ?? 0) === 0 && <Text mt="8px" fontSize="10px" color="app.subtleText">체결 데이터 없음</Text>}
				</DetailSelectorCard>

				<DetailSelectorCard
					title="정보"
					description="기업·재무 핵심 정보"
					selected={detailSection === "information"}
					onClick={() => {
						setDetailSection("information");
						if (stock?.symbol) void fetchStockDetail(stock.symbol);
					}}
				>
					<CompactStockInfo detail={stockDetail} isLoading={isLoadingDetail} />
				</DetailSelectorCard>

				<Box minW="0" h="100%">
					<CompactStockNews
						symbol={stock?.symbol ?? selectedSymbol}
						name={stock?.name ?? "삼성전자"}
						market={stock?.market ?? "KOSPI"}
					/>
				</Box>
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
								{detailSection === "orderbook"
									? "호가 · 수급 현황"
									: detailSection === "executions"
										? "실시간 체결"
										: "종목 상세 정보"}
							</Heading>
							<Text mt="1" fontSize="11px" color="app.subtleText">
								{detailSection === "orderbook"
									? "실시간 매도·매수 잔량과 현재가를 함께 확인합니다."
									: detailSection === "executions"
										? "KIS 종목별 체결 데이터를 10초 간격으로 갱신합니다."
										: "현재 종목의 기업 정보와 재무지표를 확인합니다."}
							</Text>
						</Box>
						<Spacer />
						{detailSection !== "information" && (
							<Button
								size="xs"
								variant="outline"
								onClick={() => {
									if (!stock?.symbol) return;
									if (detailSection === "orderbook") void fetchOrderBook(stock.symbol);
									else void fetchMarketExecutions(stock.symbol);
								}}
								isLoading={detailSection === "orderbook" ? isLoadingOrderBook : isLoadingExecutions}
							>
								새로고침
							</Button>
						)}
					</Flex>
				</CardHeader>
				<CardBody pt="0">
					{detailSection === "orderbook" && (
						<IntegratedOrderBookPanel
							orderBook={orderBook}
							isLoading={isLoadingOrderBook}
							stock={stock}
							investorTrend={investorTrend}
							isLoadingInvestorTrend={isLoadingInvestorTrend}
							investorPeriod={investorPeriod}
							onInvestorPeriodChange={changeInvestorPeriod}
						/>
					)}
					{detailSection === "executions" && (
						<MarketExecutionPanel
							data={marketExecutions}
							isLoading={isLoadingExecutions}
							stock={stock}
							investorTrend={investorTrend}
							isLoadingInvestorTrend={isLoadingInvestorTrend}
							investorPeriod={investorPeriod}
							onInvestorPeriodChange={changeInvestorPeriod}
						/>
					)}
					{detailSection === "information" && (
						<StockDetailPanel detail={stockDetail} isLoading={isLoadingDetail} historyPoints={detailHistory} />
					)}
				</CardBody>
			</Card>


			<MarketSimulatorPanel
				stock={stock}
				isOpen={isMarketSimulatorOpen}
				onClose={() => setIsMarketSimulatorOpen(false)}
				showTrigger={false}
			/>

		</Box>
	);
}
