import React, { useEffect, useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	Image,
	Progress,
	Select,
	SimpleGrid,
	Skeleton,
	Spacer,
	Stack,
	Text,
	useToast,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import scenarioService from "../services/scenario.service";
import tokens from "../services/tokens.service";



type ScenarioApiItem = {
	scenario_id: string;
	version: number;
	title: string;
	description: string;
	difficulty: string;
	total_turns: number;
	initial_cash: number;
	event_period?: string;
	initial_portfolio_label?: string;
	learning_points: string[];
};

type ScenarioItem = {
	_id: string;
	chapterId: number;
	chapterTitle: string;
	scenarioNo: string;
	scenarioSlug: string;
	title: string;
	eventPeriod: string;
	initialPortfolioLabel: string;
	summary: string;
	difficulty: "쉬움" | "보통" | "어려움";
	estimatedMinutes: number;
	keywords: string[];
	learningPoints: string[];
	status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    completedStepCount: number;
    sessionId?: string | null;
    progressPercent?: number;
};

const unwrapApiData = <T,>(payload: any): T => {
	return payload?.data ?? payload;
};

const statusLabel: Record<ScenarioItem["status"], string> = {
	NOT_STARTED: "미시작",
	IN_PROGRESS: "진행 중",
	COMPLETED: "완료",
};

const statusColor: Record<ScenarioItem["status"], string> = {
	NOT_STARTED: "gray",
	IN_PROGRESS: "orange",
	COMPLETED: "green",
};

const bubblePositions = [
	{ left: "43%", top: "47%", width: 252, height: 252 },
	{ left: "14%", top: "25%", width: 184, height: 184 },
	{ left: "12%", top: "67%", width: 166, height: 166 },
	{ left: "76%", top: "24%", width: 184, height: 184 },
	{ left: "76%", top: "66%", width: 170, height: 170 },
	{ left: "43%", top: "84%", width: 210, height: 128 },
];

function getScenarioYear(eventPeriod: string): string {
	const year = eventPeriod?.match(/(?:19|20)\d{2}/)?.[0];
	return year ?? "과거";
}

function difficultyLevel(difficulty: ScenarioItem["difficulty"]): number {
	if (difficulty === "어려움") return 3;
	if (difficulty === "보통") return 2;
	return 1;
}

function ScenarioBubble({
	scenario,
	index,
	isSelected,
	onSelect,
}: {
	scenario: ScenarioItem;
	index: number;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const position = bubblePositions[index % bubblePositions.length]!;
	const level = difficultyLevel(scenario.difficulty);
	const year = getScenarioYear(scenario.eventPeriod);

	return (
		<Button
			position="absolute"
			left={position.left}
			top={position.top}
			transform="translate(-50%, -50%)"
			w={`${position.width}px`}
			h={`${position.height}px`}
			minW="0"
			p="18px"
			borderRadius="50%"
			whiteSpace="normal"
			bg="transparent"
			borderWidth={isSelected ? "2px" : "1.5px"}
			borderColor={isSelected ? "brand.500" : "#343434"}
			color="app.text"
			boxShadow={isSelected ? "0 8px 24px rgba(246, 107, 36, 0.10)" : "none"}
			_hover={{
				bg: "#FFFDF9",
				borderColor: "brand.500",
				transform: "translate(-50%, -50%) translateY(-3px)",
			}}
			_active={{
				transform: "translate(-50%, -50%)",
			}}
			onClick={onSelect}
		>
			<Stack spacing="8px" align="center">
				<Badge
					variant="outline"
					borderColor="brand.500"
					color="brand.500"
					fontSize="13px"
					px="10px"
					py="2px"
				>
					{year}
				</Badge>
				<Text
					fontSize={position.width >= 230 ? "20px" : "16px"}
					fontWeight="900"
					lineHeight="1.25"
					noOfLines={2}
				>
					{scenario.title}
				</Text>
				<HStack spacing="8px">
					<Text fontSize="12px" fontWeight="600">
						난이도
					</Text>
					<HStack spacing="5px">
						{[1, 2, 3].map((dot) => (
							<Box
								key={dot}
								w="10px"
								h="10px"
								borderRadius="full"
								borderWidth="1px"
								borderColor="brand.500"
								bg={dot <= level ? "brand.500" : "transparent"}
							/>
						))}
					</HStack>
				</HStack>
				<HStack spacing="7px">
					<Box
						w="14px"
						h="14px"
						borderRadius="full"
						borderWidth="1px"
						borderColor="app.border"
					/>
					<Text fontSize="12px">{scenario.estimatedMinutes}분</Text>
				</HStack>
			</Stack>
		</Button>
	);
}

function MobileScenarioCard({
	scenario,
	isSelected,
	onSelect,
}: {
	scenario: ScenarioItem;
	isSelected: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			h="auto"
			minH="150px"
			p="18px"
			whiteSpace="normal"
			variant="outline"
			borderColor={isSelected ? "brand.500" : "app.border"}
			bg={isSelected ? "brand.50" : "app.surface"}
			onClick={onSelect}
		>
			<Stack spacing="8px" align="flex-start" w="100%">
				<Badge colorScheme="orange" variant="outline">
					{getScenarioYear(scenario.eventPeriod)}
				</Badge>
				<Text fontSize="17px" fontWeight="900" textAlign="left">
					{scenario.title}
				</Text>
				<Text fontSize="12px" color="app.muted">
					{scenario.difficulty} · 약 {scenario.estimatedMinutes}분
				</Text>
			</Stack>
		</Button>
	);
}

function ScenarioLoadingScreen({
	scenario,
	progress,
}: {
	scenario: ScenarioItem;
	progress: number;
}) {
	return (
		<Flex
			minH="calc(100vh - 82px)"
			px={{ base: "20px", md: "32px" }}
			py={{ base: "42px", xl: "64px" }}
			align="center"
			justify="flex-start"
			direction="column"
			bg="app.background"
		>
			<Badge
				bg="brand.500"
				color="white"
				px="20px"
				py="7px"
				fontSize="18px"
				borderRadius="10px"
			>
				{getScenarioYear(scenario.eventPeriod)}
			</Badge>

			<Heading
				mt="28px"
				fontSize={{ base: "34px", md: "44px" }}
				letterSpacing="-0.045em"
				textAlign="center"
			>
				{scenario.title}
			</Heading>
			<Text
				mt="14px"
				fontSize={{ base: "14px", md: "17px" }}
				lineHeight="1.7"
				textAlign="center"
				maxW="760px"
				color="app.subtleText"
			>
				{scenario.summary}
			</Text>

			<Image
				mt={{ base: "24px", md: "38px" }}
				src="/scenario-loading.png"
				alt="개미굴 학습 시나리오"
				w="100%"
				maxW="980px"
				maxH="520px"
				objectFit="contain"
			/>

			<Box mt="24px" w="100%" maxW="700px">
				<Text mb="12px" textAlign="center" fontSize="16px" fontWeight="700">
					시나리오를 불러오는 중입니다......
				</Text>
				<Flex align="center" gap="14px">
					<Progress
						value={progress}
						flex="1"
						h="14px"
						borderRadius="full"
						bg="#FBE1D3"
						colorScheme="orange"
					/>
					<Text minW="44px" color="brand.500" fontWeight="800">
						{progress}%
					</Text>
				</Flex>
			</Box>
		</Flex>
	);
}

export default function Scenario() {
	const navigate = useNavigate();
	const toast = useToast();


	const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
	const [selectedScenario, setSelectedScenario] = useState<ScenarioItem | null>(null);
	const [selectedYear, setSelectedYear] = useState("전체");
	const [selectedDifficulty, setSelectedDifficulty] = useState("전체");
	const [isLoading, setIsLoading] = useState(false);
	const [launchingScenario, setLaunchingScenario] = useState<ScenarioItem | null>(null);
	const [launchSessionId, setLaunchSessionId] = useState<string | null>(null);
	const [launchProgress, setLaunchProgress] = useState(0);
	const [isStartingScenario, setIsStartingScenario] = useState(false);

	const normalizeDifficulty = (
	value: string,
): ScenarioItem["difficulty"] => {
	if (value === "쉬움" || value === "보통" || value === "어려움") {
		return value;
	}

	return "보통";
};

const loadScenarios = async () => {
    try {
        setIsLoading(true);

        const userId = tokens.getUsername() || "USER-001";

        const [scenarioData, userProgress] = await Promise.all([
            scenarioService.getScenarios(),
            scenarioService.getUserProgress(userId).catch((error) => {
                console.warn("시나리오 진행도 조회 실패:", error);
                return null;
            }),
        ]);

        const apiScenarios: ScenarioApiItem[] = Array.isArray(scenarioData)
            ? scenarioData
            : [];

        const progressMap = new Map(
            (userProgress?.items ?? []).map((item) => [
                item.scenario_id,
                item,
            ]),
        );

        const normalizedScenarios: ScenarioItem[] = apiScenarios.map(
            (item) => {
                const progress = progressMap.get(item.scenario_id);

                return {
                    _id: item.scenario_id,
                    chapterId: 0,
                    chapterTitle: "과거 시나리오",
                    scenarioNo: item.scenario_id,
                    scenarioSlug: item.scenario_id,
                    title: item.title,
                    eventPeriod: item.event_period ?? "과거 데이터",
					initialPortfolioLabel:
						item.initial_portfolio_label ??
						`현금 ${item.initial_cash.toLocaleString("ko-KR")}원`,
                    summary: item.description,
                    difficulty: normalizeDifficulty(item.difficulty),
                    estimatedMinutes: item.total_turns * 3,
                    keywords: [],
                    learningPoints: item.learning_points ?? [],
                    status: progress?.status ?? "NOT_STARTED",
                    completedStepCount: progress?.completed_turns ?? 0,
                    sessionId: progress?.session_id ?? null,
                    progressPercent: progress?.progress_percent ?? 0,
                };
            },
        );

        setScenarios(normalizedScenarios);
        setSelectedScenario(normalizedScenarios[0] ?? null);
    } catch (error) {
        console.error(error);

        toast({
            title: "시나리오를 불러오지 못했습니다.",
            description: "새 시나리오 서버 연결 상태를 확인하세요.",
            status: "error",
            isClosable: true,
        });
    } finally {
        setIsLoading(false);
    }
};

	useEffect(() => {
		void loadScenarios();
	}, []);

	const years = useMemo(() => {
		return Array.from(
			new Set(scenarios.map((scenario) => getScenarioYear(scenario.eventPeriod))),
		).sort();
	}, [scenarios]);

	const filteredScenarios = useMemo(() => {
		return scenarios.filter((scenario) => {
			const yearMatched =
				selectedYear === "전체" ||
				getScenarioYear(scenario.eventPeriod) === selectedYear;
			const difficultyMatched =
				selectedDifficulty === "전체" ||
				scenario.difficulty === selectedDifficulty;
			return yearMatched && difficultyMatched;
		});
	}, [scenarios, selectedYear, selectedDifficulty]);

	useEffect(() => {
		if (
			selectedScenario &&
			filteredScenarios.some(
				(item) => item.scenarioSlug === selectedScenario.scenarioSlug,
			)
		) {
			return;
		}
		setSelectedScenario(filteredScenarios[0] ?? null);
	}, [filteredScenarios, selectedScenario]);

	const recentScenarios = useMemo(() => {
		const progressed = scenarios.filter(
			(scenario) => scenario.status !== "NOT_STARTED",
		);
		return (progressed.length > 0 ? progressed : scenarios).slice(0, 3);
	}, [scenarios]);

	const handleStartScenario = async (scenario: ScenarioItem) => {
        if (isStartingScenario) return;

        if (scenario.status === "IN_PROGRESS" && scenario.sessionId) {
            navigate(
                `/scenario/play/${scenario.scenarioSlug}?sessionId=${encodeURIComponent(
                    scenario.sessionId,
                )}`,
            );
            return;
        }

        try {
			setIsStartingScenario(true);

			const userId = tokens.getUsername() || "USER-001";
			const session = await scenarioService.createSession(
				scenario.scenarioSlug,
				userId,
			);

			if (!session?.session_id) {
				throw new Error("시나리오 서버 응답에 session_id가 없습니다.");
			}

			setLaunchSessionId(session.session_id);
			setLaunchProgress(0);
			setLaunchingScenario(scenario);
		} catch (error: any) {
			console.error("시나리오 세션 생성 실패:", error);

			toast({
				title: "시나리오를 시작하지 못했습니다.",
				description:
					error?.response?.data?.message ||
					error?.response?.data?.detail ||
					"시나리오 세션 생성 중 오류가 발생했습니다.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsStartingScenario(false);
		}
	};

	useEffect(() => {
		if (!launchingScenario) return;

		setLaunchProgress(12);
		const intervalId = window.setInterval(() => {
			setLaunchProgress((current) => {
				if (current >= 100) return 100;
				return Math.min(100, current + Math.max(2, Math.round((100 - current) / 8)));
			});
		}, 70);

		return () => window.clearInterval(intervalId);
	}, [launchingScenario]);

	useEffect(() => {
		if (!launchingScenario || !launchSessionId || launchProgress < 100) return;

		const timeoutId = window.setTimeout(() => {
			navigate(
				`/scenario/play/${launchingScenario.scenarioSlug}?sessionId=${encodeURIComponent(
					launchSessionId,
				)}`,
			);
		}, 250);

		return () => window.clearTimeout(timeoutId);
	}, [launchProgress, launchSessionId, launchingScenario, navigate]);

	if (launchingScenario) {
		return (
			<ScenarioLoadingScreen
				scenario={launchingScenario}
				progress={launchProgress}
			/>
		);
	}

	return (
		<Box
			w="100%"
			maxW="1680px"
			mx="auto"
			px={{ base: "16px", md: "24px" }}
			pt={{ base: "22px", xl: "26px" }}
			pb="64px"
		>
			<Box mb="18px">
				<Heading size="md" letterSpacing="-0.035em">
					과거 시나리오
				</Heading>
				<Text mt="7px" fontSize="12px" color="app.subtleText">
					역사적인 경제 사건 속으로 들어가 당시 시장에서 투자 판단을 경험해보세요.
				</Text>
			</Box>

			<Flex
				direction={{ base: "column", lg: "row" }}
				align={{ base: "stretch", lg: "center" }}
				gap="12px"
				mb="18px"
			>
				<HStack spacing="12px" wrap="wrap">
					<Button
						size="sm"
						variant={selectedYear === "전체" ? "outline" : "ghost"}
						borderColor={selectedYear === "전체" ? "brand.500" : "app.border"}
						color={selectedYear === "전체" ? "brand.500" : "app.subtleText"}
						onClick={() => setSelectedYear("전체")}
					>
						전체
					</Button>
					{years.slice(0, 5).map((year) => (
						<Button
							key={year}
							size="sm"
							variant="outline"
							borderColor={selectedYear === year ? "brand.500" : "app.border"}
							color={selectedYear === year ? "brand.500" : "app.subtleText"}
							bg={selectedYear === year ? "brand.50" : "transparent"}
							onClick={() => setSelectedYear(year)}
						>
							{year}년
						</Button>
					))}
				</HStack>

				<Spacer />

				<Select
					w={{ base: "100%", lg: "150px" }}
					size="sm"
					value={selectedDifficulty}
					onChange={(event) => setSelectedDifficulty(event.target.value)}
				>
					<option value="전체">난이도 전체</option>
					<option value="쉬움">쉬움</option>
					<option value="보통">보통</option>
					<option value="어려움">어려움</option>
				</Select>
			</Flex>

			<Grid
				templateColumns={{ base: "1fr", "2xl": "minmax(0, 1fr) 460px" }}
				gap="22px"
				alignItems="stretch"
			>
				<GridItem minW="0">
					{isLoading ? (
						<Skeleton h="650px" borderRadius="10px" />
					) : filteredScenarios.length > 0 ? (
						<>
							<Box
								display={{ base: "none", "2xl": "block" }}
								position="relative"
								h="650px"
								minW="0"
							>
								{filteredScenarios.slice(0, 6).map((scenario, index) => (
									<ScenarioBubble
										key={scenario.scenarioSlug}
										scenario={scenario}
										index={index}
										isSelected={
											selectedScenario?.scenarioSlug === scenario.scenarioSlug
										}
										onSelect={() => setSelectedScenario(scenario)}
									/>
								))}
							</Box>

							<SimpleGrid
								display={{ base: "grid", "2xl": "none" }}
								columns={{ base: 1, md: 2 }}
								spacing="12px"
							>
								{filteredScenarios.slice(0, 6).map((scenario) => (
									<MobileScenarioCard
										key={scenario.scenarioSlug}
										scenario={scenario}
										isSelected={
											selectedScenario?.scenarioSlug === scenario.scenarioSlug
										}
										onSelect={() => setSelectedScenario(scenario)}
									/>
								))}
							</SimpleGrid>
						</>
					) : (
						<Flex h="420px" align="center" justify="center">
							<Text color="app.muted">조건에 맞는 시나리오가 없습니다.</Text>
						</Flex>
					)}
				</GridItem>

				<GridItem>
					<Card h={{ "2xl": "650px" }}>
						<CardBody p={{ base: "20px", md: "26px" }}>
							{selectedScenario ? (
								<Flex direction="column" h="100%">
									<Flex align="flex-start">
										<Badge
											bg="brand.50"
											color="brand.500"
											px="10px"
											py="5px"
										>
											선택된 시나리오
										</Badge>
										<Spacer />
										<Button variant="ghost" size="sm" px="6px" fontSize="22px">
											☆
										</Button>
									</Flex>

									<Heading
										mt="18px"
										fontSize={{ base: "26px", md: "31px" }}
										letterSpacing="-0.045em"
									>
										{selectedScenario.title}
									</Heading>
									<Text mt="20px" fontSize="14px" fontWeight="700">
										{selectedScenario.eventPeriod}
									</Text>
									<Text
										mt="7px"
										fontSize="13px"
										lineHeight="1.7"
										color="app.subtleText"
										noOfLines={3}
									>
										{selectedScenario.summary}
									</Text>

									<Stack mt="26px" spacing="17px" fontSize="13px">
										<Flex>
											<Text fontWeight="700">시작 시점</Text>
											<Spacer />
											<Text>{selectedScenario.eventPeriod}</Text>
										</Flex>
										<Flex>
											<Text fontWeight="700">학습 난이도</Text>
											<Spacer />
											<Text color="brand.500">{selectedScenario.difficulty}</Text>
										</Flex>
										<Flex>
											<Text fontWeight="700">플레이 시간</Text>
											<Spacer />
											<Text>약 {selectedScenario.estimatedMinutes}분</Text>
										</Flex>
										<Flex gap="20px">
											<Text fontWeight="700" flexShrink={0}>시작 자산</Text>
											<Spacer />
											<Text textAlign="right">{selectedScenario.initialPortfolioLabel}</Text>
										</Flex>
										<Flex>
											<Text fontWeight="700">학습 챕터</Text>
											<Spacer />
											<Text>{selectedScenario.chapterTitle}</Text>
										</Flex>
									</Stack>

									<Box
										mt="30px"
										p="18px"
										borderWidth="1px"
										borderColor="app.border"
										borderRadius="8px"
									>
										<Text fontSize="14px" fontWeight="800" mb="14px">
											학습 포인트
										</Text>
										<Stack spacing="11px">
											{selectedScenario.learningPoints?.slice(0, 3).map((point) => (
												<Flex key={point} gap="10px" align="flex-start">
													<Box
														mt="3px"
														w="14px"
														h="14px"
														borderRadius="full"
														borderWidth="1px"
														borderColor="brand.500"
														flexShrink={0}
													/>
													<Text fontSize="13px" lineHeight="1.55">
														{point}
													</Text>
												</Flex>
											))}
										</Stack>
									</Box>

									<Box flex="1" minH="18px" />
									<Button
										h="56px"
										bg="brand.500"
										color="white"
										fontSize="20px"
										_hover={{ bg: "brand.600" }}
										onClick={() => void handleStartScenario(selectedScenario)}
										isLoading={isStartingScenario}
										loadingText="세션 생성 중"
									>
										시나리오 시작하기
									</Button>
								</Flex>
							) : (
								<Flex h="100%" align="center" justify="center">
									<Text color="app.muted">시나리오를 선택하세요.</Text>
								</Flex>
							)}
						</CardBody>
					</Card>
				</GridItem>
			</Grid>

			<Card mt="24px">
				<CardBody p={{ base: "18px", md: "24px" }}>
					<Heading size="sm" mb="18px">
						최근 플레이한 시나리오
					</Heading>
					<SimpleGrid columns={{ base: 1, lg: 3 }} spacing="16px">
						{recentScenarios.map((scenario) => (
							<Flex
								key={`recent-${scenario.scenarioSlug}`}
								borderWidth="1px"
								borderColor="app.border"
								borderRadius="8px"
								p="14px"
								gap="16px"
								minH="150px"
							>
								<Box
									w="118px"
									flexShrink={0}
									borderWidth="1px"
									borderColor="app.border"
									borderRadius="7px"
									bg="app.background"
								/>
								<Flex direction="column" minW="0" flex="1">
									<HStack>
										<Badge colorScheme={statusColor[scenario.status]} variant="outline">
											{statusLabel[scenario.status]}
										</Badge>
										<Text fontWeight="800" noOfLines={1}>
											{scenario.title}
										</Text>
									</HStack>
									<Text mt="8px" fontSize="12px" color="app.muted">
										{scenario.eventPeriod}
									</Text>
									<Box flex="1" />
									{scenario.status === "IN_PROGRESS" ? (
										<Flex align="center" gap="8px">
											<Progress
												value={scenario.progressPercent ?? 0}
												flex="1"
												size="sm"
												colorScheme="orange"
												borderRadius="full"
											/>
											<Text fontSize="12px" color="brand.500">
												{Math.round(scenario.progressPercent ?? 0)}%
											</Text>
										</Flex>
									) : (
										<Button
											size="sm"
											variant="outline"
											borderColor={
												scenario.status === "COMPLETED"
													? "green.400"
													: "brand.400"
											}
											onClick={() => void handleStartScenario(scenario)}
										>
											{scenario.status === "COMPLETED" ? "결과 보기" : "시작하기"}
										</Button>
									)}
								</Flex>
							</Flex>
						))}
					</SimpleGrid>
					{scenarios.length === 0 && !isLoading && (
						<Text color="app.muted">등록된 시나리오가 없습니다.</Text>
					)}
				</CardBody>
			</Card>
		</Box>
	);
}
