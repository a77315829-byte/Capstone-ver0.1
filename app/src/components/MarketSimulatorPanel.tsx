import React, { useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	CloseButton,
	Flex,
	Grid,
	GridItem,
	Heading,
	Modal,
	ModalBody,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Portal,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
	Textarea,
	useDisclosure,
	useToast,
	Wrap,
	WrapItem,
} from "@chakra-ui/react";
import api from "../services/api.service";

type StockLike = {
	symbol: string;
	name: string;
	price: number;
	changeRate: number;
	volume?: number;
};

type InputTypeHint =
	| "real_news"
	| "company_information"
	| "industry_information"
	| "hypothetical_scenario";

type AgentReaction = {
	agent_type?: string;
	agent_name_ko?: string;
	reaction_direction?: string;
	reaction_direction_ko?: string;
	reaction_strength?: string;
	reaction_strength_ko?: string;
	key_reasons?: string[];
	comment?: string;
	risk_factors?: string[];
};

type SimulationResult = {
	status?: string;
	simulation_id?: string;
	selected_stock?: { code?: string; name?: string };
	input_text?: string;
	input_type?: string;
	impact_analysis?: {
		impact_direction?: string;
		impact_direction_ko?: string;
		impact_strength?: string;
		impact_strength_ko?: string;
		related_industries?: string[];
		time_horizon?: string;
		time_horizon_ko?: string;
		key_keywords?: string[];
	};
	current_stock_context?: {
		code?: string;
		name?: string;
		industry?: string;
		current_price?: number | null;
		daily_change_rate?: number | null;
		volume_trend?: string;
		data_source?: string;
		is_realtime?: boolean;
	};
	market_pressure?: {
		buy?: number;
		sell?: number;
		hold?: number;
		dominant?: string;
		headline?: string;
	};
	market_sentiment?: {
		code?: string;
		label_ko?: string;
		one_liner?: string;
	};
	analysis_confidence?: {
		score?: number;
		grade?: string;
		grade_ko?: string;
		explanation?: string;
	};
	uncertainty_factors?: string[];
	agent_reactions?: AgentReaction[];
	overall_explanation?: string;
	meta?: {
		llm_model?: string;
		llm_status?: string;
		fallback_used?: boolean;
		fallback_modules?: string[];
		stock_data_source?: string;
		db_save_status?: string;
	};
	created_at?: string;
};

type Props = {
	stock: StockLike | null;
};

const inputTypeOptions: { value: InputTypeHint; label: string }[] = [
	{ value: "real_news", label: "뉴스/이벤트" },
	{ value: "company_information", label: "기업 정보" },
	{ value: "industry_information", label: "산업 정보" },
	{ value: "hypothetical_scenario", label: "가정 시나리오" },
];

// _ko 값이 없을 때만 쓰는 fallback 라벨 맵 (Python 이 대부분 _ko 를 제공한다)
const directionKoMap: Record<string, string> = {
	positive: "긍정",
	negative: "부정",
	neutral: "중립",
};
const strengthKoMap: Record<string, string> = {
	low: "낮음",
	medium: "보통",
	high: "높음",
};
const timeHorizonKoMap: Record<string, string> = {
	short_term: "단기",
	mid_term: "중기",
	long_term: "장기",
};
const reactionKoMap: Record<string, string> = {
	buy: "매수 성향",
	sell: "매도 성향",
	hold: "관망",
};
const reactionStrengthKoMap: Record<string, string> = {
	low: "낮음",
	medium: "중간",
	high: "높음",
};
const dominantKoMap: Record<string, string> = {
	buy: "매수 우세",
	sell: "매도 우세",
	hold: "관망 우세",
};
const confidenceKoMap: Record<string, string> = {
	high: "높음",
	medium: "보통",
	low: "낮음",
};

// 시장 분위기 코드 → 게이지 위치(0~100). 부정(좌)↔긍정(우)
const sentimentPosMap: Record<string, number> = {
	very_negative: 8,
	negative: 28,
	uncertain: 50,
	neutral: 50,
	positive: 72,
	very_positive: 92,
};

// 한국식 색상 관례: 매수/긍정=red, 매도/부정=blue, 관망/중립=gray
function toneColor(value?: string): string {
	if (value === "positive" || value === "buy" || value === "very_positive")
		return "red";
	if (value === "negative" || value === "sell" || value === "very_negative")
		return "blue";
	return "gray";
}

const agentOrder = [
	"individual_investor",
	"institutional_investor",
	"foreign_investor",
	"short_term_investor",
	"long_term_investor",
];

const formatNumber = new Intl.NumberFormat("ko-KR");

function SectionCard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}) {
	return (
		<Box bg="white" borderWidth="1px" borderRadius="xl" p="4">
			<Box mb="3">
				<Heading size="sm">{title}</Heading>
				{subtitle && (
					<Text fontSize="sm" color="gray.500" mt="1">
						{subtitle}
					</Text>
				)}
			</Box>
			{children}
		</Box>
	);
}

// 매수/매도/관망 압력 도넛
function PressureDonut({
	buy,
	sell,
	hold,
}: {
	buy: number;
	sell: number;
	hold: number;
}) {
	const total = Math.max(buy + sell + hold, 1);
	const r = 42;
	const c = 2 * Math.PI * r;

	const segments = [
		{ value: buy, color: "#E53E3E" },
		{ value: sell, color: "#3182CE" },
		{ value: hold, color: "#A0AEC0" },
	];

	let offset = 0;

	return (
		<svg width="120" height="120" viewBox="0 0 120 120">
			<g transform="rotate(-90 60 60)">
				<circle cx="60" cy="60" r={r} fill="none" stroke="#EDF2F7" strokeWidth="14" />
				{segments.map((seg, index) => {
					const length = (seg.value / total) * c;
					const dash = `${length} ${c - length}`;
					const circle = (
						<circle
							key={index}
							cx="60"
							cy="60"
							r={r}
							fill="none"
							stroke={seg.color}
							strokeWidth="14"
							strokeDasharray={dash}
							strokeDashoffset={-offset}
						/>
					);
					offset += length;
					return circle;
				})}
			</g>
		</svg>
	);
}

function PressureBarRow({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<Box>
			<Flex justify="space-between" mb="1">
				<Text fontSize="sm" fontWeight="700">
					{label}
				</Text>
				<Text fontSize="sm" fontWeight="700">
					{value}%
				</Text>
			</Flex>
			<Box bg="gray.100" borderRadius="full" h="8px" overflow="hidden">
				<Box
					bg={color}
					h="100%"
					w={`${Math.max(Math.min(value, 100), 0)}%`}
					borderRadius="full"
				/>
			</Box>
		</Box>
	);
}

function AgentReactionCard({ agent }: { agent: AgentReaction }) {
	const direction = agent.reaction_direction ?? "hold";
	const directionKo =
		agent.reaction_direction_ko ?? reactionKoMap[direction] ?? direction;
	const strength = agent.reaction_strength;
	const strengthKo =
		agent.reaction_strength_ko ??
		(strength ? reactionStrengthKoMap[strength] ?? strength : undefined);
	const reasons = agent.key_reasons ?? [];

	return (
		<Box bg="white" borderWidth="1px" borderRadius="xl" p="4">
			<Flex align="center" mb="2">
				<Text fontWeight="800">{agent.agent_name_ko ?? "시장참여자"}</Text>
				<Box flex="1" />
				<Badge colorScheme={toneColor(direction)}>{directionKo}</Badge>
			</Flex>

			{strengthKo && (
				<Text fontSize="sm" color="gray.600" mb="2">
					반응 강도: {strengthKo}
				</Text>
			)}

			{agent.comment && (
				<Text fontSize="sm" color="gray.700" mb={reasons.length ? "2" : "0"}>
					{agent.comment}
				</Text>
			)}

			{reasons.length > 0 && (
				<Stack spacing="1">
					{reasons.slice(0, 3).map((reason, index) => (
						<Text key={index} fontSize="sm" color="gray.600">
							• {reason}
						</Text>
					))}
				</Stack>
			)}
		</Box>
	);
}

function ResultView({ result }: { result: SimulationResult }) {
	const impact = result.impact_analysis;
	const pressure = result.market_pressure;
	const sentiment = result.market_sentiment;
	const confidence = result.analysis_confidence;
	const uncertainty = result.uncertainty_factors ?? [];
	const meta = result.meta;

	const buy = Number(pressure?.buy ?? 0);
	const sell = Number(pressure?.sell ?? 0);
	const hold = Number(pressure?.hold ?? 0);
	const dominant = pressure?.dominant ?? "hold";
	const dominantKo = dominantKoMap[dominant] ?? "관망 우세";

	const sentimentPos =
		sentimentPosMap[sentiment?.code ?? "neutral"] ?? 50;

	const confidenceScore = Number(confidence?.score ?? 0);
	const confidenceGradeKo =
		confidence?.grade_ko ??
		(confidence?.grade ? confidenceKoMap[confidence.grade] : undefined) ??
		"정보 없음";

	const agents = useMemo(() => {
		const list = result.agent_reactions ?? [];
		return [...list].sort(
			(a, b) =>
				agentOrder.indexOf(a.agent_type ?? "") -
				agentOrder.indexOf(b.agent_type ?? ""),
		);
	}, [result.agent_reactions]);

	return (
		<Stack spacing="4">
			{/* 1. 영향 분석 */}
			<SectionCard title="영향 분석" subtitle="입력 이벤트의 예상 영향">
				<SimpleGrid columns={{ base: 2, md: 4 }} spacing="4">
					<Box>
						<Text fontSize="sm" color="gray.500">
							영향 방향
						</Text>
						<Badge colorScheme={toneColor(impact?.impact_direction)} mt="1">
							{impact?.impact_direction_ko ??
								directionKoMap[impact?.impact_direction ?? ""] ??
								"정보 없음"}
						</Badge>
					</Box>
					<Box>
						<Text fontSize="sm" color="gray.500">
							영향 강도
						</Text>
						<Text fontWeight="800" mt="1">
							{impact?.impact_strength_ko ??
								strengthKoMap[impact?.impact_strength ?? ""] ??
								"정보 없음"}
						</Text>
					</Box>
					<Box>
						<Text fontSize="sm" color="gray.500">
							예상 영향 기간
						</Text>
						<Text fontWeight="800" mt="1">
							{impact?.time_horizon_ko ??
								timeHorizonKoMap[impact?.time_horizon ?? ""] ??
								"정보 없음"}
						</Text>
					</Box>
					<Box>
						<Text fontSize="sm" color="gray.500">
							관련 산업
						</Text>
						<Text fontWeight="800" mt="1">
							{impact?.related_industries?.length
								? impact.related_industries.join(", ")
								: "정보 없음"}
						</Text>
					</Box>
				</SimpleGrid>

				<Box mt="4">
					<Text fontSize="sm" color="gray.500" mb="2">
						핵심 키워드
					</Text>
					{impact?.key_keywords?.length ? (
						<Wrap>
							{impact.key_keywords.map((kw, index) => (
								<WrapItem key={index}>
									<Badge colorScheme="purple" px="2" py="1" borderRadius="md">
										{kw}
									</Badge>
								</WrapItem>
							))}
						</Wrap>
					) : (
						<Text fontSize="sm" color="gray.500">
							핵심 키워드가 제한적으로 감지되었습니다.
						</Text>
					)}
				</Box>
			</SectionCard>

			<SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
				{/* 2. 시장 압력 */}
				<SectionCard title="시장 압력" subtitle="매수/매도/관망 성향 분포">
					<Flex align="center" gap="4" wrap="wrap">
						<Box position="relative" w="120px" h="120px">
							<PressureDonut buy={buy} sell={sell} hold={hold} />
							<Box
								position="absolute"
								top="0"
								left="0"
								w="100%"
								h="100%"
								display="flex"
								flexDirection="column"
								alignItems="center"
								justifyContent="center"
							>
								<Text fontSize="xs" color="gray.500">
									우세
								</Text>
								<Text fontWeight="900" color={`${toneColor(dominant)}.500`}>
									{dominantKo}
								</Text>
							</Box>
						</Box>

						<Stack flex="1" minW="160px" spacing="2">
							<PressureBarRow label="매수 압력" value={buy} color="red.400" />
							<PressureBarRow label="매도 압력" value={sell} color="blue.400" />
							<PressureBarRow label="관망 가능성" value={hold} color="gray.400" />
						</Stack>
					</Flex>

					{pressure?.headline && (
						<Text mt="3" fontSize="sm" color="gray.700">
							{pressure.headline}
						</Text>
					)}
				</SectionCard>

				{/* 3. 시장 분위기 */}
				<SectionCard title="시장 분위기" subtitle="시장 반응 성향">
					<Flex align="center" mb="3">
						<Badge colorScheme={toneColor(sentiment?.code)} px="3" py="1" borderRadius="full">
							{sentiment?.label_ko ?? "정보 없음"}
						</Badge>
					</Flex>

					<Box position="relative" h="10px" borderRadius="full" overflow="hidden"
						bgGradient="linear(to-r, blue.300, gray.200, red.300)">
					</Box>
					<Box position="relative" h="0">
						<Box
							position="absolute"
							top="-14px"
							left={`calc(${sentimentPos}% - 6px)`}
							w="12px"
							h="12px"
							borderRadius="full"
							bg="gray.800"
							borderWidth="2px"
							borderColor="white"
						/>
					</Box>
					<Flex justify="space-between" mt="3">
						<Text fontSize="xs" color="blue.500">
							부정적
						</Text>
						<Text fontSize="xs" color="gray.500">
							중립
						</Text>
						<Text fontSize="xs" color="red.500">
							긍정적
						</Text>
					</Flex>

					{sentiment?.one_liner && (
						<Text mt="3" fontSize="sm" color="gray.700">
							{sentiment.one_liner}
						</Text>
					)}
				</SectionCard>
			</SimpleGrid>

			<SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
				{/* 4. 분석 신뢰도 */}
				<SectionCard title="분석 신뢰도">
					<Flex align="center" mb="2">
						<Text fontWeight="800">신뢰도: {confidenceGradeKo}</Text>
						<Box flex="1" />
						<Text fontSize="sm" color="gray.500">
							{(confidenceScore * 100).toFixed(0)}점
						</Text>
					</Flex>
					<Box bg="gray.100" borderRadius="full" h="8px" overflow="hidden">
						<Box
							bg="purple.400"
							h="100%"
							w={`${Math.max(Math.min(confidenceScore * 100, 100), 0)}%`}
							borderRadius="full"
						/>
					</Box>
					{confidence?.explanation && (
						<Text mt="3" fontSize="sm" color="gray.700">
							{confidence.explanation}
						</Text>
					)}
					{meta?.fallback_used && (
						<Text mt="2" fontSize="xs" color="orange.500">
							※ 일부 분석은 fallback 기반으로 생성되었습니다.
						</Text>
					)}
				</SectionCard>

				{/* 5. 주요 불확실성 요소 */}
				<SectionCard title="주요 불확실성 요소">
					{uncertainty.length > 0 ? (
						<Stack spacing="2">
							{uncertainty.map((factor, index) => (
								<Text key={index} fontSize="sm" color="gray.700">
									• {factor}
								</Text>
							))}
						</Stack>
					) : (
						<Text fontSize="sm" color="gray.500">
							뚜렷한 불확실성 요소가 제한적으로 감지되었습니다.
						</Text>
					)}
				</SectionCard>
			</SimpleGrid>

			{/* 6. 시장참여자 반응 */}
			<SectionCard
				title="시장참여자 반응"
				subtitle="참여자 유형별 시장 반응 성향"
			>
				{agents.length > 0 ? (
					<SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">
						{agents.map((agent, index) => (
							<AgentReactionCard
								key={agent.agent_type ?? index}
								agent={agent}
							/>
						))}
					</SimpleGrid>
				) : (
					<Text fontSize="sm" color="gray.500">
						시장참여자 반응 데이터가 없습니다.
					</Text>
				)}
			</SectionCard>

			{/* 7. 종합 해설 */}
			<SectionCard title="종합 해설">
				<Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
					{result.overall_explanation ?? "종합 해설이 제공되지 않았습니다."}
				</Text>
			</SectionCard>

			{result.current_stock_context && (
				<Text fontSize="xs" color="gray.400">
					기준 종목: {result.current_stock_context.name ?? ""}
					{result.current_stock_context.current_price
						? ` · 현재가 ${formatNumber.format(
								result.current_stock_context.current_price,
							)}원`
						: ""}
					{result.current_stock_context.is_realtime
						? " · 실시간"
						: " · 참고 시세"}
				</Text>
			)}
		</Stack>
	);
}

export default function MarketSimulatorPanel({ stock }: Props) {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const toast = useToast();

	const [inputText, setInputText] = useState("");
	const [inputTypeHint, setInputTypeHint] =
		useState<InputTypeHint>("real_news");
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<SimulationResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	// 선택 종목이 없으면 기본값으로 삼성전자(005930) 사용
	const effectiveStock = {
		code: stock?.symbol || "005930",
		name: stock?.name || "삼성전자",
	};

	const runSimulation = async () => {
		if (!inputText.trim()) {
			toast({
				title: "분석할 뉴스/이벤트를 입력하세요.",
				status: "warning",
				isClosable: true,
			});
			return;
		}

		try {
			setIsLoading(true);
			setError(null);
			setResult(null);

			const res = await api.post("/market-reaction/simulate", {
				user_id: "test_user_001",
				selected_stock: effectiveStock,
				input_text: inputText,
				input_type_hint: inputTypeHint,
			});

			const data = res.data as SimulationResult;

			// rejected 가 200 으로 올 수도 있는 경우 방어적으로 처리
			if (data?.status === "rejected") {
				setError(
					(data as any)?.message ||
						"직접적인 투자 추천 요청은 처리할 수 없습니다. 뉴스/이벤트 또는 시장 상황 설명 형태로 입력해주세요.",
				);
				return;
			}

			setResult(data);
		} catch (err: any) {
			const status = err?.response?.status;
			const serverMessage =
				err?.response?.data?.message || err?.response?.data?.error;

			if (status === 422) {
				setError(
					serverMessage ||
						"직접적인 투자 추천 요청은 처리할 수 없습니다. 뉴스/이벤트 또는 시장 상황 설명 형태로 입력해주세요.",
				);
			} else if (status === 503 || status === 502) {
				setError(
					serverMessage ||
						"시장 반응 분석 서비스에 연결하지 못했습니다. 서비스 실행 상태를 확인하세요.",
				);
			} else {
				setError(
					serverMessage ||
						"시뮬레이션 실행 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
				);
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<Portal>
				<Button
					position="fixed"
					right={{ base: "20px", md: "32px" }}
					bottom={{ base: "72px", md: "88px" }}
					zIndex="popover"
					borderRadius="full"
					colorScheme="purple"
					boxShadow="lg"
					onClick={onOpen}
				>
					시장 반응 시뮬레이터
				</Button>
			</Portal>

			<Modal isOpen={isOpen} onClose={onClose} size="6xl">
				<ModalOverlay />
				<ModalContent maxW="1180px" h="86vh">
					<ModalHeader borderBottomWidth="1px">
						<Flex align="center">
							<Box>
								<Heading size="md">시장 반응 시뮬레이터</Heading>
								<Text fontSize="sm" color="gray.500" mt="1">
									입력한 뉴스/이벤트에 대한 시장 반응 성향을 분석합니다.
								</Text>
							</Box>
							<Box flex="1" />
							<CloseButton onClick={onClose} />
						</Flex>
					</ModalHeader>

					<ModalBody overflowY="auto" py="5" bg="gray.50">
						<Grid templateColumns={{ base: "1fr", xl: "360px 1fr" }} gap="5">
							{/* 왼쪽: 입력 영역 */}
							<GridItem>
								<Box bg="white" borderWidth="1px" borderRadius="xl" p="4">
									<Text fontWeight="900" mb="2">
										입력 뉴스/이벤트
									</Text>

									<Text fontSize="sm" color="gray.500" mb="3">
										선택 종목: {effectiveStock.name} ({effectiveStock.code})
									</Text>

									<Textarea
										value={inputText}
										onChange={(e) => setInputText(e.target.value)}
										placeholder="예: AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다."
										rows={9}
										resize="none"
									/>

									<Text fontSize="sm" color="gray.500" mt="4" mb="2">
										입력 유형
									</Text>
									<Wrap>
										{inputTypeOptions.map((option) => (
											<WrapItem key={option.value}>
												<Button
													size="sm"
													variant={
														inputTypeHint === option.value ? "solid" : "outline"
													}
													colorScheme={
														inputTypeHint === option.value ? "purple" : "gray"
													}
													onClick={() => setInputTypeHint(option.value)}
												>
													{option.label}
												</Button>
											</WrapItem>
										))}
									</Wrap>

									<Button
										mt="5"
										w="100%"
										colorScheme="purple"
										onClick={runSimulation}
										isLoading={isLoading}
										loadingText="분석 중..."
									>
										시뮬레이션 실행
									</Button>
								</Box>
							</GridItem>

							{/* 오른쪽: 결과 영역 */}
							<GridItem>
								{isLoading ? (
									<Flex h="500px" align="center" justify="center">
										<Stack align="center">
											<Spinner size="xl" />
											<Text color="gray.500">시장 반응을 분석하고 있습니다...</Text>
										</Stack>
									</Flex>
								) : error ? (
									<Flex h="500px" align="center" justify="center">
										<Box
											bg="white"
											borderWidth="1px"
											borderColor="red.200"
											borderRadius="xl"
											p="6"
											maxW="480px"
											textAlign="center"
										>
											<Heading size="sm" color="red.500" mb="2">
												분석을 진행할 수 없습니다
											</Heading>
											<Text fontSize="sm" color="gray.700">
												{error}
											</Text>
										</Box>
									</Flex>
								) : result ? (
									<ResultView result={result} />
								) : (
									<Flex h="500px" align="center" justify="center" bg="white"
										borderWidth="1px" borderRadius="xl">
										<Text color="gray.500">
											시뮬레이션 실행 후 분석 결과가 표시됩니다.
										</Text>
									</Flex>
								)}
							</GridItem>
						</Grid>
					</ModalBody>
				</ModalContent>
			</Modal>
		</>
	);
}
