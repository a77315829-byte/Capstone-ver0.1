import { KrwEquivalent } from "./FxExchange";
import {
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSearchParams } from "react-router-dom";

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
	NumberInput,
	NumberInputField,
	SimpleGrid,
	Spacer,
	Spinner,
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


import api from "../services/api.service";
import UsMarketDetails from "./UsMarketDetails";
import UsStockChart from "./UsStockChart";
import MarketSimulatorPanel from "./MarketSimulatorPanel";

import RelatedFinancialTerms from "../components/RelatedFinancialTerms";

import type {
	UsChartPoint,
	UsExchangeCode,
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
	| "1min" | "5min" | "15min" | "1h" | "4h"
	| "1m"
	| "6m"
	| "1y";

const chartOptions = [
  ['1분', '1min'], ['5분', '5min'], ['15분', '15min'], ['1시간', '1h'], ['4시간', '4h'],
  ['1일', '1m'], ['6개월', '6m'], ['1년', '1y'],
] as const;
const isIntradayPeriod = (period: UsChartPeriod) => ['1min', '5min', '15min', '1h', '4h'].includes(period);

type UsOrderPanelMode =
	| "BUY"
	| "SELL"
	| "MANAGE";

type UsDetailSection = "holdings" | "orders" | null;

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
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedSymbol = searchParams.get("symbol")?.trim().toUpperCase() || "NVDA";
	const selectedSymbol = /^[A-Z][A-Z0-9.-]{0,11}$/.test(requestedSymbol) ? requestedSymbol : "NVDA";
	const requestedExchange = searchParams.get("exchange")?.toUpperCase();
	const selectedExchange: UsExchangeCode = requestedExchange === "NYS" || requestedExchange === "AMS" ? requestedExchange : "NAS";

    const [isMarketSimulatorOpen, setIsMarketSimulatorOpen] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);
    const chartRequest = useRef<AbortController | null>(null);

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
			null,
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
			signal?: AbortSignal,
		) => {
			try {
				setIsLoadingQuote(
					true,
				);

				const response =
					await api.get(
						`/us-stocks/${exchange}/${symbol}/info`,
						{ signal, timeout: 20000 },
					);

				const data =
					unwrapApiData<UsStockQuote>(
						response.data,
					);

				if (signal?.aborted) return null;
				setQuote(data);

				setLimitPrice(
					Number(
						data.price.toFixed(
							2,
						),
					),
				);

				return data;
			} catch (error: any) {
				if (signal?.aborted) return null;
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
				if (!signal?.aborted) setIsLoadingQuote(
					false,
				);
			}
		};

    useEffect(() => {
        const controller = new AbortController();
        setQuote(null);
        setLimitPrice(0);
        void loadQuote(selectedSymbol, selectedExchange, controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSymbol, selectedExchange]);

    const loadChart = async (symbol = selectedSymbol, exchange = selectedExchange, period = chartPeriod, refresh = false) => {
        chartRequest.current?.abort();
        const controller = new AbortController();
        chartRequest.current = controller;
        if (!refresh) { setIsLoadingChart(true); setChartData([]); }
        setChartError(null);
        try {
            const response = await api.get(`/us-stocks/${exchange}/${symbol}/historical`, {
                params: { period }, signal: controller.signal, timeout: 20000,
            });
            if (!controller.signal.aborted) setChartData(unwrapApiData<UsChartPoint[]>(response.data));
        } catch (error: any) {
            if (!controller.signal.aborted) setChartError(error?.response?.data?.message || '차트를 불러오지 못했습니다. 다시 시도해 주세요.');
        } finally {
            if (!controller.signal.aborted) setIsLoadingChart(false);
              if (chartRequest.current === controller) chartRequest.current = null;
        }
    };

    useEffect(() => {
        void loadChart(selectedSymbol, selectedExchange, chartPeriod);
        const timer = window.setInterval(() => {
            if (!document.hidden && !chartRequest.current && isIntradayPeriod(chartPeriod)) void loadChart(selectedSymbol, selectedExchange, chartPeriod, true);
        }, 10000);
        return () => { window.clearInterval(timer); chartRequest.current?.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSymbol, selectedExchange, chartPeriod]);

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

	const selectStock = (item: UsSearchResult) => {
        setSearchParams({ market: "US", symbol: item.symbol, name: item.name,
            stockMarket: item.market, exchange: item.exchange });
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
							? "정규장·프리마켓·애프터마켓에서 최신 시세가 지정가 조건을 충족하면 자동 체결됩니다. 시세 미확인 시 대기합니다."
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
							: "현재 미국 거래시간이 아닙니다.",
					description:
						result.marketOpen
							? `${result.filledCount}건 체결, ${result.pendingCount}건 대기 중`
							: "예약 지정가는 다음 거래시간에 자동 확인됩니다.",
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
        const refresh = () => { void loadTradingData(true); };
        window.addEventListener('antitude:fx-converted', refresh);
        return () => window.removeEventListener('antitude:fx-converted', refresh);
    }, []);

	useEffect(() => {
		void Promise.all([
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
                <Button size="sm" h="36px" px="16px" variant="outline" borderColor="brand.500" color="brand.600" bg="white" fontWeight="900"
                    _hover={{ bg: 'orange.50' }} isDisabled={!quote || quote.symbol !== selectedSymbol}
                    onClick={() => setIsMarketSimulatorOpen(true)}>시장 반응 시뮬레이터 ›</Button>
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
<KrwEquivalent usd={quote.price} />

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
										"repeat(4, 104px)",
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
									xl: "300px",
								}}
							>
								{[
									{
										label:
											"시가",
										value:
											formatUsdOrDash(
												quote.open,
											),
										color:
											"app.text",
									},
									{
										label:
											"고가",
										value:
											formatUsdOrDash(
												quote.high,
											),
										color:
											"#F05B45",
									},
									{
										label:
											"저가",
										value:
											formatUsdOrDash(
												quote.low,
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
                            <Flex align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} gap="4">
                                <Box>
                                    <HStack><Heading size="md">차트</Heading><Badge colorScheme={chartError ? 'orange' : 'gray'}>{isIntradayPeriod(chartPeriod) ? '분봉 · 10초 갱신' : chartPeriod === '1y' ? '주봉' : '일봉'}</Badge></HStack>
                                    <Text mt="1" fontSize="11px" color="app.subtleText">현재 선택: {chartOptions.find(([, period]) => period === chartPeriod)?.[0]}</Text>
                                </Box>
                                <Spacer />
                                <HStack spacing="2" wrap="wrap">
                                    {chartOptions.map(([label, period]) => <Button key={period} size="sm" h="32px" px="3" fontSize="11px" fontWeight="800" variant="outline"
                                        aria-pressed={chartPeriod === period} isDisabled={isLoadingChart}
                                        borderColor={chartPeriod === period ? 'brand.500' : 'app.borderSoft'} bg={chartPeriod === period ? 'orange.50' : 'white'} color={chartPeriod === period ? 'brand.600' : 'app.subtleText'}
                                        onClick={() => setChartPeriod(period)}>{label}</Button>)}
                                </HStack>
                            </Flex>
                        </CardHeader>
                        <CardBody pt="4">
                            {isLoadingChart ? <Flex h="540px" align="center" justify="center"><Spinner color="brand.500" /></Flex> :
                                <UsStockChart data={chartData} intraday={isIntradayPeriod(chartPeriod)} resetKey={`${selectedExchange}:${selectedSymbol}:${chartPeriod}`} />}
                            <HStack mt="2" justify="space-between" minH="24px">
                                <Text fontSize="xs" color={chartError ? 'orange.600' : 'app.subtleText'}>
                                    {chartError || (isIntradayPeriod(chartPeriod) ? '미국 동부시간 · 최근 최대 120개 봉 · 10초 간격 갱신' : chartPeriod === '1y' ? '최근 1년 주봉 · 가격 단위 USD' : '일봉 · 가격 단위 USD')}
                                </Text>
                                <Button size="xs" variant="ghost" isLoading={isLoadingChart} onClick={() => void loadChart()}>새로고침</Button>
                            </HStack>
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
									{marketStatus?.sessionLabel?.replace(' · 지정가', '') ?? '장 마감'}
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
<KrwEquivalent usd={account?.availableCash} />
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
<Box textAlign="right"><KrwEquivalent usd={currentOrderPrice * quantity} /></Box>

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
									!marketStatus?.limitOrderAllowed && !marketStatus?.orderAllowedByOverride
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

            <UsMarketDetails
                key={`${selectedExchange}:${selectedSymbol}`}
                symbol={selectedSymbol}
                exchange={selectedExchange}
                quote={quote?.symbol === selectedSymbol && quote.exchange === selectedExchange ? quote : null}
                history={chartData}
                intraday={isIntradayPeriod(chartPeriod)}
                chartLabel={chartOptions.find(([, period]) => period === chartPeriod)?.[0]}
            />

            <Flex mt="5" align="center" gap="3" wrap="wrap">
                <Heading size="sm">미국 모의계좌</Heading>
                <Spacer />
                <HStack spacing="2">
                    {([['holdings', '보유 종목'], ['orders', '주문 내역']] as const).map(([value, label]) => (
                        <Button key={value} size="sm" variant="outline" aria-pressed={detailSection === value}
                            bg={detailSection === value ? 'orange.50' : 'white'}
                            borderColor={detailSection === value ? 'brand.500' : 'app.borderSoft'}
                            color={detailSection === value ? 'brand.600' : 'app.text'}
                            onClick={() => setDetailSection(current => current === value ? null : value)}>
                            {label}
                        </Button>
                    ))}
                </HStack>
            </Flex>
            {detailSection && (

			<Card
				mt="5"
				borderColor="app.borderSoft"
				boxShadow="0 8px 24px rgba(73, 52, 30, 0.04)"
			>
				<CardHeader pb="3">
					<Flex align="center">
						<Box>
							<Heading size="sm">
								{detailSection === "holdings" ? "보유 종목" : "주문 / 체결 내역"}
							</Heading>
							<Text
								mt="1"
								fontSize="11px"
								color="app.subtleText"
							>
								{detailSection === "holdings" ? "미국 모의계좌의 평가 현황을 확인합니다." : "미국 주식 주문 상태와 체결 결과를 확인합니다."}
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
										as="button" type="button" w="100%" textAlign="left"
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
<KrwEquivalent usd={holding.profitLoss} signed />
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

            )}

            <MarketSimulatorPanel key={`${selectedExchange}:${selectedSymbol}`} stock={quote?.symbol === selectedSymbol ? quote : null}
                marketType="US" isOpen={isMarketSimulatorOpen} onClose={() => setIsMarketSimulatorOpen(false)} showTrigger={false} />

		</Box>
	);
}
