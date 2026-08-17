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
	Divider,
	Flex,
	Grid,
	Heading,
	HStack,
	Input,
	InputGroup,
	InputLeftElement,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	Select,
	SimpleGrid,
	Spacer,
	Stack,
	Text,
	useDisclosure,
} from "@chakra-ui/react";
import {
	CheckCircleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	SearchIcon,
} from "@chakra-ui/icons";
import {
	useLocation,
	useSearchParams,
} from "react-router-dom";

import financeTermsData from "../data/financeTerms.json";
import financeQuizzesData from "../data/financeQuizzes.json";
import type {
	FinanceQuiz,
	FinanceTerm,
} from "../types/learning.types";
import {
	fetchQuizProgress,
	getCachedQuizProgress,
	recordQuizResult,
	recordQuizSessionCompleted,
	type QuizProgressSummary,
} from "../services/learningProgress.service";
import tokens from "../services/tokens.service";

const financeTerms =
	financeTermsData as FinanceTerm[];
const financeQuizzes =
	financeQuizzesData as FinanceQuiz[];

const ALL = "전체";

const ORANGE = "#F36F2A";
const ORANGE_DARK = "#D95E20";
const ORANGE_SOFT = "#FFF1E7";
const BG = "#FDFAF4";
const CARD = "#FFFFFF";
const BORDER = "#E8DCCE";
const TEXT = "#29231E";
const MUTED = "#887D73";
const GREEN = "#319A5B";
const RED = "#D95546";

type MainTab =
	| "dictionary"
	| "quiz";

type QuizScreen =
	| "topics"
	| "play"
	| "result";

type QuizTopic = {
	id: string;
	term: FinanceTerm;
	quizzes: FinanceQuiz[];
	completedCount: number;
};

function cleanQuestion(value: string): {
	title: string;
	quote: string | null;
} {
	const normalized = value.trim();
	const match = normalized.match(
		/^([\s\S]*?)\n[“"]([\s\S]*?)[”"]$/,
	);

	if (!match) {
		return {
			title: normalized,
			quote: null,
		};
	}

	return {
		title: match[1]?.trim() || normalized,
		quote: match[2]?.trim() || null,
	};
}

function getDifficultyStyle(
	difficulty: string,
) {
	return difficulty === "초급"
		? {
			bg: "#EFF7EE",
			color: "#588059",
		}
		: {
			bg: "#FFF2E8",
			color: "#C96B31",
		};
}

function getCategoryList() {
	return [
		ALL,
		...Array.from(
			new Set(
				financeTerms.map(
					(term) => term.category,
				),
			),
		),
	];
}

function getTopicDescription(
	term: FinanceTerm,
) {
	if (term.shortDefinition) {
		return term.shortDefinition;
	}

	return term.description;
}

function DictionaryView({
	initialTermId,
	onStartQuiz,
}: {
	initialTermId?: string | null;
	onStartQuiz: (termId: string) => void;
}) {
	const [
		searchText,
		setSearchText,
	] = useState("");
	const [
		category,
		setCategory,
	] = useState(ALL);
	const [
		difficulty,
		setDifficulty,
	] = useState(ALL);
	const [
		selectedTerm,
		setSelectedTerm,
	] = useState<FinanceTerm | null>(
		null,
	);

	const detailModal = useDisclosure();

	useEffect(() => {
		if (!initialTermId) {
			return;
		}

		const requested =
			financeTerms.find(
				(term) =>
					term.id ===
					initialTermId,
			);

		if (!requested) {
			return;
		}

		setSelectedTerm(requested);
		setSearchText(requested.term);
		setCategory(ALL);
		setDifficulty(ALL);
		detailModal.onOpen();
	}, [initialTermId]);

	const categories =
		useMemo(
			() =>
				getCategoryList(),
			[],
		);

	const filteredTerms =
		useMemo(() => {
			const query =
				searchText
					.trim()
					.toLowerCase();

			return financeTerms.filter(
				(term) => {
					const categoryMatch =
						category === ALL ||
						term.category ===
						category;

					const difficultyMatch =
						difficulty === ALL ||
						term.difficulty ===
						difficulty;

					const searchMatch =
						!query ||
						term.term
							.toLowerCase()
							.includes(query) ||
						term.shortDefinition
							.toLowerCase()
							.includes(query) ||
						term.description
							.toLowerCase()
							.includes(query);

					return (
						categoryMatch &&
						difficultyMatch &&
						searchMatch
					);
				},
			);
		}, [
			category,
			difficulty,
			searchText,
		]);

	const openTerm = (
		term: FinanceTerm,
	) => {
		setSelectedTerm(term);
		detailModal.onOpen();
	};

	return (
		<>
			<Stack spacing="18px">
				<Box
					bg={CARD}
					borderWidth="1px"
					borderColor={BORDER}
					borderRadius="14px"
					p={{
						base: "16px",
						md: "18px",
					}}
				>
					<Grid
						templateColumns={{
							base: "1fr",
							lg: "minmax(0, 1fr) 190px 150px",
						}}
						gap="10px"
					>
						<InputGroup>
							<InputLeftElement
								pointerEvents="none"
							>
								<SearchIcon
									color="#A89B90"
								/>
							</InputLeftElement>

							<Input
								value={
									searchText
								}
								onChange={(
									event,
								) =>
									setSearchText(
										event
											.target
											.value,
									)
								}
								placeholder="금융 용어 검색"
								bg="#FFFCF8"
								borderColor={
									BORDER
								}
								borderRadius="10px"
								fontSize="12px"
								_focusVisible={{
									borderColor:
										ORANGE,
									boxShadow:
										"0 0 0 1px #F36F2A",
								}}
							/>
						</InputGroup>

						<Select
							value={
								category
							}
							onChange={(
								event,
							) =>
								setCategory(
									event
										.target
										.value,
								)
							}
							bg="#FFFCF8"
							borderColor={
								BORDER
							}
							borderRadius="10px"
							fontSize="12px"
						>
							{categories.map(
								(item) => (
									<option
										key={
											item
										}
										value={
											item
										}
									>
										{item}
									</option>
								),
							)}
						</Select>

						<Select
							value={
								difficulty
							}
							onChange={(
								event,
							) =>
								setDifficulty(
									event
										.target
										.value,
								)
							}
							bg="#FFFCF8"
							borderColor={
								BORDER
							}
							borderRadius="10px"
							fontSize="12px"
						>
							<option
								value={ALL}
							>
								전체 난이도
							</option>
							<option value="초급">
								초급
							</option>
							<option value="중급">
								중급
							</option>
						</Select>
					</Grid>
				</Box>

				<Flex
					align="center"
					gap="8px"
				>
					<Text
						fontSize="13px"
						fontWeight="900"
						color={TEXT}
					>
						금융 용어
					</Text>

					<Badge
						bg="#F2ECE6"
						color="#786D63"
						borderRadius="full"
						fontSize="9px"
					>
						{
							filteredTerms.length
						}
						개
					</Badge>
				</Flex>

				<SimpleGrid
					columns={{
						base: 1,
						md: 2,
						xl: 3,
					}}
					spacing="12px"
				>
					{filteredTerms.map(
						(term) => {
							const style =
								getDifficultyStyle(
									term.difficulty,
								);

							return (
								<Button
									key={
										term.id
									}
									h="auto"
									minH="156px"
									p="0"
									variant="unstyled"
									textAlign="left"
									whiteSpace="normal"
									onClick={() =>
										openTerm(
											term,
										)
									}
								>
									<Box
										h="100%"
										minH="156px"
										p="16px"
										bg="white"
										borderWidth="1px"
										borderColor={
											BORDER
										}
										borderRadius="12px"
										transition="all .16s ease"
										_hover={{
											transform:
												"translateY(-2px)",
											borderColor:
												"#E7B690",
											boxShadow:
												"0 10px 24px rgba(73,52,30,.07)",
										}}
									>
										<Flex
											align="center"
											gap="7px"
										>
											<Badge
												bg={
													ORANGE_SOFT
												}
												color={
													ORANGE_DARK
												}
												borderRadius="full"
												fontSize="8px"
												px="7px"
												py="3px"
											>
												{
													term.category
												}
											</Badge>

											<Badge
												bg={
													style.bg
												}
												color={
													style.color
												}
												borderRadius="full"
												fontSize="8px"
												px="7px"
												py="3px"
											>
												{
													term.difficulty
												}
											</Badge>
										</Flex>

										<Text
											mt="13px"
											fontSize="18px"
											fontWeight="900"
											letterSpacing="-0.035em"
											color={
												TEXT
											}
										>
											{
												term.term
											}
										</Text>

										<Text
											mt="7px"
											fontSize="11px"
											lineHeight="1.65"
											color="#70665D"
											noOfLines={
												3
											}
										>
											{
												term.shortDefinition
											}
										</Text>

										<Text
											mt="12px"
											fontSize="9px"
											fontWeight="900"
											color={
												ORANGE
											}
										>
											자세히 보기
											›
										</Text>
									</Box>
								</Button>
							);
						},
					)}
				</SimpleGrid>
			</Stack>

			<Modal
				isOpen={
					detailModal.isOpen
				}
				onClose={
					detailModal.onClose
				}
				size="lg"
				isCentered
			>
				<ModalOverlay
					bg="rgba(29,25,21,.48)"
				/>

				<ModalContent
					borderRadius="14px"
					borderWidth="1px"
					borderColor={BORDER}
					overflow="hidden"
				>
					<ModalCloseButton />

					{selectedTerm && (
						<>
							<ModalHeader
								pt="24px"
								pb="16px"
							>
								<HStack
									mb="9px"
									spacing="7px"
								>
									<Badge
										bg={
											ORANGE_SOFT
										}
										color={
											ORANGE_DARK
										}
									>
										{
											selectedTerm.category
										}
									</Badge>

									<Badge
										bg={
											getDifficultyStyle(
												selectedTerm.difficulty,
											)
												.bg
										}
										color={
											getDifficultyStyle(
												selectedTerm.difficulty,
											)
												.color
										}
									>
										{
											selectedTerm.difficulty
										}
									</Badge>
								</HStack>

								<Heading
									size="md"
									color={TEXT}
								>
									{
										selectedTerm.term
									}
								</Heading>

								<Text
									mt="5px"
									fontSize="11px"
									fontWeight="700"
									color={MUTED}
								>
									{
										selectedTerm.shortDefinition
									}
								</Text>
							</ModalHeader>

							<Divider
								borderColor={
									BORDER
								}
							/>

							<ModalBody py="18px">
								<Stack spacing="16px">
									<Box>
										<Text
											fontSize="10px"
											fontWeight="900"
											color={TEXT}
										>
											용어 설명
										</Text>
										<Text
											mt="6px"
											fontSize="11px"
											lineHeight="1.75"
											color="#675E55"
										>
											{
												selectedTerm.description
											}
										</Text>
									</Box>

									<Box
										p="13px"
										bg="#FFF8F2"
										borderRadius="10px"
										borderWidth="1px"
										borderColor="#F2DED0"
									>
										<Text
											fontSize="9px"
											fontWeight="900"
											color={
												ORANGE_DARK
											}
										>
											예시
										</Text>
										<Text
											mt="5px"
											fontSize="11px"
											lineHeight="1.7"
											color="#675E55"
										>
											{
												selectedTerm.example
											}
										</Text>
									</Box>

									{selectedTerm
										.keyPoints
										?.length >
										0 && (
											<Box>
												<Text
													fontSize="10px"
													fontWeight="900"
													color={
														TEXT
													}
												>
													핵심 포인트
												</Text>
												<Stack
													mt="7px"
													spacing="5px"
												>
													{selectedTerm.keyPoints.map(
														(
															point,
															index,
														) => (
															<Flex
																key={`${point}-${index}`}
																gap="7px"
																align="flex-start"
															>
																<Box
																	mt="6px"
																	w="4px"
																	h="4px"
																	borderRadius="full"
																	bg={
																		ORANGE
																	}
																	flexShrink={
																		0
																	}
																/>
																<Text
																	fontSize="10px"
																	lineHeight="1.6"
																	color="#675E55"
																>
																	{
																		point
																	}
																</Text>
															</Flex>
														),
													)}
												</Stack>
											</Box>
										)}

									{selectedTerm.caution && (
										<Box
											p="12px"
											bg="#FBF7F2"
											borderRadius="9px"
										>
											<Text
												fontSize="9px"
												fontWeight="900"
												color="#8C6C53"
											>
												주의
											</Text>
											<Text
												mt="4px"
												fontSize="10px"
												lineHeight="1.65"
												color="#72675E"
											>
												{
													selectedTerm.caution
												}
											</Text>
										</Box>
									)}
								</Stack>
							</ModalBody>

							<ModalFooter
								gap="8px"
								borderTopWidth="1px"
								borderColor={BORDER}
							>
								<Button
									size="sm"
									variant="outline"
									borderColor={
										BORDER
									}
									onClick={
										detailModal.onClose
									}
								>
									닫기
								</Button>

								<Button
									size="sm"
									bg={ORANGE}
									color="white"
									_hover={{
										bg:
											ORANGE_DARK,
									}}
									onClick={() => {
										detailModal.onClose();
										onStartQuiz(
											selectedTerm.id,
										);
									}}
								>
									이 용어 퀴즈 풀기
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</>
	);
}

function QuizTopicCard({
	topic,
	isFeatured,
	onStart,
}: {
	topic: QuizTopic;
	isFeatured: boolean;
	onStart: (topic: QuizTopic) => void;
}) {
	const progress =
		topic.quizzes.length > 0
			? Math.round(
				(topic.completedCount /
					topic.quizzes.length) *
				100,
			)
			: 0;

	return (
		<Box
			bg="white"
			borderWidth="1px"
			borderColor={
				isFeatured
					? "#EAB68E"
					: BORDER
			}
			borderRadius="13px"
			p="17px"
			boxShadow={
				isFeatured
					? "0 10px 28px rgba(243,111,42,.07)"
					: "none"
			}
		>
			<Flex
				align="center"
				gap="7px"
			>
				{isFeatured && (
					<Badge
						bg={ORANGE_SOFT}
						color={ORANGE_DARK}
						borderRadius="full"
						px="8px"
						py="3px"
						fontSize="8px"
					>
						이번 주 추천
					</Badge>
				)}

				<Badge
					bg="#F4EFEA"
					color="#756A61"
					borderRadius="full"
					px="8px"
					py="3px"
					fontSize="8px"
				>
					{
						topic.term.category
					}
				</Badge>

				<Spacer />

				<Badge
					bg={
						getDifficultyStyle(
							topic.term.difficulty,
						).bg
					}
					color={
						getDifficultyStyle(
							topic.term.difficulty,
						).color
					}
					fontSize="8px"
				>
					{
						topic.term.difficulty
					}
				</Badge>
			</Flex>

			<Text
				mt="15px"
				fontSize="22px"
				fontWeight="900"
				color={TEXT}
				letterSpacing="-0.04em"
			>
				{topic.term.term}
			</Text>

			<Text
				mt="7px"
				minH="38px"
				fontSize="10px"
				lineHeight="1.7"
				color="#70665D"
				noOfLines={2}
			>
				{getTopicDescription(
					topic.term,
				)}
			</Text>

			<Divider
				my="14px"
				borderColor="#F0E8E0"
			/>

			<Flex
				align="center"
				justify="space-between"
			>
				<Text
					fontSize="9px"
					fontWeight="800"
					color={MUTED}
				>
					{
						topic.completedCount
					}{" "}
					/ {topic.quizzes.length} 문제
					완료
				</Text>

				<Text
					fontSize="9px"
					fontWeight="900"
					color={ORANGE}
				>
					{progress}%
				</Text>
			</Flex>

			<Progress
				mt="7px"
				value={progress}
				h="5px"
				borderRadius="full"
				bg="#F0EBE5"
				sx={{
					"& > div": {
						background: ORANGE,
						borderRadius:
							"999px",
					},
				}}
			/>

			<Button
				mt="15px"
				w="100%"
				h="36px"
				bg={ORANGE}
				color="white"
				borderRadius="9px"
				fontSize="11px"
				fontWeight="900"
				_hover={{
					bg: ORANGE_DARK,
				}}
				onClick={() =>
					onStart(topic)
				}
			>
				{topic.completedCount > 0
					? "다시 풀기"
					: "퀴즈 시작"}
			</Button>
		</Box>
	);
}

function QuizView({
	initialTermId,
	onClearTerm,
}: {
	initialTermId?: string | null;
	onClearTerm: () => void;
}) {
	const [
		screen,
		setScreen,
	] = useState<QuizScreen>("topics");

	const username =
		tokens.getUsername() ?? "훈련생";

	const [
		progress,
		setProgress,
	] = useState<QuizProgressSummary>(
		() =>
			getCachedQuizProgress(
				username,
				financeQuizzes.length,
			),
	);

	const [
		selectedTopic,
		setSelectedTopic,
	] = useState<QuizTopic | null>(
		null,
	);

	const [
		session,
		setSession,
	] = useState<FinanceQuiz[]>([]);

	const [
		currentIndex,
		setCurrentIndex,
	] = useState(0);

	const [
		selectedIndex,
		setSelectedIndex,
	] = useState<number | null>(
		null,
	);

	const [
		isChecked,
		setIsChecked,
	] = useState(false);

	const [score, setScore] =
		useState(0);

	const [streak, setStreak] =
		useState(0);

	const [
		sessionAnswers,
		setSessionAnswers,
	] = useState<
		Record<
			string,
			{
				selectedIndex: number;
				isCorrect: boolean;
			}
		>
	>({});

	const answerModal =
		useDisclosure();

	const topics =
		useMemo(() => {
			const termById =
				new Map(
					financeTerms.map(
						(term) => [
							term.id,
							term,
						],
					),
				);

			const grouped =
				new Map<
					string,
					FinanceQuiz[]
				>();

			financeQuizzes.forEach(
				(quiz) => {
					const current =
						grouped.get(
							quiz.relatedTermId,
						) ?? [];

					current.push(quiz);

					grouped.set(
						quiz.relatedTermId,
						current,
					);
				},
			);

			const result: QuizTopic[] =
				[];

			grouped.forEach(
				(
					quizzes,
					termId,
				) => {
					const term =
						termById.get(
							termId,
						);

					if (!term) {
						return;
					}

					const completedCount =
						quizzes.filter(
							(quiz) =>
								progress.answeredQuizIds.includes(
									quiz.id,
								),
						).length;

					result.push({
						id: termId,
						term,
						quizzes,
						completedCount,
					});
				},
			);

			return result.sort(
				(a, b) => {
					if (
						a.id === "per"
					) {
						return -1;
					}

					if (
						b.id === "per"
					) {
						return 1;
					}

					return a.term.term.localeCompare(
						b.term.term,
						"ko",
					);
				},
			);
		}, [progress]);

	const completedTopicCount =
		topics.filter((topic) =>
			topic.quizzes.length > 0 &&
			topic.quizzes.every((quiz) =>
				progress.answeredQuizIds.includes(quiz.id),
			),
		).length;

	useEffect(() => {
		let active = true;

		void fetchQuizProgress(
			username,
			financeQuizzes.length,
		).then((next) => {
			if (active) {
				setProgress(next);
			}
		});

		const refresh = () =>
			setProgress(
				getCachedQuizProgress(
					username,
					financeQuizzes.length,
				),
			);

		window.addEventListener(
			"antitude:quiz-progress-updated",
			refresh,
		);

		window.addEventListener(
			"storage",
			refresh,
		);

		return () => {
			active = false;
			window.removeEventListener(
				"antitude:quiz-progress-updated",
				refresh,
			);
			window.removeEventListener(
				"storage",
				refresh,
			);
		};
	}, [username]);

	const autoStartedTermRef =
		useRef<string | null>(null);

	const startTopic = (
		topic: QuizTopic,
	) => {
		setSelectedTopic(topic);
		setSession([...topic.quizzes]);
		setCurrentIndex(0);
		setSelectedIndex(null);
		setIsChecked(false);
		setScore(0);
		setStreak(0);
		setSessionAnswers({});
		setScreen("play");
	};

	useEffect(() => {
		if (!initialTermId) {
			return;
		}

		// 같은 term으로 이미 자동 시작했다면 다시 시작하지 않음
		if (
			autoStartedTermRef.current ===
			initialTermId
		) {
			return;
		}

		const topic = topics.find(
			(item) =>
				item.id === initialTermId,
		);

		if (!topic) {
			return;
		}

		autoStartedTermRef.current =
			initialTermId;

		startTopic(topic);
	}, [initialTermId, topics]);

	const currentQuiz =
		session[currentIndex];

	const checkAnswer = () => {
		if (
			!currentQuiz ||
			selectedIndex === null ||
			isChecked
		) {
			return;
		}

		const correct =
			selectedIndex ===
			currentQuiz.answerIndex;

		setIsChecked(true);

		setSessionAnswers(
			(current) => ({
				...current,
				[currentQuiz.id]: {
					selectedIndex,
					isCorrect: correct,
				},
			}),
		);

		if (correct) {
			setScore(
				(current) =>
					current + 1,
			);
			setStreak(
				(current) =>
					current + 1,
			);
		} else {
			setStreak(0);
		}

		void recordQuizResult(
			username,
			currentQuiz.id,
			correct,
		);

		setProgress(
			getCachedQuizProgress(
				username,
				financeQuizzes.length,
			),
		);

		answerModal.onOpen();
	};

	const moveToQuestion = (
		index: number,
	) => {
		const target =
			session[index];

		if (!target) {
			return;
		}

		answerModal.onClose();
		setCurrentIndex(index);

		const previous =
			sessionAnswers[target.id];

		if (previous) {
			setSelectedIndex(
				previous.selectedIndex,
			);
			setIsChecked(true);
		} else {
			setSelectedIndex(null);
			setIsChecked(false);
		}
	};

	const goNext = () => {
		if (
			currentIndex <
			session.length - 1
		) {
			moveToQuestion(
				currentIndex + 1,
			);
			return;
		}

		answerModal.onClose();

		if (selectedTopic) {
			void recordQuizSessionCompleted(
				username,
			);
		}

		setProgress(
			getCachedQuizProgress(
				username,
				financeQuizzes.length,
			),
		);

		setScreen("result");
	};

	const backToTopics = () => {
		answerModal.onClose();
		setScreen("topics");
		setSelectedTopic(null);
		setSession([]);
		setCurrentIndex(0);
		setSelectedIndex(null);
		setIsChecked(false);
		onClearTerm();
	};

	if (
		screen === "topics" ||
		!currentQuiz
	) {
		return (
			<Stack spacing="18px">
				<Grid
					templateColumns={{
						base: "1fr",
						lg: "1.2fr .8fr",
					}}
					gap="12px"
				>
					<Box
						p="18px"
						bg="white"
						borderWidth="1px"
						borderColor={BORDER}
						borderRadius="13px"
					>
						<Badge
							bg={ORANGE_SOFT}
							color={ORANGE_DARK}
							borderRadius="full"
							fontSize="8px"
						>
							퀴즈 학습
						</Badge>

						<Text
							mt="12px"
							fontSize="18px"
							fontWeight="900"
							color={TEXT}
							letterSpacing="-0.035em"
						>
							금융 개념을 문제로
							확인해보세요.
						</Text>

						<Text
							mt="6px"
							fontSize="10px"
							lineHeight="1.7"
							color={MUTED}
						>
							용어별 핵심 문제를 풀고
							학습 진행도와 정답률을
							쌓을 수 있습니다.
						</Text>
					</Box>

					<Box
						p="18px"
						bg="#FFF9F3"
						borderWidth="1px"
						borderColor="#F0D9C7"
						borderRadius="13px"
					>
						<Flex
							align="center"
							justify="space-between"
						>
							<Text
								fontSize="10px"
								fontWeight="900"
								color="#735A47"
							>
								전체 학습 진행도
							</Text>

							<Text
								fontSize="17px"
								fontWeight="900"
								color={ORANGE}
							>
								{
									progress.progressPercent
								}
								%
							</Text>
						</Flex>

						<Progress
							mt="8px"
							value={
								progress.progressPercent
							}
							h="6px"
							borderRadius="full"
							bg="#F0E4DA"
							sx={{
								"& > div":
								{
									background:
										ORANGE,
								},
							}}
						/>

						<SimpleGrid
							mt="15px"
							columns={3}
							spacing="8px"
						>
							{[
								{
									label:
										"푼 문제",
									value: `${progress.answeredCount}/${progress.totalQuizCount}`,
								},
								{
									label:
										"정답률",
									value: `${progress.accuracyPercent}%`,
								},
								{
									label:
										"완료 주제",
									value: `${completedTopicCount}`,
								},
							].map(
								(item) => (
									<Box
										key={
											item.label
										}
										p="9px"
										bg="white"
										borderRadius="8px"
										textAlign="center"
									>
										<Text
											fontSize="8px"
											color={
												MUTED
											}
										>
											{
												item.label
											}
										</Text>
										<Text
											mt="4px"
											fontSize="12px"
											fontWeight="900"
											color={
												TEXT
											}
										>
											{
												item.value
											}
										</Text>
									</Box>
								),
							)}
						</SimpleGrid>
					</Box>
				</Grid>

				<Flex align="center">
					<Text
						fontSize="14px"
						fontWeight="900"
						color={TEXT}
					>
						퀴즈 주제
					</Text>

					<Spacer />

					<Text
						fontSize="9px"
						color={MUTED}
					>
						용어마다 핵심 문제
						{
							topics[0]
								?.quizzes
								.length ??
							3
						}
						개 구성
					</Text>
				</Flex>

				<SimpleGrid
					columns={{
						base: 1,
						md: 2,
						xl: 3,
					}}
					spacing="12px"
				>
					{topics.map(
						(
							topic,
							index,
						) => (
							<QuizTopicCard
								key={
									topic.id
								}
								topic={
									topic
								}
								isFeatured={
									index === 0
								}
								onStart={
									startTopic
								}
							/>
						),
					)}
				</SimpleGrid>
			</Stack>
		);
	}

	if (
		screen === "result" &&
		selectedTopic
	) {
		const resultPercent =
			session.length > 0
				? Math.round(
					(score /
						session.length) *
					100,
				)
				: 0;

		return (
			<Flex
				minH="520px"
				align="center"
				justify="center"
			>
				<Box
					w="100%"
					maxW="580px"
					p={{
						base: "24px",
						md: "34px",
					}}
					bg="white"
					borderWidth="1px"
					borderColor={BORDER}
					borderRadius="16px"
					textAlign="center"
				>
					<Flex
						mx="auto"
						w="54px"
						h="54px"
						align="center"
						justify="center"
						borderRadius="full"
						bg={ORANGE_SOFT}
					>
						<CheckCircleIcon
							boxSize="27px"
							color={ORANGE}
						/>
					</Flex>

					<Text
						mt="16px"
						fontSize="20px"
						fontWeight="900"
						color={TEXT}
					>
						퀴즈 완료
					</Text>

					<Text
						mt="6px"
						fontSize="11px"
						color={MUTED}
					>
						{
							selectedTopic
								.term.term
						}{" "}
						주제 학습을 마쳤습니다.
					</Text>

					<Text
						mt="20px"
						fontSize="38px"
						fontWeight="900"
						color={ORANGE}
					>
						{score}
						<Text
							as="span"
							fontSize="17px"
							color={MUTED}
						>
							{" "}
							/{" "}
							{session.length}
						</Text>
					</Text>

					<Text
						mt="4px"
						fontSize="10px"
						color={MUTED}
					>
						정답률{" "}
						{resultPercent}%
					</Text>

					<HStack
						mt="24px"
						justify="center"
						spacing="8px"
					>
						<Button
							size="sm"
							variant="outline"
							borderColor={
								BORDER
							}
							onClick={
								backToTopics
							}
						>
							주제 목록
						</Button>

						<Button
							size="sm"
							bg={ORANGE}
							color="white"
							_hover={{
								bg:
									ORANGE_DARK,
							}}
							onClick={() =>
								startTopic(
									selectedTopic,
								)
							}
						>
							다시 풀기
						</Button>
					</HStack>
				</Box>
			</Flex>
		);
	}

	const question =
		cleanQuestion(
			currentQuiz.question,
		);

	const progressPercent =
		session.length > 0
			? ((currentIndex + 1) /
				session.length) *
			100
			: 0;

	return (
		<>
			<Stack spacing="14px">
				<Flex
					align="center"
					gap="10px"
				>
					<Button
						size="sm"
						variant="ghost"
						leftIcon={
							<ChevronLeftIcon />
						}
						color="#756A61"
						fontSize="10px"
						onClick={
							backToTopics
						}
					>
						퀴즈 목록
					</Button>

					<Spacer />

					<Badge
						bg={ORANGE_SOFT}
						color={ORANGE_DARK}
						borderRadius="full"
						px="9px"
						py="4px"
						fontSize="8px"
					>
						{
							selectedTopic
								?.term.term
						}
					</Badge>
				</Flex>

				<Box
					bg="white"
					borderWidth="1px"
					borderColor={BORDER}
					borderRadius="14px"
					overflow="hidden"
				>
					<Box
						px={{
							base: "18px",
							md: "24px",
						}}
						py="17px"
						bg="#FFF9F4"
						borderBottomWidth="1px"
						borderColor={BORDER}
					>
						<Flex
							align="center"
							mb="9px"
						>
							<Text
								fontSize="11px"
								fontWeight="900"
								color={TEXT}
							>
								문제{" "}
								{
									currentIndex +
									1
								}{" "}
								/{" "}
								{
									session.length
								}
							</Text>

							<Spacer />

							<HStack spacing="12px">
								<Text
									fontSize="9px"
									color={MUTED}
								>
									정답{" "}
									<Text
										as="span"
										fontWeight="900"
										color={
											GREEN
										}
									>
										{
											score
										}
									</Text>
								</Text>

								<Text
									fontSize="9px"
									color={MUTED}
								>
									연속{" "}
									<Text
										as="span"
										fontWeight="900"
										color={
											ORANGE
										}
									>
										{
											streak
										}
									</Text>
								</Text>
							</HStack>
						</Flex>

						<Progress
							value={
								progressPercent
							}
							h="6px"
							borderRadius="full"
							bg="#EFE5DC"
							sx={{
								"& > div":
								{
									background:
										ORANGE,
									borderRadius:
										"999px",
								},
							}}
						/>
					</Box>

					<Box
						p={{
							base: "20px",
							md: "28px",
						}}
					>
						<Stack spacing="22px">
							<Box>
								<HStack
									mb="10px"
									spacing="7px"
								>
									<Badge
										bg="#F5EFE9"
										color="#786D63"
										borderRadius="full"
										fontSize="8px"
									>
										{
											currentQuiz.category
										}
									</Badge>

									<Badge
										bg={
											getDifficultyStyle(
												currentQuiz.difficulty,
											)
												.bg
										}
										color={
											getDifficultyStyle(
												currentQuiz.difficulty,
											)
												.color
										}
										borderRadius="full"
										fontSize="8px"
									>
										{
											currentQuiz.difficulty
										}
									</Badge>
								</HStack>

								<Heading
									size="md"
									lineHeight="1.65"
									letterSpacing="-0.03em"
									color={TEXT}
									whiteSpace="pre-line"
								>
									{
										question.title
									}
								</Heading>

								{question.quote && (
									<Box
										mt="14px"
										p="13px 15px"
										bg="#FBF7F2"
										borderLeftWidth="3px"
										borderLeftColor={
											ORANGE
										}
										borderRadius="0 9px 9px 0"
									>
										<Text
											fontSize="11px"
											lineHeight="1.7"
											color="#675D54"
										>
											“
											{
												question.quote
											}
											”
										</Text>
									</Box>
								)}
							</Box>

							<SimpleGrid
								columns={{
									base: 1,
									md: 2,
								}}
								spacing="10px"
							>
								{currentQuiz.options.map(
									(
										option,
										optionIndex,
									) => {
										const selected =
											selectedIndex ===
											optionIndex;

										const correct =
											optionIndex ===
											currentQuiz.answerIndex;

										let border =
											BORDER;
										let background =
											"white";
										let color =
											TEXT;

										if (
											!isChecked &&
											selected
										) {
											border =
												ORANGE;
											background =
												ORANGE_SOFT;
										}

										if (
											isChecked &&
											correct
										) {
											border =
												"#92CBA5";
											background =
												"#F0FAF3";
											color =
												"#2F7D4B";
										}

										if (
											isChecked &&
											selected &&
											!correct
										) {
											border =
												"#E7A9A1";
											background =
												"#FFF3F1";
											color =
												RED;
										}

										return (
											<Button
												key={`${option}-${optionIndex}`}
												h="auto"
												minH="62px"
												py="12px"
												px="14px"
												justifyContent="flex-start"
												textAlign="left"
												whiteSpace="normal"
												borderWidth="1px"
												borderColor={
													border
												}
												borderRadius="10px"
												bg={
													background
												}
												color={
													color
												}
												_hover={{
													bg:
														isChecked
															? background
															: "#FFF9F4",
												}}
												onClick={() => {
													if (
														!isChecked
													) {
														setSelectedIndex(
															optionIndex,
														);
													}
												}}
											>
												<Flex
													align="center"
													gap="10px"
												>
													<Flex
														w="26px"
														h="26px"
														align="center"
														justify="center"
														borderRadius="full"
														bg={
															selected
																? ORANGE
																: "#F4EFEA"
														}
														color={
															selected
																? "white"
																: "#756A61"
														}
														fontSize="10px"
														fontWeight="900"
														flexShrink={
															0
														}
													>
														{
															optionIndex +
															1
														}
													</Flex>

													<Text
														fontSize="11px"
														fontWeight="700"
														lineHeight="1.55"
													>
														{
															option
														}
													</Text>
												</Flex>
											</Button>
										);
									},
								)}
							</SimpleGrid>

							<Flex
								align={{
									base: "stretch",
									md: "center",
								}}
								direction={{
									base: "column",
									md: "row",
								}}
								gap="10px"
							>
								<HStack
									spacing="6px"
									flexWrap="wrap"
								>
									{session.map(
										(
											item,
											index,
										) => {
											const answered =
												sessionAnswers[
												item
													.id
												];

											const active =
												index ===
												currentIndex;

											return (
												<Button
													key={
														item.id
													}
													size="xs"
													minW="30px"
													h="30px"
													borderRadius="full"
													variant="outline"
													borderColor={
														active
															? ORANGE
															: answered
																? answered.isCorrect
																	? "#95CDA7"
																	: "#E6AAA3"
																: BORDER
													}
													bg={
														active
															? ORANGE_SOFT
															: "white"
													}
													color={
														active
															? ORANGE_DARK
															: "#786D63"
													}
													onClick={() =>
														moveToQuestion(
															index,
														)
													}
												>
													{
														index +
														1
													}
												</Button>
											);
										},
									)}
								</HStack>

								<Spacer />

								<Button
									minW="120px"
									h="38px"
									bg={ORANGE}
									color="white"
									fontSize="11px"
									fontWeight="900"
									_hover={{
										bg:
											ORANGE_DARK,
									}}
									isDisabled={
										selectedIndex ===
										null ||
										isChecked
									}
									onClick={
										checkAnswer
									}
								>
									정답 확인
								</Button>
							</Flex>
						</Stack>
					</Box>
				</Box>
			</Stack>

			<Modal
				isOpen={
					answerModal.isOpen
				}
				onClose={
					answerModal.onClose
				}
				size="md"
				isCentered
				closeOnOverlayClick={false}
			>
				<ModalOverlay
					bg="rgba(29,25,21,.48)"
				/>

				<ModalContent
					borderRadius="15px"
					borderWidth="1px"
					borderColor={BORDER}
					overflow="hidden"
				>
					<ModalBody
						px="24px"
						pt="28px"
						pb="18px"
						textAlign="center"
					>
						<Flex
							mx="auto"
							w="52px"
							h="52px"
							align="center"
							justify="center"
							borderRadius="full"
							bg={
								selectedIndex ===
									currentQuiz.answerIndex
									? "#EDF8F0"
									: "#FFF0ED"
							}
						>
							{selectedIndex ===
								currentQuiz.answerIndex ? (
								<CheckCircleIcon
									boxSize="25px"
									color={GREEN}
								/>
							) : (
								<Text
									fontSize="24px"
									fontWeight="900"
									color={RED}
								>
									×
								</Text>
							)}
						</Flex>

						<Text
							mt="13px"
							fontSize="19px"
							fontWeight="900"
							color={TEXT}
						>
							{selectedIndex ===
								currentQuiz.answerIndex
								? "정답입니다!"
								: "아쉬워요!"}
						</Text>

						<Box
							mt="18px"
							p="13px"
							bg="#FBF7F2"
							borderRadius="10px"
							textAlign="left"
						>
							<Flex gap="9px">
								<Text
									fontSize="10px"
									fontWeight="900"
									color={ORANGE_DARK}
									flexShrink={0}
								>
									정답
								</Text>

								<Text
									fontSize="11px"
									fontWeight="800"
									color={TEXT}
								>
									{
										currentQuiz
											.answerIndex +
										1
									}
									.{" "}
									{
										currentQuiz
											.options[
										currentQuiz
											.answerIndex
										]
									}
								</Text>
							</Flex>
						</Box>

						<Box
							mt="10px"
							p="13px"
							borderWidth="1px"
							borderColor={BORDER}
							borderRadius="10px"
							textAlign="left"
						>
							<Text
								fontSize="9px"
								fontWeight="900"
								color={MUTED}
							>
								해설
							</Text>

							<Text
								mt="5px"
								fontSize="10px"
								lineHeight="1.75"
								color="#675D54"
							>
								{
									currentQuiz.explanation
								}
							</Text>
						</Box>
					</ModalBody>

					<ModalFooter
						gap="8px"
						borderTopWidth="1px"
						borderColor={BORDER}
					>
						<Button
							size="sm"
							variant="outline"
							borderColor={
								BORDER
							}
							onClick={() => {
								answerModal.onClose();
								setSelectedIndex(
									null,
								);
								setIsChecked(
									false,
								);
							}}
						>
							다시 풀기
						</Button>

						<Button
							size="sm"
							bg={ORANGE}
							color="white"
							rightIcon={
								currentIndex <
									session.length -
									1 ? (
									<ChevronRightIcon />
								) : undefined
							}
							_hover={{
								bg:
									ORANGE_DARK,
							}}
							onClick={goNext}
						>
							{currentIndex <
								session.length - 1
								? "다음 문제"
								: "결과 보기"}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
}

export default function FinanceLearning() {
	const location =
		useLocation();

	const [
		searchParams,
		setSearchParams,
	] = useSearchParams();

	const initialTab =
		location.pathname === "/quiz" ||
			searchParams.get("tab") ===
			"quiz"
			? "quiz"
			: "dictionary";

	const [
		mainTab,
		setMainTab,
	] = useState<MainTab>(
		initialTab,
	);

	const relatedTermId =
		searchParams.get("term");

	const changeTab = (
		tab: MainTab,
	) => {
		setMainTab(tab);

		const next =
			new URLSearchParams(
				searchParams,
			);

		if (tab === "quiz") {
			next.set("tab", "quiz");
		} else {
			next.delete("tab");
			next.delete("term");
		}

		setSearchParams(next, {
			replace: true,
		});
	};

	const startQuizForTerm = (
		termId: string,
	) => {
		setMainTab("quiz");

		const next =
			new URLSearchParams(
				searchParams,
			);

		next.set("tab", "quiz");
		next.set("term", termId);

		setSearchParams(next, {
			replace: true,
		});
	};

	const clearTerm = () => {
		const next =
			new URLSearchParams(
				searchParams,
			);

		next.delete("term");

		if (mainTab === "quiz") {
			next.set("tab", "quiz");
		}

		setSearchParams(next, {
			replace: true,
		});
	};

	return (
		<Box
			minH="100vh"
			bg={BG}
			px={{
				base: "16px",
				md: "24px",
				xl: "32px",
			}}
			py={{
				base: "20px",
				md: "28px",
			}}
		>
			<Box
				maxW="1460px"
				mx="auto"
			>
				<Box mb="22px">
					<Heading
						size="lg"
						letterSpacing="-0.04em"
						color={TEXT}
					>
						금융 사전 퀴즈
					</Heading>

					<Text
						mt="6px"
						fontSize="12px"
						color={MUTED}
					>
						금융 용어를 익히고
						퀴즈로 개념을
						확인해보세요.
					</Text>
				</Box>

				<Flex
					mb="20px"
					borderBottomWidth="1px"
					borderColor={BORDER}
				>
					{[
						{
							id:
								"dictionary" as const,
							label:
								"용어 사전",
						},
						{
							id:
								"quiz" as const,
							label:
								"퀴즈 학습",
						},
					].map((tab) => {
						const active =
							mainTab ===
							tab.id;

						return (
							<Button
								key={tab.id}
								h="44px"
								px="20px"
								variant="ghost"
								borderRadius="0"
								fontSize="12px"
								fontWeight={
									active
										? "900"
										: "700"
								}
								color={
									active
										? TEXT
										: "#A39A91"
								}
								borderBottomWidth="2px"
								borderBottomColor={
									active
										? ORANGE
										: "transparent"
								}
								_hover={{
									bg:
										"transparent",
									color:
										active
											? TEXT
											: "#756A61",
								}}
								onClick={() =>
									changeTab(
										tab.id,
									)
								}
							>
								{tab.label}
							</Button>
						);
					})}
				</Flex>

				{mainTab ===
					"dictionary" ? (
					<DictionaryView
						initialTermId={
							relatedTermId
						}
						onStartQuiz={
							startQuizForTerm
						}
					/>
				) : (
					<QuizView
						initialTermId={
							relatedTermId
						}
						onClearTerm={
							clearTerm
						}
					/>
				)}
			</Box>
		</Box>
	);
}