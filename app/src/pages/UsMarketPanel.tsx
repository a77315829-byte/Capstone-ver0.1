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

type UsOrderPanelMode = "BUY" | "SELL" | "MANAGE";
type UsDetailSection = "orderbook" | "executions" | "information";

type UsOrderBookLevelData = {
	level: number;
	askPrice: number;
	askVolume: number;
	bidPrice: number;
	bidVolume: number;
};

type UsOrderBookData = {
	symbol: string;
	exchange: UsExchangeCode;
	currency: string;
	totalAskVolume: number;
	totalBidVolume: number;
	levels: UsOrderBookLevelData[];
	quoteDate: string | null;
	quoteTime: string | null;
	fetchedAt: string;
};

type UsExecutionItemData = {
	time: string;
	price: number;
	quantity: number;
	cumulativeVolume: number;
	changePrice: number;
	changeRate: number;
	strength: number;
	bidPrice: number;
	askPrice: number;
	direction: "UP" | "DOWN" | "FLAT";
};

type UsExecutionData = {
	symbol: string;
	exchange: UsExchangeCode;
	day: "0" | "1";
	items: UsExecutionItemData[];
	fetchedAt: string;
};

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


function UsDetailMetric({
	label,
	value,
	accent,
}: {
	label: string;
	value: React.ReactNode;
	accent?: string;
}) {
	return (
		<Box
			p="12px"
			borderWidth="1px"
			borderColor="#F1E8DE"
			borderRadius="10px"
			bg="#FFFCF8"
		>
			<Text fontSize="10px" color="app.subtleText">{label}</Text>
			<Text mt="5px" fontSize="13px" fontWeight="900" color={accent ?? "app.text"}>
				{value}
			</Text>
		</Box>
	);
}

function UsStockDetailPanel({
	quote,
	isLoading,
}: {
	quote: UsStockQuote | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return <Flex h="360px" align="center" justify="center"><Spinner color="brand.500" /></Flex>;
	}

	if (!quote) {
		return <Flex h="320px" align="center" justify="center" color="app.subtleText">종목 상세정보를 불러오지 못했습니다.</Flex>;
	}

	const isEtf = quote.assetType === "ETF";
	const directionColor = quote.changeRate > 0 ? "#F05B45" : quote.changeRate < 0 ? "#2F67D8" : "app.text";

	return (
		<Grid templateColumns={{ base: "1fr", xl: "1.1fr 1fr 1fr" }} gap="14px">
			<Box p="18px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" bg="white">
				<Flex align="center" gap="8px" wrap="wrap">
					<Heading size="sm">{isEtf ? "ETF 개요" : "기업 개요"}</Heading>
					<Badge bg="orange.50" color="brand.600" borderRadius="full">{isEtf ? "ETF" : "주식"}</Badge>
				</Flex>
				<Text mt="14px" fontSize="17px" fontWeight="900">{quote.name}</Text>
				<Text mt="4px" fontSize="11px" color="app.subtleText">{quote.symbol} · {quote.market} · {quote.longName}</Text>
				<Text mt="16px" fontSize="12px" lineHeight="1.8" color="#5B5147">
					{quote.summary ?? (isEtf ? "미국 증시에 상장된 ETF입니다." : "미국 증시에 상장된 기업입니다.")}
				</Text>
				<SimpleGrid columns={2} spacing="8px" mt="18px">
					<UsDetailMetric label={isEtf ? "ETF 분류" : "자산 유형"} value={quote.category ?? quote.assetType ?? "-"} />
					<UsDetailMetric label="거래소" value={quote.market ?? "-"} />
					{isEtf && <UsDetailMetric label="추종 지수" value={quote.benchmark ?? "-"} />}
					{isEtf && <UsDetailMetric label="운용사" value={quote.issuer ?? "-"} />}
				</SimpleGrid>
			</Box>

			<Box p="18px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" bg="white">
				<Heading size="sm" mb="14px">재무 요약</Heading>
				<SimpleGrid columns={2} spacing="8px">
					<UsDetailMetric label="시가총액" value={Number(quote.marketCap ?? 0) > 0 ? compactUsd.format(Number(quote.marketCap)) : "-"} />
					<UsDetailMetric label="PER" value={formatRatio(quote.per)} />
					<UsDetailMetric label="PBR" value={formatRatio(quote.pbr)} />
					<UsDetailMetric label="EPS" value={formatUsdOrDash(quote.eps)} />
					<UsDetailMetric label="BPS" value={formatUsdOrDash(quote.bps)} />
					<UsDetailMetric label="발행주식수" value={Number(quote.sharesOutstanding ?? 0) > 0 ? numberFormat.format(Number(quote.sharesOutstanding)) : "-"} />
				</SimpleGrid>
				<Text mt="12px" fontSize="9px" color="app.subtleText">KIS 현재가상세가 제공한 항목만 표시됩니다.</Text>
			</Box>

			<Box p="18px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" bg="white">
				<Heading size="sm" mb="14px">주가 정보</Heading>
				<SimpleGrid columns={2} spacing="8px">
					<UsDetailMetric label="현재가" value={usd.format(quote.price)} accent={directionColor} />
					<UsDetailMetric label="등락률" value={`${quote.changeRate > 0 ? "+" : ""}${quote.changeRate.toFixed(2)}%`} accent={directionColor} />
					<UsDetailMetric label="시가" value={formatUsdOrDash(quote.open)} />
					<UsDetailMetric label="고가" value={formatUsdOrDash(quote.high)} accent="#F05B45" />
					<UsDetailMetric label="저가" value={formatUsdOrDash(quote.low)} accent="#2F67D8" />
					<UsDetailMetric label="전일 종가" value={formatUsdOrDash(quote.previousClose)} />
					<UsDetailMetric label="거래량" value={numberFormat.format(quote.volume)} />
					<UsDetailMetric label="52주 최고" value={formatUsdOrDash(quote.fiftyTwoWeekHigh)} />
					<UsDetailMetric label="52주 최저" value={formatUsdOrDash(quote.fiftyTwoWeekLow)} />
				</SimpleGrid>
			</Box>
		</Grid>
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
			textAlign="left"
			w="100%"
			minH="220px"
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
			_hover={{ borderColor: "brand.400", transform: "translateY(-1px)" }}
		>
			<CardHeader pb="2">
				<Flex align="center">
					<Box>
						<Heading size="sm" color={selected ? "brand.600" : "app.text"}>{title}</Heading>
						<Text mt="1" fontSize="10px" color="app.subtleText">{description}</Text>
					</Box>
					<Spacer />
					{selected && <Badge bg="orange.50" color="brand.600" borderRadius="full">선택됨</Badge>}
				</Flex>
			</CardHeader>
			<CardBody pt="2">{children}</CardBody>
		</Card>
	);
}

function UsOrderBookPanel({ data, isLoading }: { data: UsOrderBookData | null; isLoading: boolean }) {
	if (isLoading) return <Flex minH="280px" align="center" justify="center"><Spinner color="brand.500" /></Flex>;
	const levels = data?.levels ?? [];
	if (levels.length === 0) {
		return <Flex minH="280px" align="center" justify="center" textAlign="center"><Box><Text fontSize="13px" fontWeight="900">미국 호가 데이터가 없습니다.</Text><Text mt="2" fontSize="11px" color="app.subtleText">KIS 실전/모의 환경의 해외주식 호가 지원 여부를 확인하세요.</Text></Box></Flex>;
	}

	return (
		<Box>
			<Grid templateColumns="1fr 1fr 1fr 1fr" px="12px" py="10px" bg="#FAF7F2" borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px 10px 0 0">
				{["매도 잔량", "매도 호가", "매수 호가", "매수 잔량"].map((label) => <Text key={label} fontSize="11px" fontWeight="800" color="app.subtleText" textAlign="center">{label}</Text>)}
			</Grid>
			<Stack spacing="0" borderWidth="1px" borderTopWidth="0" borderColor="app.borderSoft" borderRadius="0 0 10px 10px" overflow="hidden">
				{levels.map((level) => (
					<Grid key={level.level} templateColumns="1fr 1fr 1fr 1fr" px="12px" py="11px" borderBottomWidth="1px" borderColor="#F1E8DE">
						<Text textAlign="center" fontSize="11px">{numberFormat.format(level.askVolume)}</Text>
						<Text textAlign="center" fontSize="11px" fontWeight="900" color="#F05B45">{usd.format(level.askPrice)}</Text>
						<Text textAlign="center" fontSize="11px" fontWeight="900" color="#2F67D8">{usd.format(level.bidPrice)}</Text>
						<Text textAlign="center" fontSize="11px">{numberFormat.format(level.bidVolume)}</Text>
					</Grid>
				))}
			</Stack>
			<Flex mt="3" gap="4" justify="flex-end" fontSize="11px"><Text color="#F05B45">총 매도 {numberFormat.format(data?.totalAskVolume ?? 0)}</Text><Text color="#2F67D8">총 매수 {numberFormat.format(data?.totalBidVolume ?? 0)}</Text></Flex>
		</Box>
	);
}

type UsExecutionTrendBucket = {
	label: string;
	volume: number;
	strength: number;
	count: number;
};

function buildUsExecutionTrendBuckets(
	items: UsExecutionItemData[],
): UsExecutionTrendBucket[] {
	const bucketMap = new Map<string, UsExecutionTrendBucket>();

	for (const item of [...items].reverse()) {
		const label = item.time.slice(0, 5);
		const current = bucketMap.get(label) ?? {
			label,
			volume: 0,
			strength: 0,
			count: 0,
		};

		current.volume += Number(item.quantity || 0);
		current.strength += Number(item.strength || 0);
		current.count += 1;
		bucketMap.set(label, current);
	}

	return Array.from(bucketMap.values())
		.map((bucket) => ({
			...bucket,
			strength: bucket.count > 0 ? bucket.strength / bucket.count : 0,
		}))
		.slice(-10);
}

function UsExecutionVolumeTrend({ buckets }: { buckets: UsExecutionTrendBucket[] }) {
	const maxVolume = Math.max(...buckets.map((bucket) => bucket.volume), 1);

	return (
		<Box p="14px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" bg="#FFFCF8">
			<Flex align="center" mb="12px">
				<Box>
					<Text fontSize="12px" fontWeight="900">시간별 체결량 추이</Text>
					<Text mt="2px" fontSize="10px" color="app.subtleText">최근 체결 데이터를 분 단위로 합산</Text>
				</Box>
				<Spacer />
				<Text fontSize="10px" color="app.subtleText">{buckets.length}개 구간</Text>
			</Flex>
			<Flex h="126px" align="flex-end" gap="7px">
				{buckets.map((bucket) => (
					<Flex key={bucket.label} flex="1" h="100%" minW="0" direction="column" justify="flex-end" align="center">
						<Text mb="4px" fontSize="9px" fontWeight="800" whiteSpace="nowrap">{numberFormat.format(bucket.volume)}</Text>
						<Box w="100%" maxW="22px" h={`${Math.max((bucket.volume / maxVolume) * 88, 6)}px`} borderRadius="5px 5px 2px 2px" bg="brand.500" opacity="0.88" />
						<Text mt="5px" fontSize="8px" color="app.subtleText">{bucket.label}</Text>
					</Flex>
				))}
			</Flex>
		</Box>
	);
}

function UsExecutionStrengthTrend({ buckets }: { buckets: UsExecutionTrendBucket[] }) {
	const values = buckets.map((bucket) => bucket.strength);
	const minValue = Math.min(...values, 0);
	const maxValue = Math.max(...values, 100, 1);
	const range = Math.max(maxValue - minValue, 1);
	const coordinateList = buckets.map((bucket, index) => {
		const x = buckets.length <= 1 ? 160 : 12 + (index / (buckets.length - 1)) * 296;
		const y = 102 - ((bucket.strength - minValue) / range) * 82;
		return { x, y, label: bucket.label };
	});
	const points = coordinateList.map((point) => `${point.x},${point.y}`).join(" ");
	const latestStrength =
		values.length > 0
			? (values[values.length - 1] ?? 0)
			: 0;

	return (
		<Box p="14px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" bg="#FFFCF8">
			<Flex align="center" mb="8px">
				<Box>
					<Text fontSize="12px" fontWeight="900">체결강도 추이</Text>
					<Text mt="2px" fontSize="10px" color="app.subtleText">KIS 체결강도 필드 기준</Text>
				</Box>
				<Spacer />
				<Text fontSize="15px" fontWeight="900" color={latestStrength >= 100 ? "#F05B45" : "#2F67D8"}>{latestStrength > 0 ? latestStrength.toFixed(1) : "-"}</Text>
			</Flex>
			<Box position="relative" h="122px">
				<Box position="absolute" left="0" right="0" top="50%" borderTopWidth="1px" borderStyle="dashed" borderColor="#E3D5C8" />
				<svg width="100%" height="112" viewBox="0 0 320 112" preserveAspectRatio="none">
					<polyline fill="none" stroke="#F26438" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
					{coordinateList.map((point, index) => (
						<circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#FFFFFF" stroke="#F26438" strokeWidth="2" />
					))}
				</svg>
				<Flex mt="-2px" justify="space-between">
					{buckets.map((bucket) => <Text key={bucket.label} fontSize="8px" color="app.subtleText">{bucket.label}</Text>)}
				</Flex>
			</Box>
		</Box>
	);
}

function UsExecutionPanel({ data, isLoading }: { data: UsExecutionData | null; isLoading: boolean }) {
	if (isLoading) return <Flex minH="420px" align="center" justify="center"><Spinner color="brand.500" /></Flex>;
	const rows = data?.items ?? [];
	if (rows.length === 0) {
		return <Flex minH="360px" align="center" justify="center" textAlign="center"><Box><Text fontSize="13px" fontWeight="900">미국 체결추이 데이터가 없습니다.</Text><Text mt="2" fontSize="11px" color="app.subtleText">장 운영시간 또는 KIS 해외주식 체결추이 지원 환경을 확인하세요.</Text></Box></Flex>;
	}

	const trendBuckets = buildUsExecutionTrendBuckets(rows);

	return (
		<Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1.45fr) minmax(320px, 0.75fr)" }} gap="14px">
			<Box borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" overflow="hidden" bg="white">
				<Flex px="15px" py="12px" align="center" bg="#FFFCF8" borderBottomWidth="1px" borderColor="app.borderSoft">
					<Box>
						<Text fontSize="13px" fontWeight="900">실시간 체결내역</Text>
						<Text mt="2px" fontSize="10px" color="app.subtleText">직전 체결가보다 높으면 빨강, 낮으면 파랑</Text>
					</Box>
					<Spacer />
					<Badge bg="orange.50" color="brand.600" borderRadius="full">최근 {rows.length}건</Badge>
				</Flex>
				<TableContainer maxH="430px" overflowY="auto">
					<Table size="sm">
						<Thead bg="#FAF7F2" position="sticky" top="0" zIndex="1"><Tr><Th>시간</Th><Th isNumeric>체결가</Th><Th isNumeric>체결량</Th><Th isNumeric>등락률</Th><Th isNumeric>체결강도</Th><Th isNumeric>누적 거래량</Th></Tr></Thead>
						<Tbody>
							{rows.map((item, index) => {
								const olderItem = rows[index + 1];
								const referencePrice = olderItem?.price ?? item.price - item.changePrice;
								const tickDirection = item.price > referencePrice ? "UP" : item.price < referencePrice ? "DOWN" : item.direction;
								const color = tickDirection === "UP" ? "#F05B45" : tickDirection === "DOWN" ? "#2F67D8" : "app.text";
								return (
									<Tr key={`${item.time}-${index}`} _hover={{ bg: "#FFFAF5" }}>
										<Td fontSize="11px">{item.time}</Td>
										<Td isNumeric fontSize="12px" fontWeight="900" color={color}>{usd.format(item.price)}</Td>
										<Td isNumeric fontSize="11px">{numberFormat.format(item.quantity)}</Td>
										<Td isNumeric fontSize="11px" color={item.changeRate >= 0 ? "#F05B45" : "#2F67D8"}>{item.changeRate > 0 ? "+" : ""}{item.changeRate.toFixed(2)}%</Td>
										<Td isNumeric fontSize="11px" fontWeight="800" color={item.strength >= 100 ? "#F05B45" : "#2F67D8"}>{item.strength > 0 ? item.strength.toFixed(1) : "-"}</Td>
										<Td isNumeric fontSize="11px">{numberFormat.format(item.cumulativeVolume)}</Td>
									</Tr>
								);
							})}
						</Tbody>
					</Table>
				</TableContainer>
			</Box>
			<Stack spacing="14px">
				<UsExecutionVolumeTrend buckets={trendBuckets} />
				<UsExecutionStrengthTrend buckets={trendBuckets} />
			</Stack>
		</Grid>
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

	const initialSearchParams =
		new URLSearchParams(
			window.location.search,
		);

	const initialSymbol =
		initialSearchParams
			.get("symbol")
			?.trim()
			.toUpperCase() ||
		"NVDA";

	const requestedExchange =
		initialSearchParams
			.get("exchange")
			?.trim()
			.toUpperCase();

	const initialExchange: UsExchangeCode =
		requestedExchange === "NYS" ||
		requestedExchange === "AMS" ||
		requestedExchange === "NAS"
			? requestedExchange
			: "NAS";

	const [
		selectedSymbol,
		setSelectedSymbol,
	] = useState(initialSymbol);

	const [
		selectedExchange,
		setSelectedExchange,
	] =
		useState<UsExchangeCode>(
			initialExchange,
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

	useEffect(() => {
		const handleStockSelected = (
			event: Event,
		) => {
			const selected = (
				event as CustomEvent<{
					symbol?: string;
					marketType?: string;
					exchange?: string;
				}>
			).detail;

			if (
				selected?.marketType !== "US" ||
				!selected.symbol
			) {
				return;
			}

			const nextSymbol =
				selected.symbol
					.trim()
					.toUpperCase();

			const nextExchange: UsExchangeCode =
				selected.exchange === "NYS" ||
				selected.exchange === "AMS" ||
				selected.exchange === "NAS"
					? selected.exchange
					: "NAS";

			setSelectedSymbol(nextSymbol);
			setSelectedExchange(
				nextExchange,
			);

			void loadQuote(
				nextSymbol,
				nextExchange,
			);
			void loadChart(
				nextSymbol,
				nextExchange,
				chartPeriod,
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
	}, [chartPeriod]);

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

	const [orderPanelMode, setOrderPanelMode] =
		useState<UsOrderPanelMode>("BUY");

	const [detailSection, setDetailSection] =
		useState<UsDetailSection>("orderbook");

	const [usOrderBook, setUsOrderBook] = useState<UsOrderBookData | null>(null);
	const [isLoadingUsOrderBook, setIsLoadingUsOrderBook] = useState(false);
	const [usExecutions, setUsExecutions] = useState<UsExecutionData | null>(null);
	const [isLoadingUsExecutions, setIsLoadingUsExecutions] = useState(false);

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

	const loadUsOrderBook = async (
		symbol = selectedSymbol,
		exchange = selectedExchange,
	) => {
		try {
			setIsLoadingUsOrderBook(true);
			const response = await api.get(`/us-stocks/${exchange}/${symbol}/orderbook`);
			setUsOrderBook(unwrapApiData<UsOrderBookData>(response.data));
		} catch (error) {
			console.error("미국 호가 조회 실패:", error);
			setUsOrderBook(null);
		} finally {
			setIsLoadingUsOrderBook(false);
		}
	};

	const loadUsExecutions = async (
		symbol = selectedSymbol,
		exchange = selectedExchange,
	) => {
		try {
			setIsLoadingUsExecutions(true);
			const response = await api.get(`/us-stocks/${exchange}/${symbol}/executions?day=1&limit=100`);
			setUsExecutions(unwrapApiData<UsExecutionData>(response.data));
		} catch (error) {
			console.error("미국 체결추이 조회 실패:", error);
			setUsExecutions(null);
		} finally {
			setIsLoadingUsExecutions(false);
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

			const actualExchange = loadedQuote?.exchange ?? item.exchange;
			void loadUsOrderBook(item.symbol, actualExchange);
			void loadUsExecutions(item.symbol, actualExchange);
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
			loadUsOrderBook(),
			loadUsExecutions(),
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
		if (detailSection !== "executions") return;
		void loadUsExecutions(selectedSymbol, selectedExchange);
		const timer = window.setInterval(() => {
			void loadUsExecutions(selectedSymbol, selectedExchange);
		}, 10_000);
		return () => window.clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detailSection, selectedSymbol, selectedExchange]);

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


	const pendingOrders = useMemo(
		() =>
			orders.filter(
				(order) =>
					order.status === "PENDING" &&
					order.symbol === selectedSymbol &&
					order.exchange === selectedExchange,
			),
		[orders, selectedExchange, selectedSymbol],
	);

	const effectivePrice =
		orderType === "LIMIT"
			? limitPrice
			: quote?.price ?? 0;

	const maximumQuantity = useMemo(() => {
		if (orderPanelMode === "SELL") {
			return Math.max(1, Math.floor(selectedHolding?.quantity ?? 1));
		}

		const availableCash = Number(account?.availableCash ?? 0);
		const price = Number(effectivePrice || quote?.price || 0);

		return price > 0
			? Math.max(1, Math.floor(availableCash / price))
			: 1;
	}, [
		account?.availableCash,
		effectivePrice,
		orderPanelMode,
		quote?.price,
		selectedHolding?.quantity,
	]);

	const prepareUsOrderCorrection = (order: UsTradeOrder) => {
		setOrderPanelMode(order.side);
		setOrderType("LIMIT");
		setQuantity(Math.max(1, order.quantity));
		setLimitPrice(
			Number(order.limitPrice ?? order.orderPrice ?? quote?.price ?? 0),
		);
	};

	return (
		<Box
			px={{ base: 4, md: 6, xl: 8 }}
			py={{ base: 5, md: 7 }}
			bg="app.background"
			minH="100vh"
		>
			<Flex mb="5" align="end" gap="4" wrap="wrap">
				<Box>
					<Heading size="lg" letterSpacing="-0.035em">실시간 차트</Heading>
					<Text color="app.subtleText" mt="1" fontSize="sm">
						미국 주식·ETF 시세를 확인하고 모의투자 주문을 실행합니다.
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
				title="미국 시장에서 자주 보는 금융 용어"
				description="기업 지표, ETF, 환율과 위험관리 개념을 바로 확인할 수 있습니다."
				termIds={[
					"per",
					"pbr",
					"etf",
					"exchange_rate",
					"volatility",
					"diversification",
				]}
			/>

			<Card
				mb="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)"
				overflow="hidden"
			>
				<CardBody px={{ base: 5, lg: 7 }} py={{ base: 5, lg: 6 }}>
					{isLoadingQuote || !quote ? (
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
								<Flex align="center" gap="2" wrap="wrap">
									<Text fontSize="12px" color="app.subtleText" fontWeight="700">
										{quote.symbol} · {quote.market}
									</Text>
									<Badge bg="#F5EFE7" color="app.subtleText">
										{quote.assetType === "ETF" ? "ETF" : "주식"}
									</Badge>
								</Flex>
								<Heading mt="1" size="lg" letterSpacing="-0.035em">{quote.name}</Heading>
								<Flex mt="3" align="baseline" gap="3" wrap="wrap">
									<Heading size="xl" letterSpacing="-0.04em">{usd.format(quote.price)}</Heading>
									<Text color={isUp ? "red.500" : "blue.500"} fontWeight="900">
										{isUp ? "▲" : "▼"} {usd.format(Math.abs(quote.changePrice))} ({quote.changeRate.toFixed(2)}%)
									</Text>
								</Flex>
							</Box>

							<Box display={{ base: "none", lg: "block" }} w="1px" h="76px" bg="app.borderSoft" />

							<SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 4, xl: 7 }} flex="1">
								{[
									["전일 종가", usd.format(quote.previousClose)],
									["52주 최고", formatUsdOrDash(quote.fiftyTwoWeekHigh)],
									["52주 최저", formatUsdOrDash(quote.fiftyTwoWeekLow)],
									["거래량", numberFormat.format(quote.volume)],
								].map(([label, value]) => (
									<Box key={label}>
										<Text fontSize="12px" color="app.subtleText" fontWeight="700">{label}</Text>
										<Text mt="1.5" fontSize={{ base: "15px", xl: "17px" }} fontWeight="900">{value}</Text>
									</Box>
								))}
							</SimpleGrid>
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
					<Card borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)" overflow="hidden">
						<CardHeader pb="0">
							<Flex align={{ base: "stretch", lg: "center" }} direction={{ base: "column", lg: "row" }} gap="4">
								<Box>
									<Heading size="md">차트</Heading>
									<Text mt="1" fontSize="11px" color="app.subtleText">
										현재 선택: {chartPeriod === "1m" ? "1개월" : chartPeriod === "6m" ? "6개월" : "1년"}
									</Text>
								</Box>
								<Spacer />
								<HStack spacing="2" wrap="wrap">
									{([[
										"1개월", "1m",
									], ["6개월", "6m"], ["1년", "1y"]] as const).map(([label, period]) => {
										const active = chartPeriod === period;
										return (
											<Button
												key={period}
												size="sm"
												h="32px"
												px="3"
												fontSize="11px"
												fontWeight="800"
												variant="outline"
												borderColor={active ? "brand.500" : "app.borderSoft"}
												bg={active ? "orange.50" : "white"}
												color={active ? "brand.600" : "app.subtleText"}
												onClick={() => {
													setChartPeriod(period);
													void loadChart(selectedSymbol, selectedExchange, period);
												}}
											>
												{label}
											</Button>
										);
									})}
								</HStack>
							</Flex>
						</CardHeader>
						<CardBody pt="4">
							{isLoadingChart ? (
								<Flex h="540px" align="center" justify="center"><Spinner color="brand.500" /></Flex>
							) : (
								<UsCandlestickChart data={chartData} height={540} />
							)}
						</CardBody>
					</Card>
				</GridItem>

				<GridItem minW="0">
					<Card position={{ "2xl": "sticky" }} top={{ "2xl": "102px" }} borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73, 52, 30, 0.05)">
						<CardHeader pb="3" borderBottomWidth="1px" borderColor="app.borderSoft">
							<Flex align="center">
								<Box>
									<Heading size="md">주문</Heading>
									<Text mt="1" fontSize="11px" color="app.subtleText">{quote?.name ?? "종목"} 매수·매도</Text>
								</Box>
								<Spacer />
								<Badge colorScheme={marketStatus?.isOpen ? "green" : "orange"} borderRadius="full">
									{marketStatus?.isOpen ? "장 운영 중" : "장 마감"}
								</Badge>
							</Flex>
						</CardHeader>
						<CardBody>
							<SimpleGrid columns={3} spacing="0" mb="4" borderWidth="1px" borderColor="app.borderSoft" borderRadius="8px" overflow="hidden">
								{([[
									"BUY", "매수",
								], ["SELL", "매도"], ["MANAGE", "정정/취소"]] as const).map(([mode, label]) => {
									const active = orderPanelMode === mode;
									const activeColor = mode === "BUY" ? "#F26438" : mode === "SELL" ? "#4679C8" : "#3C352E";
									return (
										<Button
											key={mode}
											h="38px"
											borderRadius="0"
											borderRightWidth={mode === "MANAGE" ? "0" : "1px"}
											borderColor="app.borderSoft"
											bg={active ? activeColor : "white"}
											color={active ? "white" : "app.text"}
											fontSize="12px"
											onClick={() => setOrderPanelMode(mode)}
										>
											{label}
										</Button>
									);
								})}
							</SimpleGrid>

							{orderPanelMode === "MANAGE" ? (
								<Box>
									<Flex align="center" mb="3">
										<Text fontSize="12px" fontWeight="900">현재 종목 미체결 주문</Text>
										<Spacer />
										<Button size="xs" variant="ghost" onClick={() => void checkPending()}>새로고침</Button>
									</Flex>
									<Stack spacing="2" maxH="430px" overflowY="auto">
										{pendingOrders.map((order) => (
											<Box key={order._id} p="3" borderWidth="1px" borderColor="app.borderSoft" borderRadius="9px" bg="#FFFCF8">
												<Flex align="center" gap="2">
													<Badge colorScheme={order.side === "BUY" ? "red" : "blue"}>{sideLabel[order.side]}</Badge>
													<Text fontSize="11px" color="app.subtleText">지정가</Text>
													<Spacer />
													<Text fontSize="11px" color="app.subtleText">{formatDateTime(order.createdAt)}</Text>
												</Flex>
												<Flex mt="2" justify="space-between" fontSize="12px">
													<Text>{numberFormat.format(order.quantity)}주</Text>
													<Text fontWeight="900">{usd.format(Number(order.limitPrice ?? order.orderPrice ?? 0))}</Text>
												</Flex>
												<SimpleGrid mt="3" columns={2} spacing="2">
													<Button size="xs" variant="outline" onClick={() => prepareUsOrderCorrection(order)}>정정</Button>
													<Button size="xs" colorScheme="red" variant="outline" onClick={() => void cancelOrder(order._id)}>취소</Button>
												</SimpleGrid>
											</Box>
										))}
										{pendingOrders.length === 0 && (
											<Flex minH="180px" align="center" justify="center" borderWidth="1px" borderColor="app.borderSoft" borderRadius="9px">
												<Text fontSize="12px" color="app.subtleText">미체결 주문이 없습니다.</Text>
											</Flex>
										)}
									</Stack>
								</Box>
							) : (
								<>
									<SimpleGrid columns={2} spacing="3" mb="4">
										<Box p="3" borderRadius="10px" bg="#FAF7F2">
											<Text fontSize="10px" color="app.subtleText">주문 가능 금액</Text>
											<Text mt="1" fontSize="14px" fontWeight="900">{usd.format(account?.availableCash ?? 0)}</Text>
										</Box>
										<Box p="3" borderRadius="10px" bg="#FAF7F2">
											<Text fontSize="10px" color="app.subtleText">보유수량</Text>
											<Text mt="1" fontSize="14px" fontWeight="900">{numberFormat.format(selectedHolding?.quantity ?? 0)}주</Text>
										</Box>
									</SimpleGrid>

									<SimpleGrid columns={2} spacing="2" mb="4">
										<Button h="38px" bg={orderType === "MARKET" ? "#3C352E" : "white"} color={orderType === "MARKET" ? "white" : "app.text"} borderWidth="1px" borderColor="app.borderSoft" onClick={() => setOrderType("MARKET")} isDisabled={isMarketClosed}>시장가</Button>
										<Button h="38px" bg={orderType === "LIMIT" ? "#3C352E" : "white"} color={orderType === "LIMIT" ? "white" : "app.text"} borderWidth="1px" borderColor="app.borderSoft" onClick={() => { setOrderType("LIMIT"); if (limitPrice <= 0 && quote?.price) setLimitPrice(quote.price); }}>지정가</Button>
									</SimpleGrid>

									<Box mb="3">
										<Text mb="1.5" fontSize="11px" fontWeight="800">주문 가격</Text>
										<Grid templateColumns="42px minmax(0, 1fr) 42px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="8px" overflow="hidden">
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderRightWidth="1px" borderColor="app.borderSoft" isDisabled={orderType === "MARKET" || !quote} onClick={() => setLimitPrice((price) => Math.max(0.01, Number(((price || quote?.price || 0) - 0.01).toFixed(2))))}>−</Button>
											<NumberInput value={orderType === "MARKET" ? quote?.price ?? 0 : limitPrice} min={0.01} step={0.01} precision={2} onChange={(_, value) => orderType === "LIMIT" && setLimitPrice(Number.isNaN(value) ? 0 : value)} isReadOnly={orderType === "MARKET"} isDisabled={!quote}>
												<NumberInputField h="42px" border="0" borderRadius="0" textAlign="center" fontWeight="900" px="4px" />
											</NumberInput>
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderLeftWidth="1px" borderColor="app.borderSoft" isDisabled={orderType === "MARKET" || !quote} onClick={() => setLimitPrice((price) => Number(((price || quote?.price || 0) + 0.01).toFixed(2)))}>＋</Button>
										</Grid>
										<Flex mt="1.5" align="center">
											<Text fontSize="10px" color="app.subtleText">가격 단위 $0.01</Text>
											<Spacer />
											<Button size="xs" variant="ghost" color="brand.600" onClick={() => quote?.price && setLimitPrice(quote.price)} isDisabled={!quote || orderType === "MARKET"}>현재가</Button>
										</Flex>
									</Box>

									<Box>
										<Text mb="1.5" fontSize="11px" fontWeight="800">주문 수량</Text>
										<Grid templateColumns="42px minmax(0, 1fr) 42px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="8px" overflow="hidden">
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderRightWidth="1px" borderColor="app.borderSoft" onClick={() => setQuantity((value) => Math.max(1, value - 1))} isDisabled={!quote}>−</Button>
											<NumberInput value={quantity} min={1} onChange={(_, value) => setQuantity(Number.isNaN(value) ? 1 : Math.max(1, Math.floor(value)))} isDisabled={!quote}>
												<NumberInputField h="42px" border="0" borderRadius="0" textAlign="center" fontWeight="900" px="4px" />
											</NumberInput>
											<Button h="42px" minW="0" borderRadius="0" variant="ghost" borderLeftWidth="1px" borderColor="app.borderSoft" onClick={() => setQuantity((value) => value + 1)} isDisabled={!quote}>＋</Button>
										</Grid>
										<SimpleGrid columns={4} spacing="2" mt="2">
											{[10, 50, 100].map((value) => <Button key={value} size="xs" variant="outline" borderColor="app.borderSoft" onClick={() => setQuantity(value)}>{value}</Button>)}
											<Button size="xs" variant="outline" borderColor="app.borderSoft" onClick={() => setQuantity(maximumQuantity)}>최대</Button>
										</SimpleGrid>
									</Box>

									<Flex mt="4" justify="space-between" align="center">
										<Text fontSize="11px" color="app.subtleText">예상 총 금액</Text>
										<Text fontWeight="900">{usd.format(effectivePrice * quantity)}</Text>
									</Flex>

									<Button
										mt="5"
										w="100%"
										h="50px"
										bg={orderPanelMode === "BUY" ? "#F26438" : "#4679C8"}
										color="white"
										onClick={() => void submitOrder(orderPanelMode)}
										isLoading={isSubmitting}
										isDisabled={!quote || isMarketOrderBlocked}
									>
										{orderType === "LIMIT" && isMarketClosed ? "예약 " : ""}
										{orderPanelMode === "BUY" ? "매수 주문하기" : "매도 주문하기"}
									</Button>

									<Divider my="4" />
									<Flex gap="2">
										<Button size="xs" variant="outline" onClick={() => void checkPending()}>미체결 확인</Button>
										<Button size="xs" variant="outline" onClick={() => void topUpAccount()} isLoading={isToppingUp}>$1,000 충전</Button>
									</Flex>
								</>
							)}
						</CardBody>
					</Card>
				</GridItem>
			</Grid>

			<Grid mt="5" templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap="5">
				<UsDetailSelectorCard title="호가" description="미국 종목 매도·매수 잔량" selected={detailSection === "orderbook"} onClick={() => { setDetailSection("orderbook"); void loadUsOrderBook(selectedSymbol, selectedExchange); }}>
					<Stack spacing="7px">
						{(usOrderBook?.levels ?? []).slice(0, 4).map((level) => (
							<Grid key={level.level} templateColumns="1fr 1fr 1fr" gap="2">
								<Text fontSize="10px" color="#F05B45">{level.askPrice ? usd.format(level.askPrice) : "-"}</Text>
								<Text textAlign="center" fontSize="10px" fontWeight="800">{numberFormat.format(level.askVolume + level.bidVolume)}</Text>
								<Text textAlign="right" fontSize="10px" color="#2F67D8">{level.bidPrice ? usd.format(level.bidPrice) : "-"}</Text>
							</Grid>
						))}
					</Stack>
					{(usOrderBook?.levels?.length ?? 0) === 0 && <Text mt="12px" fontSize="10px" color="app.subtleText">호가 데이터 없음</Text>}
				</UsDetailSelectorCard>

				<UsDetailSelectorCard title="체결" description="미국 종목 실시간 시장 체결" selected={detailSection === "executions"} onClick={() => { setDetailSection("executions"); void loadUsExecutions(selectedSymbol, selectedExchange); }}>
					<Grid templateColumns="1fr 1fr 1fr" gap="2" mb="8px">
						<Text fontSize="10px" color="app.subtleText">시간</Text>
						<Text textAlign="center" fontSize="10px" color="app.subtleText">체결가</Text>
						<Text textAlign="right" fontSize="10px" color="app.subtleText">수량</Text>
					</Grid>
					{(usExecutions?.items ?? []).slice(0, 4).map((item, index) => (
						<Grid key={`${item.time}-${index}`} templateColumns="1fr 1fr 1fr" gap="2" py="4px">
							<Text fontSize="10px" color="app.subtleText">{item.time}</Text>
							<Text textAlign="center" fontSize="10px" fontWeight="800" color={item.direction === "UP" ? "#F05B45" : item.direction === "DOWN" ? "#2F67D8" : "app.text"}>{usd.format(item.price)}</Text>
							<Text textAlign="right" fontSize="10px" color="app.subtleText">{numberFormat.format(item.quantity)}</Text>
						</Grid>
					))}
					{(usExecutions?.items?.length ?? 0) === 0 && <Text mt="8px" fontSize="10px" color="app.subtleText">체결 데이터 없음</Text>}
				</UsDetailSelectorCard>

				<UsDetailSelectorCard title="정보" description="기업·ETF 핵심 정보" selected={detailSection === "information"} onClick={() => setDetailSection("information")}>
					<Stack spacing="0">
						{[
							["종목", quote?.name ?? "-"],
							["시장", quote?.market ?? "-"],
							["PER", formatRatio(quote?.per)],
							["PBR", formatRatio(quote?.pbr)],
						].map(([label, value], index) => (
							<Flex key={label} py="7px" borderBottomWidth={index === 3 ? "0" : "1px"} borderColor="#F1E8DE">
								<Text fontSize="11px" color="app.subtleText">{label}</Text>
								<Spacer />
								<Text fontSize="11px" fontWeight="800">{value}</Text>
							</Flex>
						))}
					</Stack>
				</UsDetailSelectorCard>
			</Grid>

			<Card mt="5" borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73, 52, 30, 0.04)">
				<CardHeader pb="3">
					<Flex align="center" w="100%">
						<Box>
						<Heading size="sm">
							{detailSection === "orderbook" ? "호가 · 수급 현황" : detailSection === "executions" ? "실시간 체결" : "종목 상세 정보"}
						</Heading>
						<Text mt="1" fontSize="11px" color="app.subtleText">
							{detailSection === "information" ? "현재 종목의 기업 정보와 재무지표를 확인합니다." : detailSection === "orderbook" ? "KIS 해외주식 현재가 1호가를 표시합니다." : "KIS 해외주식 체결추이를 10초 간격으로 갱신합니다."}
						</Text>
						</Box>
						<Spacer />
						{detailSection !== "information" && (
							<Button size="xs" variant="outline" onClick={() => detailSection === "orderbook" ? void loadUsOrderBook(selectedSymbol, selectedExchange) : void loadUsExecutions(selectedSymbol, selectedExchange)} isLoading={detailSection === "orderbook" ? isLoadingUsOrderBook : isLoadingUsExecutions}>새로고침</Button>
						)}
					</Flex>
				</CardHeader>
				<CardBody pt="0">
					{detailSection === "orderbook" && <UsOrderBookPanel data={usOrderBook} isLoading={isLoadingUsOrderBook} />}
					{detailSection === "executions" && <UsExecutionPanel data={usExecutions} isLoading={isLoadingUsExecutions} />}
					{detailSection === "information" && <UsStockDetailPanel quote={quote} isLoading={isLoadingQuote} />}
				</CardBody>
			</Card>
		</Box>
	);

}
