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
	Heading,
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

import api from "../../services/api.service";

import type {
	UsHolding,
	UsPortfolio,
	UsTradeOrder,
} from "../../types/usMarket.types";

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

	return Number.isNaN(
		date.getTime(),
	)
		? value
		: date.toLocaleString(
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

export default function UsPortfolioMyPageSection() {
	const toast = useToast();
	const navigate =
		useNavigate();

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
		isLoading,
		setIsLoading,
	] = useState(false);

	const loadData =
		useCallback(async () => {
			try {
				setIsLoading(true);

				const [
					portfolioResponse,
					ordersResponse,
				] =
					await Promise.all([
						api.get(
							"/us-trading/portfolio?evaluate=true",
						),
						api.get(
							"/us-trading/orders?limit=30",
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
						ordersResponse.data,
					),
				);
			} catch (error: any) {
				console.error(
					"미국 포트폴리오 조회 실패:",
					error,
				);

				if (
					error?.response
						?.status !== 401
				) {
					toast({
						title:
							"미국 모의투자 자산을 불러오지 못했습니다.",
						description:
							error?.response
								?.data
								?.message ??
							"미국 거래 API 연결을 확인하세요.",
						status: "error",
						isClosable: true,
					});
				}
			} finally {
				setIsLoading(false);
			}
		}, [toast]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const account =
		portfolio?.account;

	const holdings =
		portfolio?.holdings ??
		[];

	const recentOrders =
		useMemo(
			() =>
				[...orders]
					.sort(
						(a, b) =>
							new Date(
								b.createdAt,
							).getTime() -
							new Date(
								a.createdAt,
							).getTime(),
					)
					.slice(0, 10),
			[orders],
		);

	return (
		<Box mt="8">
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
				mb="4"
			>
				<Box>
					<Heading size="md">
						미국 모의투자 자산
					</Heading>

					<Text
						mt="1"
						fontSize="sm"
						color="gray.500"
					>
						원화 자산과 합산하지 않고 USD 기준으로 별도 표시합니다.
					</Text>
				</Box>

				<Spacer />

				<Flex gap="2">
					<Button
						size="sm"
						leftIcon={
							<RepeatIcon />
						}
						variant="outline"
						onClick={() =>
							void loadData()
						}
						isLoading={
							isLoading
						}
					>
						갱신
					</Button>

					<Button
						size="sm"
						colorScheme="blue"
						onClick={() =>
							navigate(
								"/exchange?market=US",
							)
						}
					>
						미국 주식 거래
					</Button>
				</Flex>
			</Flex>

			{isLoading &&
			!portfolio ? (
				<Stack spacing="4">
					<Skeleton h="120px" />
					<Skeleton h="240px" />
				</Stack>
			) : (
				<>
					<SimpleGrid
						columns={{
							base: 1,
							md: 2,
							xl: 4,
						}}
						spacing="4"
						mb="5"
					>
						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										미국 총자산
									</StatLabel>
									<StatNumber>
										{usd.format(
											account?.totalAsset ??
												account?.cash ??
												0,
										)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										USD 현금
									</StatLabel>
									<StatNumber>
										{usd.format(
											account?.cash ??
												0,
										)}
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
										{usd.format(
											account?.totalEvaluationAmount ??
												0,
										)}
									</StatNumber>
								</Stat>
							</CardBody>
						</Card>

						<Card>
							<CardBody>
								<Stat>
									<StatLabel>
										평가손익
									</StatLabel>
									<StatNumber
										color={
											Number(
												account?.totalProfitLoss ??
													0,
											) >= 0
												? "red.500"
												: "blue.500"
										}
									>
										{usd.format(
											account?.totalProfitLoss ??
												0,
										)}
									</StatNumber>

									<Text
										mt="1"
										fontSize="sm"
										fontWeight="800"
										color={
											Number(
												account?.totalProfitLossRate ??
													0,
											) >= 0
												? "red.500"
												: "blue.500"
										}
									>
										{Number(
											account?.totalProfitLossRate ??
												0,
										) > 0
											? "+"
											: ""}
										{Number(
											account?.totalProfitLossRate ??
												0,
										).toFixed(
											2,
										)}
										%
									</Text>
								</Stat>
							</CardBody>
						</Card>
					</SimpleGrid>

					<Card mb="5">
						<CardHeader pb="0">
							<Heading size="md">
								미국 보유 종목
							</Heading>
						</CardHeader>

						<CardBody>
							<TableContainer>
								<Table size="sm">
									<Thead>
										<Tr>
											<Th>
												종목
											</Th>
											<Th isNumeric>
												수량
											</Th>
											<Th isNumeric>
												평균단가
											</Th>
											<Th isNumeric>
												현재가
											</Th>
											<Th isNumeric>
												평가금액
											</Th>
											<Th isNumeric>
												평가손익
											</Th>
											<Th isNumeric>
												수익률
											</Th>
										</Tr>
									</Thead>

									<Tbody>
										{holdings.map(
											(
												holding:
													UsHolding,
											) => (
												<Tr
													key={`${holding.exchange}-${holding.symbol}`}
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

													<Td isNumeric>
														{numberFormat.format(
															holding.quantity,
														)}
													</Td>

													<Td isNumeric>
														{usd.format(
															holding.avgPrice,
														)}
													</Td>

													<Td isNumeric>
														{usd.format(
															holding.currentPrice,
														)}
													</Td>

													<Td isNumeric>
														{usd.format(
															holding.evaluationAmount,
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
														{usd.format(
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
													py="10"
													color="gray.500"
												>
													미국 보유 종목이 없습니다.
												</Td>
											</Tr>
										)}
									</Tbody>
								</Table>
							</TableContainer>
						</CardBody>
					</Card>

					<Card>
						<CardHeader pb="0">
							<Flex align="center">
								<Heading size="md">
									미국 주문 기록
								</Heading>

								<Spacer />

								<Badge colorScheme="gray">
									최근{" "}
									{recentOrders.length}
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
											<Th isNumeric>
												수량
											</Th>
											<Th isNumeric>
												가격
											</Th>
											<Th>
												일시
											</Th>
										</Tr>
									</Thead>

									<Tbody>
										{recentOrders.map(
											(order) => {
												const displayPrice =
													Number(
														order.executedPrice ??
															order.limitPrice ??
															order.orderPrice ??
															0,
													);

												return (
													<Tr
														key={
															order._id
														}
													>
														<Td>
															<Badge
																colorScheme={
																	order.side ===
																	"BUY"
																		? "red"
																		: "blue"
																}
															>
																{order.side ===
																"BUY"
																	? "매수"
																	: "매도"}
															</Badge>
														</Td>

														<Td>
															<Badge
																colorScheme={
																	order.status ===
																	"FILLED"
																		? "green"
																		: order.status ===
																			  "PENDING"
																			? "orange"
																			: order.status ===
																				  "CANCELED"
																				? "gray"
																				: "red"
																}
															>
																{order.status ===
																"FILLED"
																	? "체결"
																	: order.status ===
																		  "PENDING"
																		? "미체결"
																		: order.status ===
																			  "CANCELED"
																			? "취소"
																			: "거절"}
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

														<Td isNumeric>
															{numberFormat.format(
																order.quantity,
															)}
														</Td>

														<Td isNumeric>
															{usd.format(
																displayPrice,
															)}
														</Td>

														<Td
															fontSize="xs"
															color="gray.500"
															whiteSpace="nowrap"
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

										{recentOrders.length ===
											0 && (
											<Tr>
												<Td
													colSpan={
														7
													}
													textAlign="center"
													py="10"
													color="gray.500"
												>
													미국 주문 기록이 없습니다.
												</Td>
											</Tr>
										)}
									</Tbody>
								</Table>
							</TableContainer>
						</CardBody>
					</Card>
				</>
			)}
		</Box>
	);
}
