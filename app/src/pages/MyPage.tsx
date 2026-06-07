import React, { useMemo, useState } from "react";
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
	Spacer,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from "@chakra-ui/react";

type Holding = {
	symbol: string;
	name: string;
	quantity: number;
	avgPrice: number;
	currentPrice: number;
};

type TradeRecord = {
	id: string;
	type: "BUY" | "SELL";
	symbol: string;
	name: string;
	quantity: number;
	price: number;
	createdAt: string;
};

type ScenarioRecord = {
	id: string;
	scenarioTitle: string;
	chapterTitle: string;
	stepNumber: number;
	action: "BUY" | "SELL" | "HOLD";
	reason: string;
	tags: string[];
	aiFeedback: string;
	createdAt: string;
};

type AiRecord = {
	id: string;
	source: "REALTIME" | "SCENARIO";
	title: string;
	question: string;
	aiDecision: "BUY" | "SELL" | "HOLD";
	summary: string;
	createdAt: string;
};

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ko-KR");

const actionLabel = {
	BUY: "매수",
	SELL: "매도",
	HOLD: "관망",
};

const actionColor = {
	BUY: "red",
	SELL: "blue",
	HOLD: "gray",
};

const MOCK_CASH = 7_250_000;

const MOCK_HOLDINGS: Holding[] = [
	{
		symbol: "005930",
		name: "삼성전자",
		quantity: 4,
		avgPrice: 351500,
		currentPrice: 329000,
	},
	{
		symbol: "000150",
		name: "두산",
		quantity: 1,
		avgPrice: 180000,
		currentPrice: 174000,
	},
	{
		symbol: "005380",
		name: "현대차",
		quantity: 3,
		avgPrice: 70000,
		currentPrice: 73000,
	},
	{
		symbol: "011070",
		name: "LG이노텍",
		quantity: 3,
		avgPrice: 117300,
		currentPrice: 116000,
	},
];

const MOCK_TRADES: TradeRecord[] = [
	{
		id: "trade-1",
		type: "BUY",
		symbol: "005930",
		name: "삼성전자",
		quantity: 2,
		price: 351500,
		createdAt: "2026-06-07 10:12",
	},
	{
		id: "trade-2",
		type: "BUY",
		symbol: "000150",
		name: "두산",
		quantity: 1,
		price: 180000,
		createdAt: "2026-06-07 10:25",
	},
	{
		id: "trade-3",
		type: "SELL",
		symbol: "005930",
		name: "삼성전자",
		quantity: 1,
		price: 340000,
		createdAt: "2026-06-07 11:02",
	},
];

const MOCK_SCENARIO_RECORDS: ScenarioRecord[] = [
	{
		id: "scenario-1",
		scenarioTitle: "코로나 팬데믹 초기 폭락",
		chapterTitle: "떨어질 때의 태도",
		stepNumber: 1,
		action: "HOLD",
		reason: "공포로 급락했지만 추가 정책 대응과 시장 안정 여부를 확인해야 한다고 판단했습니다.",
		tags: ["공포", "변동성", "관망"],
		aiFeedback:
			"공포에 의한 투매보다 리스크를 먼저 확인한 점은 적절합니다. 다만 분할 매수 기준도 함께 세웠다면 더 좋습니다.",
		createdAt: "2026-06-07 12:30",
	},
	{
		id: "scenario-2",
		scenarioTitle: "2차전지 급등장",
		chapterTitle: "오를 때의 태도",
		stepNumber: 2,
		action: "BUY",
		reason: "거래량이 증가했고 섹터 관심이 강해서 단기 상승 가능성이 있다고 봤습니다.",
		tags: ["추격매수", "거래량", "테마"],
		aiFeedback:
			"상승 흐름을 포착한 점은 좋지만, 과열 구간에서 진입 비중을 조절할 필요가 있습니다.",
		createdAt: "2026-06-07 13:05",
	},
];

const MOCK_AI_RECORDS: AiRecord[] = [
	{
		id: "ai-1",
		source: "REALTIME",
		title: "삼성전자",
		question: "AI라면 지금 매수할까?",
		aiDecision: "BUY",
		summary:
			"단기 하락 이후 반등 가능성이 있으나 변동성이 높아 분할 매수가 더 적절합니다.",
		createdAt: "2026-06-07 11:40",
	},
	{
		id: "ai-2",
		source: "REALTIME",
		title: "두산",
		question: "지금 팔아야 할까?",
		aiDecision: "HOLD",
		summary:
			"단기 변동성이 있으나 추세 훼손이 명확하지 않아 추가 확인이 필요합니다.",
		createdAt: "2026-06-07 12:10",
	},
	{
		id: "ai-3",
		source: "SCENARIO",
		title: "코로나 팬데믹 초기 폭락",
		question: "급락장에서 관망이 맞을까?",
		aiDecision: "HOLD",
		summary:
			"시장 공포가 과도하지만 바닥 확인 전까지는 관망 또는 분할 접근이 합리적입니다.",
		createdAt: "2026-06-07 12:35",
	},
];

function getHoldingValue(holding: Holding) {
	return holding.quantity * holding.currentPrice;
}

function getPurchaseAmount(holding: Holding) {
	return holding.quantity * holding.avgPrice;
}

function getProfitLoss(holding: Holding) {
	return getHoldingValue(holding) - getPurchaseAmount(holding);
}

function getProfitRate(holding: Holding) {
	const purchaseAmount = getPurchaseAmount(holding);

	if (purchaseAmount <= 0) return 0;

	return (getProfitLoss(holding) / purchaseAmount) * 100;
}

function DonutChart({
	cash,
	holdings,
}: {
	cash: number;
	holdings: Holding[];
}) {
	const size = 360;
	const strokeWidth = 30;
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
			label: "보유 WON",
			value: cash,
			color: colors[0],
		},
		...holdings.map((holding, index) => ({
			label: holding.name,
			value: getHoldingValue(holding),
			color: colors[(index + 1) % colors.length],
		})),
	].filter((item) => item.value > 0);

	const total = items.reduce((sum, item) => sum + item.value, 0);

	let accumulated = 0;

	if (total <= 0) {
		return (
			<Flex h="260px" align="center" justify="center">
				<Text color="gray.500">포트폴리오 데이터가 없습니다.</Text>
			</Flex>
		);
	}

	return (
		<Flex direction={{ base: "column", md: "row" }} gap="6" align="center">
			<Box position="relative" w={`${size}px`} h={`${size}px`}>
				<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
						const offset = -accumulated * circumference;

						accumulated += ratio;

						return (
							<circle
								key={item.label}
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
					<Text fontWeight="900" fontSize="lg">
						{won.format(total)}
					</Text>
				</Flex>
			</Box>

			<Stack spacing="3" flex="1" w="100%">
				{items.map((item) => {
					const ratio = total > 0 ? (item.value / total) * 100 : 0;

					return (
						<Flex key={item.label} align="center">
							<Box
								w="12px"
								h="12px"
								borderRadius="full"
								bg={item.color}
								mr="2"
							/>
							<Text fontSize="sm" fontWeight="800">
								{item.label}
							</Text>
							<Spacer />
							<Text fontSize="sm" color="gray.500" mr="3">
								{ratio.toFixed(1)}%
							</Text>
							<Text fontSize="sm" fontWeight="900">
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
	const [cash] = useState(MOCK_CASH);
	const [holdings] = useState(MOCK_HOLDINGS);
	const [tradeRecords] = useState(MOCK_TRADES);
	const [scenarioRecords] = useState(MOCK_SCENARIO_RECORDS);
	const [aiRecords] = useState(MOCK_AI_RECORDS);

	const stockValue = useMemo(() => {
		return holdings.reduce((sum, holding) => sum + getHoldingValue(holding), 0);
	}, [holdings]);

	const totalAsset = cash + stockValue;

	const totalPurchaseAmount = useMemo(() => {
		return holdings.reduce(
			(sum, holding) => sum + getPurchaseAmount(holding),
			0,
		);
	}, [holdings]);

	const totalProfitLoss = useMemo(() => {
		return holdings.reduce((sum, holding) => sum + getProfitLoss(holding), 0);
	}, [holdings]);

	const totalProfitRate =
		totalPurchaseAmount > 0
			? (totalProfitLoss / totalPurchaseAmount) * 100
			: 0;

	return (
		<Box px={{ base: 4, md: 8 }} py="6" bg="gray.50" minH="100vh">
			<Flex align="center" mb="6">
				<Box>
					<Heading size="lg">마이페이지</Heading>
					<Text mt="1" color="gray.500">
						보유자산, 포트폴리오, 학습 기록, AI 판단 기록을 확인합니다.
					</Text>
				</Box>

				<Spacer />

				<Button size="sm" variant="outline">
					API 연결 예정
				</Button>
			</Flex>

			<SimpleGrid columns={{ base: 1, md: 4 }} spacing="4" mb="5">
				<Card>
					<CardBody>
						<Stat>
							<StatLabel>총 보유자산</StatLabel>
							<StatNumber>{won.format(totalAsset)}</StatNumber>
						</Stat>
					</CardBody>
				</Card>

				<Card>
					<CardBody>
						<Stat>
							<StatLabel>보유 WON</StatLabel>
							<StatNumber>{won.format(cash)}</StatNumber>
						</Stat>
					</CardBody>
				</Card>

				<Card>
					<CardBody>
						<Stat>
							<StatLabel>주식 평가금액</StatLabel>
							<StatNumber>{won.format(stockValue)}</StatNumber>
						</Stat>
					</CardBody>
				</Card>

				<Card>
					<CardBody>
						<Stat>
							<StatLabel>총 수익률</StatLabel>
							<StatNumber color={totalProfitRate >= 0 ? "red.500" : "blue.500"}>
								{totalProfitRate > 0 ? "+" : ""}
								{totalProfitRate.toFixed(2)}%
							</StatNumber>
						</Stat>
					</CardBody>
				</Card>
			</SimpleGrid>

			<Grid templateColumns={{ base: "1fr", xl: "640px 1fr" }} gap="5" mb="5">
				<GridItem>
					<Card h="100%">
						<CardHeader pb="0">
							<Heading size="md">보유자산 포트폴리오</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								게임머니와 주식 평가금액을 기준으로 자산 비중을 보여줍니다.
							</Text>
						</CardHeader>

						<CardBody>
							<DonutChart cash={cash} holdings={holdings} />
						</CardBody>
					</Card>
				</GridItem>

				<GridItem>
					<Card h="100%">
						<CardHeader pb="0">
							<Heading size="md">보유 종목</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								종목별 평가금액과 수익률을 계산합니다.
							</Text>
						</CardHeader>

						<CardBody overflowX="auto">
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>종목</Th>
										<Th isNumeric>수량</Th>
										<Th isNumeric>평균단가</Th>
										<Th isNumeric>현재가</Th>
										<Th isNumeric>평가금액</Th>
										<Th isNumeric>수익률</Th>
									</Tr>
								</Thead>

								<Tbody>
									{holdings.map((holding) => {
										const evaluationAmount = getHoldingValue(holding);
										const profitRate = getProfitRate(holding);

										return (
											<Tr key={holding.symbol}>
												<Td>
													<Text fontWeight="900">{holding.name}</Text>
													<Text fontSize="xs" color="gray.500">
														{holding.symbol}
													</Text>
												</Td>
												<Td isNumeric>
													{numberFormat.format(holding.quantity)}
												</Td>
												<Td isNumeric>{won.format(holding.avgPrice)}</Td>
												<Td isNumeric>{won.format(holding.currentPrice)}</Td>
												<Td isNumeric>{won.format(evaluationAmount)}</Td>
												<Td
													isNumeric
													fontWeight="900"
													color={profitRate >= 0 ? "red.500" : "blue.500"}
												>
													{profitRate > 0 ? "+" : ""}
													{profitRate.toFixed(2)}%
												</Td>
											</Tr>
										);
									})}
								</Tbody>
							</Table>
						</CardBody>
					</Card>
				</GridItem>
			</Grid>

			<Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="5">
				<GridItem>
					<Card h="100%">
						<CardHeader pb="0">
							<Heading size="md">실시간 모의투자 거래 기록</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								실시간 거래소에서 매수/매도한 기록입니다.
							</Text>
						</CardHeader>

						<CardBody>
							<Stack spacing="3">
								{tradeRecords.map((record) => (
									<Flex
										key={record.id}
										p="3"
										borderWidth="1px"
										borderRadius="lg"
										align="center"
									>
										<Box>
											<HStack mb="1">
												<Badge colorScheme={actionColor[record.type]}>
													{actionLabel[record.type]}
												</Badge>
												<Text fontWeight="900">{record.name}</Text>
											</HStack>
											<Text fontSize="sm" color="gray.500">
												{record.symbol} · {numberFormat.format(record.quantity)}
												주 · {won.format(record.price)}
											</Text>
										</Box>

										<Spacer />

										<Box textAlign="right">
											<Text fontWeight="900">
												{won.format(record.quantity * record.price)}
											</Text>
											<Text fontSize="xs" color="gray.500">
												{record.createdAt}
											</Text>
										</Box>
									</Flex>
								))}
							</Stack>
						</CardBody>
					</Card>
				</GridItem>

				<GridItem>
					<Card h="100%">
						<CardHeader pb="0">
							<Heading size="md">과거 시나리오 학습 기록</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								시나리오에서 제출한 판단, 태그, AI 피드백 기록입니다.
							</Text>
						</CardHeader>

						<CardBody>
							<Stack spacing="3">
								{scenarioRecords.map((record) => (
									<Box key={record.id} p="4" borderWidth="1px" borderRadius="xl">
										<Flex align="center" mb="2">
											<HStack>
												<Badge colorScheme="purple">{record.chapterTitle}</Badge>
												<Badge colorScheme={actionColor[record.action]}>
													{actionLabel[record.action]}
												</Badge>
											</HStack>

											<Spacer />

											<Text fontSize="xs" color="gray.500">
												Step {record.stepNumber}
											</Text>
										</Flex>

										<Text fontWeight="900">{record.scenarioTitle}</Text>

										<Text mt="2" fontSize="sm" color="gray.600">
											{record.reason}
										</Text>

										<HStack mt="2" wrap="wrap">
											{record.tags.map((tag) => (
												<Badge key={tag} colorScheme="gray">
													#{tag}
												</Badge>
											))}
										</HStack>

										<Box mt="3" p="3" bg="gray.50" borderRadius="lg">
											<Text fontSize="sm" fontWeight="900">
												AI 피드백
											</Text>
											<Text mt="1" fontSize="sm" color="gray.600">
												{record.aiFeedback}
											</Text>
										</Box>

										<Text mt="2" fontSize="xs" color="gray.500">
											{record.createdAt}
										</Text>
									</Box>
								))}
							</Stack>
						</CardBody>
					</Card>
				</GridItem>

				<GridItem colSpan={{ base: 1, xl: 2 }}>
					<Card>
						<CardHeader pb="0">
							<Heading size="md">AI라면 질문/판단 기록</Heading>
							<Text mt="1" fontSize="sm" color="gray.500">
								실시간 모의투자와 시나리오에서 확인한 AI 판단 기록입니다.
							</Text>
						</CardHeader>

						<CardBody>
							<SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
								{aiRecords.map((record) => (
									<Box key={record.id} p="4" borderWidth="1px" borderRadius="xl">
										<Flex align="center" mb="2">
											<Badge
												colorScheme={
													record.source === "REALTIME" ? "blue" : "purple"
												}
											>
												{record.source === "REALTIME"
													? "실시간"
													: "시나리오"}
											</Badge>

											<Spacer />

											<Badge colorScheme={actionColor[record.aiDecision]}>
												{actionLabel[record.aiDecision]}
											</Badge>
										</Flex>

										<Text fontWeight="900">{record.title}</Text>

										<Text mt="2" fontSize="sm" color="gray.500">
											Q. {record.question}
										</Text>

										<Text mt="2" fontSize="sm" color="gray.700">
											{record.summary}
										</Text>

										<Text mt="3" fontSize="xs" color="gray.500">
											{record.createdAt}
										</Text>
									</Box>
								))}
							</SimpleGrid>
						</CardBody>
					</Card>
				</GridItem>
			</Grid>
		</Box>
	);
}