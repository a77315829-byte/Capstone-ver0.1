import React, { useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Divider,
	Flex,
	FormControl,
	FormLabel,
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
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	useDisclosure,
} from "@chakra-ui/react";
import {
	CheckCircleIcon,
	CloseIcon,
	InfoIcon,
	RepeatIcon,
	SearchIcon,
} from "@chakra-ui/icons";

import financeTermsData from "../data/financeTerms.json";
import financeQuizzesData from "../data/financeQuizzes.json";
import type {
	FinanceQuiz,
	FinanceTerm,
} from "../types/learning.types";

const financeTerms = financeTermsData as FinanceTerm[];
const financeQuizzes = financeQuizzesData as FinanceQuiz[];

const ALL = "전체";
const QUIZ_COUNT = 10;

function shuffleArray<T>(items: T[]): T[] {
	const copied = [...items];

	for (
		let index = copied.length - 1;
		index > 0;
		index -= 1
	) {
		const randomIndex = Math.floor(
			Math.random() * (index + 1),
		);

		const currentItem = copied[index];
		const randomItem = copied[randomIndex];

		if (
			currentItem === undefined ||
			randomItem === undefined
		) {
			continue;
		}

		copied[index] = randomItem;
		copied[randomIndex] = currentItem;
	}

	return copied;
}

function makeQuizSession(
	category: string,
	difficulty: string,
): FinanceQuiz[] {
	const filtered = financeQuizzes.filter((quiz) => {
		const categoryMatches =
			category === ALL || quiz.category === category;

		const difficultyMatches =
			difficulty === ALL || quiz.difficulty === difficulty;

		return categoryMatches && difficultyMatches;
	});

	return shuffleArray(filtered).slice(
		0,
		Math.min(QUIZ_COUNT, filtered.length),
	);
}

function DictionaryView() {
	const [searchText, setSearchText] = useState("");
	const [category, setCategory] = useState(ALL);
	const [difficulty, setDifficulty] = useState(ALL);
	const [selectedTerm, setSelectedTerm] =
		useState<FinanceTerm | null>(null);

	const modal = useDisclosure();

	const categories = useMemo(
		() => [
			ALL,
			...Array.from(
				new Set(financeTerms.map((term) => term.category)),
			),
		],
		[],
	);

	const filteredTerms = useMemo(() => {
		const normalizedSearch = searchText.trim().toLowerCase();

		return financeTerms.filter((term) => {
			const categoryMatches =
				category === ALL || term.category === category;

			const difficultyMatches =
				difficulty === ALL ||
				term.difficulty === difficulty;

			const searchMatches =
				!normalizedSearch ||
				term.term.toLowerCase().includes(normalizedSearch) ||
				term.shortDefinition
					.toLowerCase()
					.includes(normalizedSearch) ||
				term.description
					.toLowerCase()
					.includes(normalizedSearch);

			return (
				categoryMatches &&
				difficultyMatches &&
				searchMatches
			);
		});
	}, [category, difficulty, searchText]);

	const openTerm = (term: FinanceTerm) => {
		setSelectedTerm(term);
		modal.onOpen();
	};

	return (
		<Stack spacing="6">
			<Card
				borderRadius="18px"
				borderWidth="1px"
				borderColor="army.200"
				bg="#FFFEFA"
				boxShadow="panel"
			>
				<CardBody p={{ base: "20px", md: "24px" }}>
					<Grid
						templateColumns={{
							base: "1fr",
							lg: "minmax(0, 1fr) 190px 170px",
						}}
						gap="4"
					>
						<InputGroup>
							<InputLeftElement pointerEvents="none">
								<SearchIcon color="army.400" />
							</InputLeftElement>

							<Input
								value={searchText}
								onChange={(event) =>
									setSearchText(event.target.value)
								}
								placeholder="용어 또는 설명 검색"
								borderRadius="12px"
								bg="white"
								borderColor="army.200"
								_hover={{
									borderColor: "army.400",
								}}
								_focusVisible={{
									borderColor: "army.500",
									boxShadow:
										"0 0 0 1px #697F43",
								}}
							/>
						</InputGroup>

						<Select
							value={category}
							onChange={(event) =>
								setCategory(event.target.value)
							}
							borderRadius="12px"
							bg="white"
							borderColor="army.200"
						>
							{categories.map((item) => (
								<option key={item} value={item}>
									{item}
								</option>
							))}
						</Select>

						<Select
							value={difficulty}
							onChange={(event) =>
								setDifficulty(event.target.value)
							}
							borderRadius="12px"
							bg="white"
							borderColor="army.200"
						>
							<option value={ALL}>전체 난이도</option>
							<option value="초급">초급</option>
							<option value="중급">중급</option>
						</Select>
					</Grid>

					<Flex
						mt="4"
						align={{ base: "flex-start", md: "center" }}
						justify="space-between"
						direction={{ base: "column", md: "row" }}
						gap="2"
					>
						<Text fontSize="sm" color="gray.600">
							총 {financeTerms.length}개 용어 중{" "}
							<strong>{filteredTerms.length}개</strong> 표시
						</Text>

						<Text fontSize="xs" color="gray.500">
							카드를 누르면 예시와 주의사항이 표시됩니다.
						</Text>
					</Flex>
				</CardBody>
			</Card>

			{filteredTerms.length > 0 ? (
				<SimpleGrid
					columns={{
						base: 1,
						md: 2,
						xl: 3,
					}}
					spacing="5"
				>
					{filteredTerms.map((term) => (
						<Card
							key={term.id}
							as="button"
							type="button"
							textAlign="left"
							borderRadius="18px"
							borderWidth="1px"
							borderColor="army.200"
							boxShadow="sm"
							bg="#FFFEFA"
							transition="all 0.16s ease"
							onClick={() => openTerm(term)}
							_hover={{
								transform: "translateY(-3px)",
								boxShadow: "md",
								borderColor: "army.400",
							}}
						>
							<CardBody p="22px">
								<Flex
									align="center"
									justify="space-between"
									gap="3"
								>
									<Badge
										bg="khaki.100"
										color="army.800"
										borderRadius="full"
										px="2.5"
										py="1"
									>
										{term.category}
									</Badge>

									<Badge
										bg={
											term.difficulty === "초급"
												? "army.100"
												: "signal.100"
										}
										color={
											term.difficulty === "초급"
												? "army.700"
												: "signal.800"
										}
										borderRadius="full"
									>
										{term.difficulty}
									</Badge>
								</Flex>

								<Heading mt="5" size="md">
									{term.term}
								</Heading>

								<Text
									mt="3"
									fontSize="sm"
									lineHeight="1.75"
									color="gray.600"
									noOfLines={3}
								>
									{term.shortDefinition}
								</Text>

								<Divider my="4" />

								<Text
									fontSize="xs"
									fontWeight="800"
									color="army.600"
								>
									자세히 보기
								</Text>
							</CardBody>
						</Card>
					))}
				</SimpleGrid>
			) : (
				<Card
					borderRadius="18px"
					borderWidth="1px"
					borderColor="army.200"
					bg="#FFFEFA"
				>
					<CardBody py="70px">
						<Stack align="center" spacing="3">
							<SearchIcon boxSize="24px" color="gray.400" />
							<Text fontWeight="800">
								검색 결과가 없습니다.
							</Text>
							<Text fontSize="sm" color="gray.500">
								검색어나 필터를 변경해 보세요.
							</Text>
						</Stack>
					</CardBody>
				</Card>
			)}

			<Modal
				isOpen={modal.isOpen}
				onClose={modal.onClose}
				size="xl"
				scrollBehavior="inside"
			>
				<ModalOverlay />

				<ModalContent
					borderRadius="18px"
					bg="#FFFEFA"
					borderWidth="1px"
					borderColor="army.200"
				>
					<ModalHeader pr="12">
						<Stack spacing="2">
							<HStack spacing="2" wrap="wrap">
								<Badge
									bg="khaki.100"
									color="army.800"
								>
									{selectedTerm?.category}
								</Badge>
								<Badge
									bg={
										selectedTerm?.difficulty === "초급"
											? "army.100"
											: "signal.100"
									}
									color={
										selectedTerm?.difficulty === "초급"
											? "army.700"
											: "signal.800"
									}
								>
									{selectedTerm?.difficulty}
								</Badge>
							</HStack>

							<Heading size="lg">
								{selectedTerm?.term}
							</Heading>
						</Stack>
					</ModalHeader>

					<ModalCloseButton />

					<ModalBody pb="6">
						{selectedTerm && (
							<Stack spacing="5">
								<Box
									p="4"
									borderRadius="14px"
									bg="army.50"
									borderWidth="1px"
									borderColor="army.200"
								>
									<Text fontWeight="800" color="army.800">
										{selectedTerm.shortDefinition}
									</Text>
								</Box>

								<Box>
									<Text mb="2" fontWeight="900">
										상세 설명
									</Text>
									<Text lineHeight="1.8" color="gray.700">
										{selectedTerm.description}
									</Text>
								</Box>

								<Box>
									<Text mb="2" fontWeight="900">
										예시
									</Text>
									<Text
										p="4"
										borderRadius="12px"
										bg="field.50"
										borderWidth="1px"
										borderColor="field.100"
										lineHeight="1.75"
									>
										{selectedTerm.example}
									</Text>
								</Box>

								<Box>
									<Text mb="3" fontWeight="900">
										핵심 포인트
									</Text>

									<Stack spacing="2">
										{selectedTerm.keyPoints.map(
											(point) => (
												<Flex
													key={point}
													align="flex-start"
													gap="3"
													p="3"
													borderRadius="12px"
													bg="field.50"
													borderWidth="1px"
													borderColor="field.100"
												>
													<CheckCircleIcon
														mt="3px"
														color="green.500"
													/>
													<Text fontSize="sm">
														{point}
													</Text>
												</Flex>
											),
										)}
									</Stack>
								</Box>

								<Box
									p="4"
									borderRadius="14px"
									bg="signal.50"
									borderWidth="1px"
									borderColor="signal.200"
								>
									<Text fontWeight="900" color="signal.800">
										주의사항
									</Text>
									<Text
										mt="2"
										fontSize="sm"
										lineHeight="1.75"
										color="signal.900"
									>
										{selectedTerm.caution}
									</Text>
								</Box>

								<Box>
									<Text mb="3" fontWeight="900">
										관련 용어
									</Text>
									<HStack spacing="2" wrap="wrap">
										{selectedTerm.relatedTerms.map(
											(term) => (
												<Badge
													key={term}
													px="3"
													py="1.5"
													borderRadius="full"
													bg="army.100"
													color="army.800"
												>
													{term}
												</Badge>
											),
										)}
									</HStack>
								</Box>
							</Stack>
						)}
					</ModalBody>

					<ModalFooter>
						<Button onClick={modal.onClose}>
							닫기
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Stack>
	);
}

function QuizView() {
	const categories = useMemo(
		() => [
			ALL,
			...Array.from(
				new Set(
					financeQuizzes.map((quiz) => quiz.category),
				),
			),
		],
		[],
	);

	const [category, setCategory] = useState(ALL);
	const [difficulty, setDifficulty] = useState(ALL);
	const [session, setSession] = useState<FinanceQuiz[]>(() =>
		makeQuizSession(ALL, ALL),
	);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [selectedIndex, setSelectedIndex] =
		useState<number | null>(null);
	const [isChecked, setIsChecked] = useState(false);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [bestStreak, setBestStreak] = useState(0);
	const [finished, setFinished] = useState(false);

	const currentQuiz = session[currentIndex]!;

	const restartQuiz = (
		nextCategory = category,
		nextDifficulty = difficulty,
	) => {
		setSession(
			makeQuizSession(nextCategory, nextDifficulty),
		);
		setCurrentIndex(0);
		setSelectedIndex(null);
		setIsChecked(false);
		setScore(0);
		setStreak(0);
		setBestStreak(0);
		setFinished(false);
	};

	const checkAnswer = () => {
		if (selectedIndex === null || !currentQuiz) {
			return;
		}

		const isCorrect =
			selectedIndex === currentQuiz.answerIndex;

		if (isCorrect) {
			setScore((previous) => previous + 1);
			setStreak((previous) => {
				const next = previous + 1;
				setBestStreak((best) => Math.max(best, next));
				return next;
			});
		} else {
			setStreak(0);
		}

		setIsChecked(true);
	};

	const nextQuestion = () => {
		if (currentIndex >= session.length - 1) {
			setFinished(true);
			return;
		}

		setCurrentIndex((previous) => previous + 1);
		setSelectedIndex(null);
		setIsChecked(false);
	};

	if (session.length === 0) {
		return (
			<Card
				borderRadius="18px"
				borderWidth="1px"
				borderColor="army.200"
				bg="#FFFEFA"
			>
				<CardBody py="70px">
					<Stack align="center" spacing="4">
						<InfoIcon boxSize="24px" color="orange.500" />
						<Text fontWeight="900">
							조건에 맞는 문제가 없습니다.
						</Text>
						<Button
							colorScheme="army"
							onClick={() => {
								setCategory(ALL);
								setDifficulty(ALL);
								restartQuiz(ALL, ALL);
							}}
						>
							전체 문제로 시작
						</Button>
					</Stack>
				</CardBody>
			</Card>
		);
	}

	if (finished) {
		const percentage = Math.round(
			(score / session.length) * 100,
		);

		return (
			<Card
				borderRadius="20px"
				borderWidth="1px"
				borderColor="army.200"
				bg="#FFFEFA"
				boxShadow="panel"
			>
				<CardBody p={{ base: "24px", md: "40px" }}>
					<Stack align="center" spacing="7">
						<Box
							display="flex"
							alignItems="center"
							justifyContent="center"
							w="76px"
							h="76px"
							borderRadius="24px"
							bg={
								percentage >= 70
									? "green.50"
									: "orange.50"
							}
							color={
								percentage >= 70
									? "green.500"
									: "orange.500"
							}
						>
							<CheckCircleIcon boxSize="34px" />
						</Box>

						<Box textAlign="center">
							<Heading size="lg">퀴즈 완료</Heading>
							<Text mt="2" color="gray.600">
								금융 기초 학습 결과입니다.
							</Text>
						</Box>

						<SimpleGrid
							w="100%"
							maxW="720px"
							columns={{ base: 1, md: 3 }}
							spacing="4"
						>
							<Stat
								p="5"
								textAlign="center"
								borderRadius="16px"
								bg="army.50"
							>
								<StatLabel>정답</StatLabel>
								<StatNumber color="army.800">
									{score}/{session.length}
								</StatNumber>
							</Stat>

							<Stat
								p="5"
								textAlign="center"
								borderRadius="16px"
								bg="field.50"
							>
								<StatLabel>정답률</StatLabel>
								<StatNumber color="field.800">
									{percentage}%
								</StatNumber>
							</Stat>

							<Stat
								p="5"
								textAlign="center"
								borderRadius="16px"
								bg="khaki.50"
							>
								<StatLabel>최고 연속 정답</StatLabel>
								<StatNumber color="khaki.800">
									{bestStreak}
								</StatNumber>
							</Stat>
						</SimpleGrid>

						<Button
							leftIcon={<RepeatIcon />}
							colorScheme="army"
							borderRadius="12px"
							onClick={() => restartQuiz()}
						>
							새 문제 풀기
						</Button>
					</Stack>
				</CardBody>
			</Card>
		);
	}

	return (
		<Stack spacing="5">
			<Card
				borderRadius="18px"
				borderWidth="1px"
				borderColor="army.200"
				bg="#FFFEFA"
				boxShadow="panel"
			>
				<CardBody p={{ base: "18px", md: "22px" }}>
					<Grid
						templateColumns={{
							base: "1fr",
							md: "1fr 1fr auto",
						}}
						gap="3"
						alignItems="end"
					>
						<FormControl>
							<FormLabel fontSize="sm" fontWeight="800">
								카테고리
							</FormLabel>
							<Select
								value={category}
								onChange={(event) => {
									const next = event.target.value;
									setCategory(next);
									restartQuiz(next, difficulty);
								}}
								borderRadius="12px"
							>
								{categories.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</Select>
						</FormControl>

						<FormControl>
							<FormLabel fontSize="sm" fontWeight="800">
								난이도
							</FormLabel>
							<Select
								value={difficulty}
								onChange={(event) => {
									const next = event.target.value;
									setDifficulty(next);
									restartQuiz(category, next);
								}}
								borderRadius="12px"
							>
								<option value={ALL}>전체 난이도</option>
								<option value="초급">초급</option>
								<option value="중급">중급</option>
							</Select>
						</FormControl>

						<Button
							leftIcon={<RepeatIcon />}
							variant="outline"
							borderRadius="12px"
							onClick={() => restartQuiz()}
						>
							문제 섞기
						</Button>
					</Grid>
				</CardBody>
			</Card>

			<Card
				borderRadius="20px"
				borderWidth="1px"
				borderColor="army.200"
				bg="#FFFEFA"
				boxShadow="panel"
				overflow="hidden"
			>
				<Box
					px={{ base: "20px", md: "28px" }}
					py="18px"
					bg="army.50"
					borderBottomWidth="1px"
					borderBottomColor="army.200"
				>
					<Flex
						mb="2"
						align="center"
						justify="space-between"
					>
						<Text fontSize="sm" fontWeight="900">
							문제 {currentIndex + 1} /{" "}
							{session.length}
						</Text>

						<HStack spacing="2">
							<Badge
								bg="field.100"
								color="field.800"
							>
								정답 {score}
							</Badge>
							<Badge
								bg="signal.100"
								color="signal.800"
							>
								연속 {streak}
							</Badge>
						</HStack>
					</Flex>

					<Progress
						value={
							((currentIndex + 1) / session.length) *
							100
						}
						colorScheme="army"
						borderRadius="full"
					/>
				</Box>

				<CardBody p={{ base: "22px", md: "34px" }}>
					<Stack spacing="6">
						<Box>
							<HStack mb="3" spacing="2" wrap="wrap">
								<Badge
									bg="khaki.100"
									color="army.800"
								>
									{currentQuiz.category}
								</Badge>
								<Badge
									bg={
										currentQuiz.difficulty === "초급"
											? "army.100"
											: "signal.100"
									}
									color={
										currentQuiz.difficulty === "초급"
											? "army.700"
											: "signal.800"
									}
								>
									{currentQuiz.difficulty}
								</Badge>
							</HStack>

							<Heading
								size="md"
								lineHeight="1.65"
								whiteSpace="pre-line"
							>
								{currentQuiz.question}
							</Heading>
						</Box>

						<SimpleGrid
							columns={{ base: 1, md: 2 }}
							spacing="4"
						>
							{currentQuiz.options.map(
								(option, optionIndex) => {
									const isSelected =
										selectedIndex === optionIndex;
									const isCorrect =
										optionIndex ===
										currentQuiz.answerIndex;

									let background = "white";
									let borderColor = "army.200";
									let color = "army.900";

									if (!isChecked && isSelected) {
										background = "army.50";
										borderColor = "army.500";
										color = "army.800";
									}

									if (isChecked && isCorrect) {
										background = "green.50";
										borderColor = "green.400";
										color = "green.700";
									}

									if (
										isChecked &&
										isSelected &&
										!isCorrect
									) {
										background = "red.50";
										borderColor = "red.400";
										color = "red.700";
									}

									return (
										<Button
											key={`${option}-${optionIndex}`}
											h="auto"
											minH="64px"
											py="4"
											px="5"
											justifyContent="flex-start"
											textAlign="left"
											whiteSpace="normal"
											borderWidth="2px"
											borderColor={borderColor}
											borderRadius="14px"
											bg={background}
											color={color}
											isDisabled={isChecked}
											onClick={() =>
												setSelectedIndex(
													optionIndex,
												)
											}
										>
											<Flex align="center" gap="3">
												<Box
													display="flex"
													alignItems="center"
													justifyContent="center"
													w="28px"
													h="28px"
													flexShrink={0}
													borderRadius="full"
													bg="army.100"
													color="army.800"
													fontSize="sm"
													fontWeight="900"
												>
													{optionIndex + 1}
												</Box>

												<Text fontWeight="700">
													{option}
												</Text>
											</Flex>
										</Button>
									);
								},
							)}
						</SimpleGrid>

						{isChecked && (
							<Box
								p="5"
								borderRadius="14px"
								bg={
									selectedIndex ===
									currentQuiz.answerIndex
										? "green.50"
										: "red.50"
								}
								borderWidth="1px"
								borderColor={
									selectedIndex ===
									currentQuiz.answerIndex
										? "green.100"
										: "red.100"
								}
							>
								<Flex align="flex-start" gap="3">
									{selectedIndex ===
									currentQuiz.answerIndex ? (
										<CheckCircleIcon
											mt="3px"
											color="green.500"
										/>
									) : (
										<CloseIcon
											mt="5px"
											boxSize="10px"
											color="red.500"
										/>
									)}

									<Box>
										<Text
											fontWeight="900"
											color={
												selectedIndex ===
												currentQuiz.answerIndex
													? "green.700"
													: "red.700"
											}
										>
											{selectedIndex ===
											currentQuiz.answerIndex
												? "정답입니다."
												: `정답은 ${currentQuiz.options[currentQuiz.answerIndex]}입니다.`}
										</Text>

										<Text
											mt="2"
											fontSize="sm"
											lineHeight="1.75"
											color="gray.700"
										>
											{currentQuiz.explanation}
										</Text>
									</Box>
								</Flex>
							</Box>
						)}

						<Flex justify="flex-end">
							{!isChecked ? (
								<Button
									minW="120px"
									colorScheme="army"
									borderRadius="12px"
									isDisabled={selectedIndex === null}
									onClick={checkAnswer}
								>
									정답 확인
								</Button>
							) : (
								<Button
									minW="120px"
									colorScheme="army"
									borderRadius="12px"
									onClick={nextQuestion}
								>
									{currentIndex === session.length - 1
										? "결과 보기"
										: "다음 문제"}
								</Button>
							)}
						</Flex>
					</Stack>
				</CardBody>
			</Card>
		</Stack>
	);
}

export default function FinanceLearning() {
	return (
		<Box
			minH="calc(100vh - 66px)"
			bg="#F2F1E9"
		>
			<Box
				maxW="1440px"
				mx="auto"
				px={{
					base: "16px",
					md: "24px",
					xl: "32px",
				}}
				py={{
					base: "24px",
					md: "36px",
				}}
			>
				<Box
					mb="7"
					px={{
						base: "22px",
						md: "32px",
					}}
					py={{
						base: "28px",
						md: "36px",
					}}
					borderRadius="22px"
					bgGradient="linear(to-r, army.900, army.700, army.600)"
					color="white"
					boxShadow="panel"
				>
					<HStack
						mb="4"
						spacing="2"
						wrap="wrap"
					>
						<Badge
							px="3"
							py="1"
							bg="khaki.200"
							color="army.900"
						>
							전군 금융 학습
						</Badge>

						<Badge
							px="3"
							py="1"
							bg="whiteAlpha.200"
							color="white"
						>
							사전 · 퀴즈
						</Badge>
					</HStack>

					<Heading
						fontSize={{
							base: "30px",
							md: "40px",
						}}
						letterSpacing="-0.04em"
					>
						금융 기초 학습
					</Heading>

					<Text
						mt="3"
						maxW="760px"
						color="whiteAlpha.800"
						lineHeight="1.8"
					>
						금융 용어{" "}
						{financeTerms.length}개와
						객관식 퀴즈{" "}
						{financeQuizzes.length}개로
						핵심 개념을 학습합니다.
					</Text>
				</Box>

				<Tabs
					variant="unstyled"
					isLazy
				>
					<TabList
						mb="6"
						p="1.5"
						maxW="500px"
						bg="#FFFEFA"
						borderWidth="1px"
						borderColor="army.200"
						borderRadius="16px"
						boxShadow="sm"
					>
						<Tab
							flex="1"
							borderRadius="12px"
							fontWeight="900"
							color="army.800"
							_selected={{
								bg: "army.700",
								color: "white",
								boxShadow:
									"0 4px 12px rgba(64, 79, 43, 0.24)",
							}}
						>
							용어 사전
						</Tab>

						<Tab
							flex="1"
							borderRadius="12px"
							fontWeight="900"
							color="army.800"
							_selected={{
								bg: "army.700",
								color: "white",
								boxShadow:
									"0 4px 12px rgba(64, 79, 43, 0.24)",
							}}
						>
							퀴즈 학습
						</Tab>
					</TabList>

					<TabPanels>
						<TabPanel p="0">
							<DictionaryView />
						</TabPanel>

						<TabPanel p="0">
							<QuizView />
						</TabPanel>
					</TabPanels>
				</Tabs>
			</Box>
		</Box>
	);
}
