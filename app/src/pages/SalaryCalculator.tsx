import React, {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	AddIcon,
	DeleteIcon,
	RepeatIcon,
} from "@chakra-ui/icons";

import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	CardHeader,
	Divider,
	Flex,
	FormControl,
	FormHelperText,
	FormLabel,
	Grid,
	GridItem,
	Heading,
	HStack,
	Input,
	Progress,
	Select,
	SimpleGrid,
	Spinner,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Text,
	useToast,
} from "@chakra-ui/react";

import {
	useNavigate,
} from "react-router-dom";

import api from "../services/api.service";

import {
	BRANCH_LABEL,
} from "../data/military.constants";

import {
	analyzeSalaryPlan,
	getLatestSalaryPlan,
} from "../services/salaryPlanner.service";

import type {
	ExpenseItem,
	ExpenseKind,
	GoalCostItem,
	MilitaryProfileApiData,
	MilitaryRank,
	SavedSalaryPlan,
	SalaryAiResult,
	SalaryPlannerSnapshot,
	SoldierRank,
} from "../types/salaryPlanner.types";

const SALARY_BY_RANK:
	Record<
		SoldierRank,
		number
	> = {
	이병: 750_000,
	일병: 900_000,
	상병: 1_200_000,
	병장: 1_500_000,
};

const MILITARY_RANK_MAP:
	Record<
		MilitaryRank,
		SoldierRank
	> = {
	PRIVATE: "이병",
	PRIVATE_FIRST_CLASS: "일병",
	CORPORAL: "상병",
	SERGEANT: "병장",
};

type MilitaryProfileStatus =
	| "LOADING"
	| "CONFIGURED"
	| "MISSING"
	| "ERROR";

const SAVINGS_OPTIONS =
	Array.from(
		{
			length: 12,
		},
		(_, index) =>
			index * 50_000,
	);

interface GoalPreset {
	label: string;
	description: string;
	researchGuide: string;
	costLabels: string[];
}

const GOAL_PRESETS:
	GoalPreset[] = [
	{
		label: "전역 여행",
		description:
			"전역 후 떠날 여행에 필요한 실제 비용을 직접 조사해 준비하는 목표입니다.",
		researchGuide:
			"목적지와 기간을 정한 뒤 각 비용을 조사해 아래 항목에 입력하세요.",
		costLabels: [
			"왕복 교통비",
			"숙박비",
			"식비",
			"현지 교통비",
			"활동·관광비",
			"보험·예비비",
		],
	},
	{
		label: "대학 등록금",
		description:
			"복학 또는 진학 시 필요한 등록금과 학업 준비 비용을 마련하는 목표입니다.",
		researchGuide:
			"학교의 최근 공지와 본인의 생활 방식을 확인해 아래 비용을 직접 입력하세요.",
		costLabels: [
			"등록금",
			"교재·학습비",
			"기숙사·주거비",
			"통학·교통비",
			"초기 생활비",
		],
	},
	{
		label: "독립 준비",
		description:
			"전역 후 주거 이전과 초기 생활 정착에 필요한 자금을 마련하는 목표입니다.",
		researchGuide:
			"희망 지역의 실제 매물과 이전 비용을 조사해 아래 항목에 입력하세요.",
		costLabels: [
			"보증금",
			"첫 달 월세",
			"중개비",
			"이사비",
			"생활용품",
		],
	},
	{
		label: "차량·오토바이",
		description:
			"구매가격뿐 아니라 유지비까지 고려해 이동수단 구입을 준비하는 목표입니다.",
		researchGuide:
			"실제 매물과 초기 유지 비용을 조사해 아래 항목에 입력하세요.",
		costLabels: [
			"구매 가격",
			"취등록비",
			"보험료",
			"장비·용품",
			"초기 정비비",
		],
	},
	{
		label: "취업·자격증",
		description:
			"전역 후 취업 준비와 자격 취득에 필요한 비용을 마련하는 목표입니다.",
		researchGuide:
			"준비하려는 시험이나 직무를 정한 뒤 아래 비용을 조사해 입력하세요.",
		costLabels: [
			"시험 응시료",
			"강의비",
			"교재비",
			"장비·도구",
			"교통·활동비",
		],
	},
];

const DEFAULT_FIXED_EXPENSES:
	ExpenseItem[] = [
	{
		id: "fixed-telecom",
		label: "통신비·정기 구독",
		amount: 0,
		kind: "FIXED",
	},
	{
		id: "fixed-family",
		label: "가족 송금·정기 이체",
		amount: 0,
		kind: "FIXED",
	},
	{
		id: "fixed-membership",
		label: "보험·회비",
		amount: 0,
		kind: "FIXED",
	},
];

const DEFAULT_VARIABLE_EXPENSES:
	ExpenseItem[] = [
	{
		id: "variable-px",
		label: "PX·마트",
		amount: 0,
		kind: "VARIABLE",
	},
	{
		id: "variable-leave",
		label: "외출·외박 경비",
		amount: 0,
		kind: "VARIABLE",
	},

	{
		id: "variable-hobby",
		label: "게임·취미·문화",
		amount: 0,
		kind: "VARIABLE",
	},
	{
		id: "variable-study",
		label: "자격증·도서·자기계발",
		amount: 0,
		kind: "VARIABLE",
	},
	{
		id: "variable-gift",
		label: "선물·경조사",
		amount: 0,
		kind: "VARIABLE",
	},
];

const currency =
	new Intl.NumberFormat(
		"ko-KR",
	);

const formatCurrency = (
	value: number,
) =>
	`${currency.format(
		Math.round(value),
	)}원`;

const formatPercent = (
	value: number,
) =>
	`${Math.max(
		0,
		value,
	).toFixed(1)}%`;

const clamp = (
	value: number,
	min: number,
	max: number,
) =>
	Math.min(
		max,
		Math.max(min, value),
	);

function createDefaultDischargeDate():
	string {
	const date = new Date();

	date.setMonth(
		date.getMonth() + 12,
	);

	return date
		.toISOString()
		.slice(0, 10);
}

function formatDateOnly(
	value: string,
): string {
	return value
		? value.replace(
			/-/g,
			".",
		)
		: "-";
}

function calculateMonthsLeft(
	dateText: string,
): number {
	if (!dateText) {
		return 12;
	}

	const today = new Date();

	const dischargeDate =
		new Date(
			`${dateText}T00:00:00`,
		);

	if (
		Number.isNaN(
			dischargeDate.getTime(),
		) ||
		dischargeDate <= today
	) {
		return 1;
	}

	return Math.max(
		1,
		Math.ceil(
			(dischargeDate.getTime() -
				today.getTime()) /
				86_400_000 /
				30.44,
		),
	);
}

function unwrapApiData<T>(
	raw: unknown,
): T {
	const value =
		raw as {
			data?: T;
			profile?: T;
		};

	if (
		value?.profile !==
		undefined
	) {
		return value.profile;
	}

	if (
		value?.data !==
		undefined
	) {
		return value.data;
	}

	return raw as T;
}

function createSnapshotSignature(
	snapshot: SalaryPlannerSnapshot,
): string {
	return JSON.stringify({
		rank:
			snapshot.rank,
		enlistmentDate:
			snapshot.enlistmentDate,
		promotionSpendingRate:
			snapshot.promotionSpendingRate,
		militarySavings:
			snapshot.militarySavings,
		existingMilitarySavingsPrincipal:
			snapshot.existingMilitarySavingsPrincipal,
		fixedItems:
			snapshot.fixedItems,
		variableItems:
			snapshot.variableItems,
		goal:
			snapshot.goal,
	});
}

function formatDateTime(
	value: string,
): string {
	const date = new Date(value);

	return Number.isNaN(
		date.getTime(),
	)
		? ""
		: date.toLocaleString(
				"ko-KR",
				{
					month:
						"long",
					day:
						"numeric",
					hour:
						"2-digit",
					minute:
						"2-digit",
				},
			);
}

function parseMoney(
	value: string,
	max = Number.MAX_SAFE_INTEGER,
): number {
	const digits =
		value.replace(
			/[^\d]/g,
			"",
		);

	if (!digits) {
		return 0;
	}

	return clamp(
		Number(digits),
		0,
		max,
	);
}

function MoneyInput({
	value,
	onChange,
	placeholder = "0",
	max,
}: {
	value: number;
	onChange:
		(value: number) => void;
	placeholder?: string;
	max?: number;
}) {
	return (
		<Input
			value={
				value > 0
					? value.toLocaleString(
							"ko-KR",
						)
					: ""
			}
			inputMode="numeric"
			textAlign="right"
			placeholder={
				placeholder
			}
			onChange={(event) =>
				onChange(
					parseMoney(
						event.target
							.value,
						max,
					),
				)
			}
		/>
	);
}

interface ExpenseSectionProps {
	title: string;
	description: string;
	kind: ExpenseKind;
	items: ExpenseItem[];
	total: number;
	onChange:
		(
			id: string,
			amount: number,
		) => void;
	onRemove:
		(id: string) => void;
	onAdd:
		(kind: ExpenseKind) => void;
}

function ExpenseSection({
	title,
	description,
	kind,
	items,
	total,
	onChange,
	onRemove,
	onAdd,
}: ExpenseSectionProps) {
	return (
		<Box
			borderWidth="1px"
			borderColor="army.200"
			borderRadius="16px"
			overflow="hidden"
			bg="white"
		>
			<Flex
				px="4"
				py="3"
				align="center"
				justify="space-between"
				bg={
					kind === "FIXED"
						? "army.50"
						: "khaki.50"
				}
				borderBottomWidth="1px"
				borderColor="army.200"
			>
				<Box>
					<Text fontWeight="900">
						{title}
					</Text>

					<Text
						mt="1"
						fontSize="xs"
						color="gray.600"
					>
						{description}
					</Text>
				</Box>

				<Badge
					colorScheme={
						kind === "FIXED"
							? "army"
							: "khaki"
					}
					px="3"
					py="1"
				>
					{formatCurrency(
						total,
					)}
				</Badge>
			</Flex>

			<Stack
				spacing="0"
				divider={
					<Divider />
				}
			>
				{items.map(
					(item) => (
						<Flex
							key={
								item.id
							}
							p="4"
							align={{
								base:
									"stretch",
								md:
									"center",
							}}
							direction={{
								base:
									"column",
								md: "row",
							}}
							gap="3"
						>
							<Box flex="1">
								<Text
									fontSize="sm"
									fontWeight="800"
								>
									{item.label}
								</Text>

								<Text
									mt="1"
									fontSize="xs"
									color="gray.500"
								>
									금액을 직접 입력하세요
								</Text>
							</Box>

							<HStack>
								<Box maxW="180px">
									<MoneyInput
										value={
											item.amount
										}
										onChange={(
											value,
										) =>
											onChange(
												item.id,
												value,
											)
										}
									/>
								</Box>

								<Text
									fontSize="sm"
									color="gray.500"
								>
									원
								</Text>

								<Button
									size="sm"
									variant="ghost"
									colorScheme="red"
									leftIcon={
										<DeleteIcon />
									}
									onClick={() =>
										onRemove(
											item.id,
										)
									}
								>
									삭제
								</Button>
							</HStack>
						</Flex>
					),
				)}
			</Stack>

			<Box
				p="3"
				borderTopWidth="1px"
				borderColor="army.200"
			>
				<Button
					w="full"
					size="sm"
					variant="outline"
					colorScheme="army"
					leftIcon={
						<AddIcon />
					}
					onClick={() =>
						onAdd(kind)
					}
				>
					지출 항목 추가
				</Button>
			</Box>
		</Box>
	);
}

function RatioProgress({
	label,
	value,
	colorScheme,
}: {
	label: string;
	value: number;
	colorScheme: string;
}) {
	return (
		<Box>
			<Flex
				mb="1"
				justify="space-between"
			>
				<Text
					fontSize="xs"
					color="gray.600"
				>
					{label}
				</Text>

				<Text
					fontSize="xs"
					fontWeight="900"
				>
					{formatPercent(
						value,
					)}
				</Text>
			</Flex>

			<Progress
				value={clamp(
					value,
					0,
					100,
				)}
				size="sm"
				colorScheme={
					colorScheme
				}
				borderRadius="full"
			/>
		</Box>
	);
}

function WaitingCard({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Box
			p="5"
			borderWidth="1px"
			borderColor="whiteAlpha.300"
			borderRadius="16px"
			bg="whiteAlpha.100"
			minH="155px"
		>
			<Text
				fontSize="xs"
				fontWeight="900"
				color="whiteAlpha.700"
			>
				{title}
			</Text>

			<Text
				mt="3"
				fontSize="xl"
				fontWeight="900"
			>
				분석 대기 중
			</Text>

			<Text
				mt="2"
				fontSize="sm"
				color="whiteAlpha.800"
			>
				{description}
			</Text>
		</Box>
	);
}
export default function SalaryCalculator() {
	const toast = useToast();
	const navigate = useNavigate();

	const [
		rank,
		setRank,
	] =
		useState<SoldierRank>(
			"상병",
		);

	const [
		profileLinked,
		setProfileLinked,
	] = useState(false);

	const [
		militaryBranch,
		setMilitaryBranch,
	] = useState<
		NonNullable<
			MilitaryProfileApiData["branch"]
		> | null
	>(null);

	const [
		militaryProfileStatus,
		setMilitaryProfileStatus,
	] =
		useState<MilitaryProfileStatus>(
			"LOADING",
		);

	const [
		militarySavings,
		setMilitarySavings,
	] = useState(0);

	const [
		existingMilitarySavingsPrincipal,
		setExistingMilitarySavingsPrincipal,
	] = useState(0);

	const [
		fixedItems,
		setFixedItems,
	] =
		useState<
			ExpenseItem[]
		>(
			DEFAULT_FIXED_EXPENSES,
		);

	const [
		variableItems,
		setVariableItems,
	] =
		useState<
			ExpenseItem[]
		>(
			DEFAULT_VARIABLE_EXPENSES,
		);

	const [
		goalName,
		setGoalName,
	] = useState("");

	const [
		goalDescription,
		setGoalDescription,
	] = useState("");

	const [
		goalCostItems,
		setGoalCostItems,
	] =
		useState<
			GoalCostItem[]
		>([]);

	const [
		goalAmount,
		setGoalAmount,
	] = useState(0);

	useEffect(() => {
		setGoalAmount(
			goalCostItems.reduce(
				(total, item) =>
					total +
					item.amount,
				0,
			),
		);
	}, [goalCostItems]);

	const [
		currentSaved,
		setCurrentSaved,
	] = useState(0);

	const [
		enlistmentDate,
		setEnlistmentDate,
	] = useState("");

	const [
		dischargeDate,
		setDischargeDate,
	] =
		useState(
			createDefaultDischargeDate(),
		);

	const [
		promotionSpendingRate,
		setPromotionSpendingRate,
	] = useState(0.5);

	const [
		newExpenseName,
		setNewExpenseName,
	] = useState("");

	const [
		newExpenseKind,
		setNewExpenseKind,
	] =
		useState<ExpenseKind>(
			"VARIABLE",
		);

	const [
		aiResult,
		setAiResult,
	] =
		useState<SalaryAiResult | null>(
			null,
		);

	const [
		analyzedSignature,
		setAnalyzedSignature,
	] = useState("");

	const [
		generatedAt,
		setGeneratedAt,
	] = useState("");

	const [
		analysisDurationMs,
		setAnalysisDurationMs,
	] = useState<
		number | null
	>(null);

	const [
		isInitialLoading,
		setIsInitialLoading,
	] = useState(true);

	const [
		isAiLoading,
		setIsAiLoading,
	] = useState(false);

	const [
		isFundingTrading,
		setIsFundingTrading,
	] = useState(false);


	const monthlySalary =
		SALARY_BY_RANK[rank];

	const fixedExpenses =
		useMemo(
			() =>
				fixedItems.reduce(
					(
						total,
						item,
					) =>
						total +
						item.amount,
					0,
				),
			[fixedItems],
		);

	const variableExpenses =
		useMemo(
			() =>
				variableItems.reduce(
					(
						total,
						item,
					) =>
						total +
						item.amount,
					0,
				),
			[variableItems],
		);

	const snapshot =
		useMemo<SalaryPlannerSnapshot>(
			() => {
				const totalExpenses =
					fixedExpenses +
					variableExpenses;

				const rawRemaining =
					monthlySalary -
					militarySavings -
					totalExpenses;

				const remainingAmount =
					Math.max(
						0,
						rawRemaining,
					);

				const overspendAmount =
					Math.max(
						0,
						-rawRemaining,
					);

				const monthsLeft =
					calculateMonthsLeft(
						dischargeDate,
					);

				const existingContributions =
					existingMilitarySavingsPrincipal;

				const futureContributions =
					militarySavings *
					monthsLeft;

				const projectedContributions =
					existingContributions +
					futureContributions;

				/*
				 * 2024년 이후 납입 원금 100% 매칭을 단순 가정합니다.
				 * 실제 지급 여부는 만기 해지 및 지원 요건 충족이 필요합니다.
				 */
				const projectedMatchingSupport =
					projectedContributions;

				const projectedMilitarySavings =
					projectedContributions +
					projectedMatchingSupport;

				const projectedAvailableAtDischarge =
					currentSaved +
					projectedMilitarySavings;

				const goalGap =
					goalAmount > 0
						? Math.max(
								0,
								goalAmount -
									projectedAvailableAtDischarge,
							)
						: 0;

				const monthlyGoalNeeded =
					goalAmount > 0
						? Math.ceil(
								goalGap /
									monthsLeft,
							)
						: 0;

				const allItems = [
					...fixedItems,
					...variableItems,
				].sort(
					(a, b) =>
						b.amount -
						a.amount,
				);

				return {
					standardYear:
						2026,
					rank,
					salary:
						monthlySalary,
					enlistmentDate,
					promotionSpendingRate,
					militarySavings,
					existingMilitarySavingsPrincipal,
					fixedExpenses,
					variableExpenses,
					totalExpenses,
					remainingAmount,
					overspendAmount,
					fixedItems,
					variableItems,
					topExpense:
						allItems[0] ?? {
							label:
								"지출 없음",
							amount: 0,
						},
					actualRatios: {
						savings:
							monthlySalary >
							0
								? (militarySavings /
										monthlySalary) *
									100
								: 0,
						expenses:
							monthlySalary >
							0
								? (totalExpenses /
										monthlySalary) *
									100
								: 0,
						remaining:
							monthlySalary >
							0
								? (remainingAmount /
										monthlySalary) *
									100
								: 0,
					},
					goal: {
						name:
							goalName ||
							"전역 목표",
						description:
							goalDescription,
						costItems:
							goalCostItems,
						targetAmount:
							goalAmount,
						currentSaved,
						dischargeDate,
						monthsLeft,
						existingContributions,
						futureContributions,
						projectedContributions,
						projectedMatchingSupport,
						projectedMilitarySavings,
						projectedAvailableAtDischarge,
						goalGap,
						monthlyGoalNeeded,
					},
				};
			},
			[
				rank,
				monthlySalary,
				enlistmentDate,
				promotionSpendingRate,
				militarySavings,
				existingMilitarySavingsPrincipal,
				fixedExpenses,
				variableExpenses,
				fixedItems,
				variableItems,
				goalName,
				goalDescription,
				goalCostItems,
				goalAmount,
				currentSaved,
				dischargeDate,
			],
		);

	const snapshotSignature =
		useMemo(
			() =>
				createSnapshotSignature(
					snapshot,
				),
			[snapshot],
		);

	const hasInputChanges =
		Boolean(
			aiResult &&
				analyzedSignature &&
				snapshotSignature !==
					analyzedSignature,
		);

	const selectedGoalPreset =
		useMemo(
			() =>
				GOAL_PRESETS.find(
					(item) =>
						item.label ===
						goalName,
				) ?? null,
			[goalName],
		);

	const applySavedPlan =
		useCallback(
			(
				plan: SavedSalaryPlan,
			) => {
				const saved =
					plan.snapshot;

				setRank(saved.rank);
				setEnlistmentDate(
					saved.enlistmentDate ??
						"",
				);
				setMilitarySavings(
					saved.militarySavings,
				);

				setExistingMilitarySavingsPrincipal(
					saved.existingMilitarySavingsPrincipal ??
						saved.goal
							?.existingContributions ??
						0,
				);

				setFixedItems(
					saved.fixedItems,
				);
				setVariableItems(
					saved.variableItems,
				);
				setGoalName(
					saved.goal.name ===
						"전역 목표"
						? ""
						: saved.goal.name,
				);
				setGoalDescription(
					saved.goal.description ??
						"",
				);

				setGoalCostItems(
					saved.goal.costItems
						?.length
						? saved.goal.costItems
						: saved.goal
									.targetAmount >
							  0
							? [
									{
										id:
											"legacy-goal",
										label:
											"목표 비용",
										amount:
											saved.goal
												.targetAmount,
									},
								]
							: [],
				);
				setCurrentSaved(
					saved.goal.currentSaved,
				);
				setDischargeDate(
					saved.goal.dischargeDate,
				);
				setAiResult(
					plan.result,
				);
				setAnalyzedSignature(
					createSnapshotSignature(
						saved,
					),
				);
				setGeneratedAt(
					plan.generatedAt,
				);

				setAnalysisDurationMs(
					plan.analysisDurationMs ??
						null,
				);
			},
			[],
		);

	useEffect(() => {
		const loadInitialData =
			async () => {
				try {
					const [
						latestResult,
						profileResult,
					] =
						await Promise.allSettled(
							[
								getLatestSalaryPlan(),
								api.get(
									"/user/military-profile",
								),
							],
						);

					const latestPlan =
						latestResult.status ===
							"fulfilled"
							? latestResult.value
							: null;

					if (latestPlan) {
						applySavedPlan(
							latestPlan,
						);
					}

					if (
						profileResult.status ===
						"rejected"
					) {
						setProfileLinked(
							false,
						);
						setMilitaryBranch(
							null,
						);
						setMilitaryProfileStatus(
							"ERROR",
						);

						return;
					}

					const profile =
						unwrapApiData<
							MilitaryProfileApiData | null
						>(
							profileResult
								.value
								.data,
						);

					const displayRank =
						profile?.displayRank ??
						profile?.selectedRank;

					if (
						!profile?.branch ||
						!displayRank ||
						!profile.enlistmentDate ||
						!profile.dischargeDate
					) {
						setProfileLinked(
							false,
						);
						setMilitaryBranch(
							null,
						);
						setMilitaryProfileStatus(
							"MISSING",
						);

						return;
					}

					setProfileLinked(
						true,
					);
					setMilitaryProfileStatus(
						"CONFIGURED",
					);
					setMilitaryBranch(
						profile.branch ??
							null,
					);

					if (displayRank) {
						setRank(
							MILITARY_RANK_MAP[
								displayRank
							],
						);
					}

					if (
						profile.enlistmentDate
					) {
						setEnlistmentDate(
							profile.enlistmentDate.slice(
								0,
								10,
							),
						);
					}

					if (
						profile.dischargeDate
					) {
						setDischargeDate(
							profile.dischargeDate.slice(
								0,
								10,
							),
						);
					}
				} catch (error) {
					console.warn(
						"급여 플래너 초기 데이터 조회 실패:",
						error,
					);

					setProfileLinked(
						false,
					);
					setMilitaryBranch(
						null,
					);
					setMilitaryProfileStatus(
						"ERROR",
					);
				} finally {
					setIsInitialLoading(
						false,
					);
				}
			};

		void loadInitialData();
	}, [applySavedPlan]);

	const runAnalysis =
		useCallback(
			async (
				targetSnapshot:
					SalaryPlannerSnapshot,
				silent = false,
			) => {
				if (
					militaryProfileStatus !==
					"CONFIGURED"
				) {
					if (!silent) {
						toast({
							title:
								"군 프로필을 먼저 설정하세요.",
							description:
								"군종, 계급, 입대일과 전역 예정일을 불러온 뒤 플랜을 생성할 수 있습니다.",
							status:
								"warning",
							isClosable:
								true,
						});
					}

					return;
				}

				try {
					const activeExpenseCount =
						[
							...targetSnapshot.fixedItems,
							...targetSnapshot.variableItems,
						].filter(
							(item) =>
								item.amount > 0,
						).length;

					if (
						activeExpenseCount ===
						0
					) {
						if (!silent) {
							toast({
								title:
									"지출 금액을 먼저 입력하세요.",
								description:
									"소비패턴 분석을 위해 최소 한 개 이상의 실제 지출 금액이 필요합니다.",
								status:
									"warning",
								isClosable:
									true,
							});
						}

						return;
					}

					if (
						targetSnapshot.goal
							.targetAmount <= 0
					) {
						if (!silent) {
							toast({
								title:
									"목표 비용을 먼저 입력하세요.",
								description:
									"목표별 비용 항목을 조사해 하나 이상 입력해야 달성 가능성을 분석할 수 있습니다.",
								status:
									"warning",
								isClosable:
									true,
							});
						}

						return;
					}

					if (
						!targetSnapshot.enlistmentDate
					) {
						if (!silent) {
							toast({
								title:
									"입대일을 입력하세요.",
								description:
									"예상 진급과 계급별 급여를 반영하려면 입대일이 필요합니다.",
								status:
									"warning",
								isClosable:
									true,
							});
						}

						return;
					}

					setIsAiLoading(
						true,
					);

					const plan =
						await analyzeSalaryPlan(
							targetSnapshot,
						);

					setAiResult(
						plan.result,
					);
					setAnalyzedSignature(
						createSnapshotSignature(
							plan.snapshot,
						),
					);
					setGeneratedAt(
						plan.generatedAt,
					);

					setAnalysisDurationMs(
						plan.analysisDurationMs ??
							null,
					);

					if (!silent) {
						toast({
							title:
								"AI 플랜이 생성되었습니다.",
							description:
								"현재 소비 패턴과 전역 목표를 반영했습니다.",
							status:
								"success",
							isClosable:
								true,
						});
					}
				} catch (error) {
					console.error(
						"AI 플랜 생성 실패:",
						error,
					);

					if (!silent) {
						const message =
							(error as any)
								?.response
								?.data
								?.message ??
							"AI 분석 서버에 연결하지 못했습니다.";

						toast({
							title:
								"플랜을 생성하지 못했습니다.",
							description:
								message,
							status:
								"error",
							isClosable:
								true,
						});
					}
				} finally {
					setIsAiLoading(
						false,
					);
				}
			},
			[
				militaryProfileStatus,
				toast,
			],
		);


	const enableMonthlyTradingFunding =
		async () => {
			if (
				!aiResult ||
				aiResult.allocation
					.investmentPractice <= 0
			) {
				toast({
					title:
						"모의투자 학습 금액이 없습니다.",
					status: "warning",
					isClosable: true,
				});
				return;
			}

			try {
				setIsFundingTrading(true);

				const response = await api.post(
					"/trading/salary-plan-funding/enable",
				);

				const result =
					unwrapApiData<{
						funding?: {
							applied?: boolean;
							amount?: number;
						};
					}>(response.data);

				toast({
					title:
						result.funding?.applied
							? "이번 달 모의투자 자금이 입금되었습니다."
							: "월 모의투자 자동 입금이 설정되었습니다.",
					description:
						result.funding?.applied
							? `${formatCurrency(
								result.funding.amount ??
									aiResult.allocation
										.investmentPractice,
							)}이 국내 모의투자 계좌에 반영되었습니다.`
							: "다음 달 첫 거래소 접속 때 한 번만 자동 입금됩니다.",
					status: "success",
					isClosable: true,
				});

				navigate(
					"/exchange?market=KR",
				);
			} catch (error) {
				console.error(
					"월 모의투자 입금 설정 실패:",
					error,
				);

				toast({
					title:
						"모의투자 자금을 연결하지 못했습니다.",
					description:
						(error as any)?.response
							?.data?.message ??
						"서버 연결 상태를 확인하세요.",
					status: "error",
					isClosable: true,
				});
			} finally {
				setIsFundingTrading(false);
			}
		};


	const updateExpense =
		(
			kind: ExpenseKind,
			id: string,
			amount: number,
		) => {
			const setter =
				kind === "FIXED"
					? setFixedItems
					: setVariableItems;

			setter(
				(items) =>
					items.map(
						(item) =>
							item.id ===
							id
								? {
										...item,
										amount,
									}
								: item,
					),
			);
		};

	const removeExpense =
		(
			kind: ExpenseKind,
			id: string,
		) => {
			const setter =
				kind === "FIXED"
					? setFixedItems
					: setVariableItems;

			setter(
				(items) =>
					items.filter(
						(item) =>
							item.id !==
							id,
					),
			);
		};

	const addExpense =
		(kind: ExpenseKind) => {
			const label =
				window.prompt(
					kind === "FIXED"
						? "추가할 고정지출 항목명을 입력하세요."
						: "추가할 변동지출 항목명을 입력하세요.",
				);

			if (!label?.trim()) {
				return;
			}

			const item: ExpenseItem =
				{
					id: `${kind.toLowerCase()}-${Date.now()}`,
					label:
						label.trim(),
					amount: 0,
					kind,
				};

			if (kind === "FIXED") {
				setFixedItems(
					(items) => [
						...items,
						item,
					],
				);
			} else {
				setVariableItems(
					(items) => [
						...items,
						item,
					],
				);
			}
		};

	const addInlineExpense =
		() => {
			if (
				!newExpenseName.trim()
			) {
				toast({
					title:
						"지출 항목명을 입력하세요.",
					status:
						"warning",
					isClosable: true,
				});
				return;
			}

			const item: ExpenseItem =
				{
					id: `${newExpenseKind.toLowerCase()}-${Date.now()}`,
					label:
						newExpenseName.trim(),
					amount: 0,
					kind:
						newExpenseKind,
				};

			if (
				newExpenseKind ===
				"FIXED"
			) {
				setFixedItems(
					(items) => [
						...items,
						item,
					],
				);
			} else {
				setVariableItems(
					(items) => [
						...items,
						item,
					],
				);
			}

			setNewExpenseName("");
		};

	const updateGoalCostItem =
		(
			id: string,
			patch:
				Partial<
					GoalCostItem
				>,
		) => {
			setGoalCostItems(
				(items) =>
					items.map(
						(item) =>
							item.id ===
							id
								? {
										...item,
										...patch,
									}
								: item,
					),
			);
		};

	const removeGoalCostItem =
		(id: string) => {
			setGoalCostItems(
				(items) =>
					items.filter(
						(item) =>
							item.id !==
							id,
					),
			);
		};

	const addGoalCostItem =
		() => {
			setGoalCostItems(
				(items) => [
					...items,
					{
						id:
							`goal-cost-${Date.now()}`,
						label:
							"추가 비용",
						amount: 0,
					},
				],
			);
		};

	const selectGoal =
		(preset: GoalPreset) => {
			setGoalName(
				preset.label,
			);
			setGoalDescription(
				preset.description,
			);

			setGoalCostItems(
				preset.costLabels.map(
					(label, index) => ({
						id:
							`goal-cost-${Date.now()}-${index}`,
						label,
						amount: 0,
					}),
				),
			);
		};

	const resetInputs =
		() => {
			if (!profileLinked) {
				setRank("상병");
				setDischargeDate(
					createDefaultDischargeDate(),
				);
			}

			setMilitarySavings(0);
			setFixedItems(
				DEFAULT_FIXED_EXPENSES,
			);
			setVariableItems(
				DEFAULT_VARIABLE_EXPENSES,
			);
			setGoalName("");
			setGoalDescription("");
			setGoalCostItems([]);
			setCurrentSaved(0);
			setAiResult(null);
			setAnalyzedSignature("");
			setGeneratedAt("");
			setAnalysisDurationMs(
				null,
			);
		};

	const allocationTotal =
		aiResult
			? Math.max(
					1,
					aiResult.allocation
						.emergency +
						aiResult
							.allocation
							.goal +
						aiResult
							.allocation
							.investmentPractice +
						aiResult
							.allocation
							.flexible,
				)
			: 1;

	const goalPossible =
		goalAmount > 0 &&
		(snapshot.goal.goalGap ===
			0 ||
			snapshot.goal
				.monthlyGoalNeeded <=
				snapshot.remainingAmount);

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
					md: "34px",
				}}
			>
				<Flex
					mb="6"
					align={{
						base:
							"flex-start",
						md: "center",
					}}
					justify="space-between"
					direction={{
						base: "column",
						md: "row",
					}}
					gap="4"
				>
					<Box>
						<HStack
							mb="2"
							spacing="2"
						>
							<Badge
								colorScheme="army"
								px="3"
								py="1"
							>
								2026 병 봉급 기준
							</Badge>

							<Badge
								colorScheme="khaki"
								px="3"
								py="1"
							>
								전역 목표형 자산관리
							</Badge>
						</HStack>

						<Heading
							fontSize={{
								base:
									"28px",
								md: "36px",
							}}
							letterSpacing="-0.04em"
						>
							전역 자금 플래너
						</Heading>

						<Text
							mt="2"
							color="gray.600"
						>
							월급과 세부 소비를 기록하고, 전역 후 필요한 목표 자금을 준비합니다.
						</Text>
					</Box>

					<Button
						leftIcon={
							<RepeatIcon />
						}
						variant="outline"
						bg="white"
						onClick={
							resetInputs
						}
					>
						입력 초기화
					</Button>
				</Flex>

				{!isInitialLoading &&
					militaryProfileStatus !==
						"CONFIGURED" && (
						<Alert
							mb="6"
							status={
								militaryProfileStatus ===
								"ERROR"
									? "error"
									: "warning"
							}
							borderRadius="16px"
							alignItems="flex-start"
						>
							<AlertIcon mt="1" />

							<Flex
								flex="1"
								align={{
									base:
										"stretch",
									md:
										"center",
								}}
								justify="space-between"
								direction={{
									base:
										"column",
									md:
										"row",
								}}
								gap="4"
							>
								<Box>
									<Text fontWeight="900">
										{militaryProfileStatus ===
										"ERROR"
											? "군 프로필을 불러오지 못했습니다."
											: "군 프로필을 먼저 설정해 주세요."}
									</Text>

									<AlertDescription mt="1">
										군종, 계급, 입대일과 전역 예정일을 불러온 뒤 전역 자금 플랜을 생성할 수 있습니다.
									</AlertDescription>
								</Box>

								<Button
									flexShrink={0}
									colorScheme={
										militaryProfileStatus ===
										"ERROR"
											? "red"
											: "orange"
									}
									onClick={() =>
										navigate(
											"/mypage",
										)
									}
								>
									군 프로필 설정하기
								</Button>
							</Flex>
						</Alert>
					)}

				<Card
					mb="6"
					overflow="hidden"
					borderRadius="22px"
					color="white"
					bgGradient="linear(to-br, army.900, army.600)"
					boxShadow="0 18px 46px rgba(48, 60, 35, 0.24)"
				>
					<CardBody
						p={{
							base: "20px",
							md: "28px",
						}}
					>
						<Flex
							align={{
								base:
									"stretch",
								md:
									"flex-start",
							}}
							justify="space-between"
							direction={{
								base:
									"column",
								md: "row",
							}}
							gap="5"
						>
							<Box>
								<Heading size="lg">
									AI 전역 자금 플래너
								</Heading>

								<Text
									mt="2"
									maxW="760px"
									color="whiteAlpha.800"
								>
									입력한 고정지출과 변동지출의 구조를 분석해 소비 성향, 목표 달성 가능성과 권장 자금 비율을 제시합니다.
								</Text>

								<HStack
									mt="3"
									spacing="2"
									wrap="wrap"
								>
									{isInitialLoading ? (
										<Badge
											bg="whiteAlpha.200"
											color="white"
											px="3"
											py="1"
										>
											최근 플랜 확인 중
										</Badge>
									) : aiResult ? (
										<>
											<Badge
												bg={
													hasInputChanges
														? "orange.300"
														: "whiteAlpha.200"
												}
												color={
													hasInputChanges
														? "gray.900"
														: "white"
												}
												px="3"
												py="1"
											>
												{hasInputChanges
													? "입력 변경됨 · 다시 생성 필요"
													: "최근 분석 결과"}
											</Badge>

											{generatedAt && (
												<Text
													fontSize="xs"
													color="whiteAlpha.700"
												>
													{formatDateTime(
														generatedAt,
													)} 생성
													{analysisDurationMs !==
														null &&
														` · ${(analysisDurationMs / 1000).toFixed(
															1,
														)}초`}
												</Text>
											)}
										</>
									) : (
										<Badge
											bg="whiteAlpha.200"
											color="white"
											px="3"
											py="1"
										>
											분석 대기 중
										</Badge>
									)}
								</HStack>
							</Box>

							<Button
								bg="white"
								color="army.800"
								_hover={{
									bg:
										"whiteAlpha.900",
								}}
								isLoading={
									isAiLoading
								}
								isDisabled={
									isInitialLoading ||
									militaryProfileStatus !==
										"CONFIGURED"
								}
								loadingText="분석 중"
								onClick={() =>
									void runAnalysis(
										snapshot,
									)
								}
							>
								{aiResult
									? "플랜 다시 생성"
									: "AI 플랜 생성"}
							</Button>
						</Flex>

						{hasInputChanges && (
							<Alert
								mt="5"
								status="warning"
								borderRadius="12px"
								bg="whiteAlpha.200"
								color="white"
							>
								<AlertIcon color="orange.200" />

								<AlertDescription>
									입력값 또는 시뮬레이션 가정이 변경되었습니다. 현재 결과는 이전 플랜이며, 상단의 플랜 다시 생성 버튼을 눌러야 새 입력이 반영됩니다.
								</AlertDescription>
							</Alert>
						)}

						{isInitialLoading ? (
							<Flex
								mt="8"
								align="center"
								justify="center"
								minH="170px"
							>
								<Spinner />
							</Flex>
						) : (
							<SimpleGrid
								mt="6"
								columns={{
									base: 1,
									lg: 3,
								}}
								spacing="4"
							>
								{aiResult ? (
									<>
										<Box
											p="5"
											borderWidth="1px"
											borderColor="whiteAlpha.300"
											borderRadius="16px"
											bg="whiteAlpha.100"
											minH="190px"
										>
											<Text
												fontSize="xs"
												fontWeight="900"
												color="whiteAlpha.700"
											>
												소비 패턴 분석
											</Text>

											<HStack
												mt="3"
												spacing="2"
												wrap="wrap"
											>
												<Text
													fontSize="xl"
													fontWeight="900"
												>
													{
														aiResult
															.diagnosis
															.patternType
													}
												</Text>

												<Badge
													colorScheme={
														aiResult
															.diagnosis
															.riskLevel ===
														"HIGH"
															? "red"
															: aiResult
																		.diagnosis
																		.riskLevel ===
																  "MEDIUM"
																? "orange"
																: "green"
													}
												>
													{aiResult
														.diagnosis
														.riskLevel ===
													"HIGH"
														? "주의"
														: aiResult
																	.diagnosis
																	.riskLevel ===
															  "MEDIUM"
															? "점검"
															: "안정"}
												</Badge>
											</HStack>

											<Text
												mt="2"
												fontSize="sm"
												color="whiteAlpha.800"
											>
												{
													aiResult
														.diagnosis
														.summary
												}
											</Text>

											<Stack
												mt="3"
												spacing="1"
											>
												{aiResult.diagnosis.evidence
													.slice(
														0,
														2,
													)
													.map(
														(
															item,
														) => (
															<Text
																key={
																	item
																}
																fontSize="xs"
																color="whiteAlpha.700"
															>
																•{" "}
																{
																	item
																}
															</Text>
														),
													)}
											</Stack>
										</Box>

										<Box
											p="5"
											borderWidth="1px"
											borderColor="whiteAlpha.300"
											borderRadius="16px"
											bg="whiteAlpha.100"
											minH="190px"
										>
											<Text
												fontSize="xs"
												fontWeight="900"
												color="whiteAlpha.700"
											>
												전역 목표 가능성
											</Text>

											<Text
												mt="3"
												fontSize="xl"
												fontWeight="900"
											>
												{
													aiResult
														.goalAssessment
														.label
												}
											</Text>

											<Text
												mt="2"
												fontSize="sm"
												color="whiteAlpha.800"
											>
												{
													aiResult
														.goalAssessment
														.summary
												}
											</Text>
										</Box>

										<Box
											p="5"
											borderWidth="1px"
											borderColor="whiteAlpha.300"
											borderRadius="16px"
											bg="whiteAlpha.100"
											minH="190px"
										>
											<Text
												fontSize="xs"
												fontWeight="900"
												color="whiteAlpha.700"
											>
												이번 달 행동 플랜
											</Text>

											<Text
												mt="3"
												fontSize="xl"
												fontWeight="900"
											>
												{
													aiResult
														.monthlyPlan
														.headline
												}
											</Text>

											<Text
												mt="2"
												fontSize="sm"
												color="whiteAlpha.800"
											>
												{
													aiResult
														.monthlyPlan
														.summary
												}
											</Text>

											<Stack
												mt="3"
												spacing="2"
											>
												{aiResult.monthlyPlan.items
													.slice(
														0,
														3,
													)
													.map(
														(
															item,
														) => (
															<Flex
																key={`${item.type}-${item.title}`}
																align="center"
																justify="space-between"
																gap="3"
															>
																<Text
																	fontSize="xs"
																	color="whiteAlpha.800"
																	noOfLines={
																		1
																	}
																>
																	{
																		item.title
																	}
																</Text>

																<Text
																	fontSize="xs"
																	fontWeight="900"
																	whiteSpace="nowrap"
																>
																	{item.targetAmount >
																	0
																		? formatCurrency(
																				item.targetAmount,
																			)
																		: "유지"}
																</Text>
															</Flex>
														),
													)}
											</Stack>
										</Box>
									</>
								) : (
									<>
										<WaitingCard
											title="소비 패턴 분석"
											description="지출 항목과 금액을 입력한 뒤 플랜을 생성하면 소비 성향과 위험 요인을 분석합니다."
										/>

										<WaitingCard
											title="전역 목표 가능성"
											description="목표 금액을 직접 조사해 입력하면 현재 계획으로 가능한지 또는 불가능한지 계산합니다."
										/>

										<WaitingCard
											title="이번 달 행동 플랜"
											description="플랜 생성 전에는 지출 한도, 목표 저축액 또는 학습 예산을 임의로 추천하지 않습니다."
										/>
									</>
								)}
							</SimpleGrid>
						)}
					</CardBody>
				</Card>

				<Grid
					templateColumns={{
						base: "1fr",
						xl:
							"minmax(0, 1fr) 390px",
					}}
					gap="6"
					alignItems="start"
				>
					<GridItem minW={0}>
						<Stack spacing="6">
							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="army.200"
							>
								<CardHeader pb="0">
									<Flex
										justify="space-between"
										gap="3"
										wrap="wrap"
									>
										<Box>
											<Heading size="md">
												1. 군 프로필 및 장병적금
											</Heading>

											<Text
												mt="1"
												fontSize="sm"
												color="gray.500"
											>
												2026년 병 봉급과 사용자 군 프로필을 기준으로 계산합니다.
											</Text>
										</Box>

										{profileLinked && (
											<Badge
												colorScheme="green"
												px="3"
												py="1"
											>
												군 프로필 연동
											</Badge>
										)}
									</Flex>
								</CardHeader>

								<CardBody>
									{profileLinked && (
										<Flex
											mb="5"
											p="4"
											align={{
												base:
													"stretch",
												md:
													"center",
											}}
											justify="space-between"
											direction={{
												base:
													"column",
												md:
													"row",
											}}
											gap="4"
											borderRadius="14px"
											bg="green.50"
											borderWidth="1px"
											borderColor="green.200"
										>
											<Box>
												<Text
													fontSize="lg"
													fontWeight="900"
													color="green.900"
												>
													{militaryBranch
														? BRANCH_LABEL[
																militaryBranch
															]
														: "군종 미설정"}{" "}
													· {rank}
												</Text>

												<Text
													mt="1"
													fontSize="sm"
													color="green.800"
												>
													입대일{" "}
													{formatDateOnly(
														enlistmentDate,
													)}
													{" · "}전역 예정일{" "}
													{formatDateOnly(
														dischargeDate,
													)}
												</Text>

												<Text
													mt="1"
													fontSize="xs"
													fontWeight="800"
													color="green.700"
												>
													군 프로필에서 불러옴
												</Text>
											</Box>

											<Button
												size="sm"
												variant="outline"
												colorScheme="green"
												onClick={() =>
													navigate(
														"/mypage",
													)
												}
											>
												군 프로필 수정
											</Button>
										</Flex>
									)}

									<SimpleGrid
										columns={{
											base: 1,
											md: 3,
										}}
										spacing="5"
									>
										<FormControl>
											<FormLabel fontWeight="800">
												현재 계급
											</FormLabel>

											<Select
												value={
													rank
												}
												isDisabled={
													profileLinked
												}
												onChange={(
													event,
												) =>
													setRank(
														event
															.target
															.value as SoldierRank,
													)
												}
											>
												{(
													Object.keys(
														SALARY_BY_RANK,
													) as SoldierRank[]
												).map(
													(
														item,
													) => (
														<option
															key={
																item
															}
															value={
																item
															}
														>
															{item} ·{" "}
															{formatCurrency(
																SALARY_BY_RANK[
																	item
																],
															)}
														</option>
													),
												)}
											</Select>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												장병내일준비적금 월 납입액
											</FormLabel>

											<Select
												value={
													militarySavings
												}
												onChange={(
													event,
												) =>
													setMilitarySavings(
														Number(
															event
																.target
																.value,
														),
													)
												}
											>
												{SAVINGS_OPTIONS.map(
													(
														amount,
													) => (
														<option
															key={
																amount
															}
															value={
																amount
															}
														>
															{amount ===
															0
																? "납입하지 않음"
																: `${amount.toLocaleString(
																		"ko-KR",
																	)}원`}
														</option>
													),
												)}
											</Select>

											<FormHelperText>
												5만 원 단위로 실제 납입액을 선택하세요.
											</FormHelperText>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												지금까지 납입한 적금 원금
											</FormLabel>

											<MoneyInput
												value={
													existingMilitarySavingsPrincipal
												}
												placeholder="은행 앱의 누적 납입 원금"
												onChange={
													setExistingMilitarySavingsPrincipal
												}
											/>

											<FormHelperText>
												이미 납입한 원금만 입력하세요. 예상 이자와 매칭지원금은 제외합니다.
											</FormHelperText>
										</FormControl>
									</SimpleGrid>

									<Box
										mt="5"
										p="4"
										borderRadius="14px"
										bg="army.50"
										borderWidth="1px"
										borderColor="army.200"
									>
										<Flex
											mb="4"
											justify="space-between"
											align="center"
											gap="4"
											wrap="wrap"
										>
											<Box>
												<Text
													fontSize="sm"
													fontWeight="900"
													color="army.800"
												>
													{rank} 월 봉급
												</Text>

												<Text
													fontSize="xs"
													color="army.700"
												>
													2026년 기준
												</Text>
											</Box>

											<Text
												fontSize="26px"
												fontWeight="900"
												color="army.800"
											>
												{formatCurrency(
													monthlySalary,
												)}
											</Text>
										</Flex>

										<SimpleGrid
											columns={{
												base: 1,
												md: 4,
											}}
											spacing="3"
										>
											<Stat
												p="3"
												bg="white"
												borderRadius="12px"
											>
												<StatLabel>
													기납입 원금
												</StatLabel>
												<StatNumber fontSize="md">
													{formatCurrency(
														existingMilitarySavingsPrincipal,
													)}
												</StatNumber>
											</Stat>

											<Stat
												p="3"
												bg="white"
												borderRadius="12px"
											>
												<StatLabel>
													앞으로 납입 예정
												</StatLabel>
												<StatNumber fontSize="md">
													{formatCurrency(
														snapshot
															.goal
															.futureContributions,
													)}
												</StatNumber>
											</Stat>

											<Stat
												p="3"
												bg="white"
												borderRadius="12px"
											>
												<StatLabel>
													예상 매칭지원금
												</StatLabel>
												<StatNumber fontSize="md">
													{formatCurrency(
														snapshot
															.goal
															.projectedMatchingSupport,
													)}
												</StatNumber>
											</Stat>

											<Stat
												p="3"
												bg="white"
												borderRadius="12px"
											>
												<StatLabel>
													예상 적금 관련 자산
												</StatLabel>
												<StatNumber
													fontSize="md"
													color="army.800"
												>
													{formatCurrency(
														snapshot
															.goal
															.projectedMilitarySavings,
													)}
												</StatNumber>
											</Stat>
										</SimpleGrid>

										<Text
											mt="3"
											fontSize="xs"
											color="army.700"
										>
											은행 이자는 제외한 단순 예상이며, 매칭지원금은 만기 해지와 지원 요건 충족을 가정합니다.
										</Text>
									</Box>
								</CardBody>
							</Card>

							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="army.200"
							>
								<CardHeader pb="0">
									<Heading size="md">
										2. 세부 지출 입력
									</Heading>

									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										항목 예시는 제공하지만 금액은 모두 비워 두었습니다. 실제 지출만 입력하세요.
									</Text>
								</CardHeader>

								<CardBody>
									<Stack spacing="5">
										<ExpenseSection
											title="고정지출"
											description="매월 비슷하게 반복되는 통신비, 구독, 송금, 회비 등"
											kind="FIXED"
											items={
												fixedItems
											}
											total={
												fixedExpenses
											}
											onChange={(
												id,
												amount,
											) =>
												updateExpense(
													"FIXED",
													id,
													amount,
												)
											}
											onRemove={(
												id,
											) =>
												removeExpense(
													"FIXED",
													id,
												)
											}
											onAdd={
												addExpense
											}
										/>

										<ExpenseSection
											title="변동지출"
											description="PX, 외출, 식비, 취미처럼 월마다 달라지는 지출"
											kind="VARIABLE"
											items={
												variableItems
											}
											total={
												variableExpenses
											}
											onChange={(
												id,
												amount,
											) =>
												updateExpense(
													"VARIABLE",
													id,
													amount,
												)
											}
											onRemove={(
												id,
											) =>
												removeExpense(
													"VARIABLE",
													id,
												)
											}
											onAdd={
												addExpense
											}
										/>

										<Box
											p="4"
											borderWidth="1px"
											borderStyle="dashed"
											borderColor="khaki.300"
											borderRadius="14px"
											bg="khaki.50"
										>
											<Text
												mb="3"
												fontSize="sm"
												fontWeight="900"
											>
												사용자 지출 항목 추가
											</Text>

											<Grid
												templateColumns={{
													base:
														"1fr",
													md:
														"140px 1fr auto",
												}}
												gap="3"
											>
												<Select
													value={
														newExpenseKind
													}
													onChange={(
														event,
													) =>
														setNewExpenseKind(
															event
																.target
																.value as ExpenseKind,
														)
													}
												>
													<option value="FIXED">
														고정지출
													</option>
													<option value="VARIABLE">
														변동지출
													</option>
												</Select>

												<Input
													value={
														newExpenseName
													}
													placeholder="예: 부대 내 정기 세탁비"
													onChange={(
														event,
													) =>
														setNewExpenseName(
															event
																.target
																.value,
														)
													}
													onKeyDown={(
														event,
													) => {
														if (
															event.key ===
															"Enter"
														) {
															addInlineExpense();
														}
													}}
												/>

												<Button
													colorScheme="army"
													leftIcon={
														<AddIcon />
													}
													onClick={
														addInlineExpense
													}
												>
													추가
												</Button>
											</Grid>
										</Box>
									</Stack>
								</CardBody>
							</Card>

							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="army.200"
							>
								<CardHeader pb="0">
									<Heading size="md">
										3. 전역 목표 설정
									</Heading>

									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										목표 종류만 선택한 뒤 실제 필요한 금액은 직접 조사해 입력합니다.
									</Text>
								</CardHeader>

								<CardBody>
									<HStack
										mb="5"
										spacing="2"
										wrap="wrap"
									>
										{GOAL_PRESETS.map(
											(
												preset,
											) => (
												<Button
													key={
														preset.label
													}
													size="sm"
													variant={
														goalName ===
														preset.label
															? "solid"
															: "outline"
													}
													colorScheme="army"
													onClick={() =>
														selectGoal(
															preset,
														)
													}
												>
													{
														preset.label
													}
												</Button>
											),
										)}

										<Button
											size="sm"
											variant={
												goalName &&
												!selectedGoalPreset
													? "solid"
													: "outline"
											}
											colorScheme="khaki"
											onClick={() => {
												setGoalName(
													"",
												);
												setGoalDescription(
													"",
												);
												setGoalCostItems(
													[
														{
															id:
																`goal-cost-${Date.now()}`,
															label:
																"목표 비용",
															amount:
																0,
														},
													],
												);
											}}
										>
											직접 입력
										</Button>
									</HStack>

									{selectedGoalPreset && (
										<Box
											mb="5"
											p="4"
											borderRadius="14px"
											bg="khaki.50"
											borderWidth="1px"
											borderColor="khaki.200"
										>
											<Text
												fontWeight="900"
												color="khaki.800"
											>
												{
													selectedGoalPreset.label
												}
											</Text>

											<Text
												mt="1"
												fontSize="sm"
												color="gray.700"
											>
												{
													selectedGoalPreset.description
												}
											</Text>

											<Text
												mt="3"
												fontSize="sm"
												fontWeight="800"
												color="khaki.700"
											>
												금액 조사 방법
											</Text>

											<Text
												mt="1"
												fontSize="sm"
												color="gray.600"
											>
												{
													selectedGoalPreset.researchGuide
												}
											</Text>
										</Box>
									)}

									<SimpleGrid
										columns={{
											base: 1,
											md: 2,
										}}
										spacing="5"
									>
										<FormControl>
											<FormLabel fontWeight="800">
												목표 이름
											</FormLabel>

											<Input
												value={
													goalName
												}
												placeholder="예: 일본 7일 전역 여행"
												onChange={(
													event,
												) => {
													setGoalName(
														event
															.target
															.value,
													);
													setGoalDescription(
														"",
													);
												}}
											/>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												목표 비용 구성
											</FormLabel>

											<Stack
												spacing="3"
												p="4"
												borderWidth="1px"
												borderColor="army.200"
												borderRadius="14px"
												bg="army.50"
											>
												{goalCostItems.length ===
												0 ? (
													<Text
														fontSize="sm"
														color="gray.600"
													>
														목표 유형을 선택하거나 직접 입력을 눌러 비용 항목을 추가하세요.
													</Text>
												) : (
													goalCostItems.map(
														(
															item,
														) => (
															<Grid
																key={
																	item.id
																}
																templateColumns={{
																	base:
																		"1fr",
																	md:
																		"1fr 190px auto",
																}}
																gap="2"
															>
																<Input
																	value={
																		item.label
																	}
																	placeholder="비용 항목"
																	onChange={(
																		event,
																	) =>
																		updateGoalCostItem(
																			item.id,
																			{
																				label:
																					event
																						.target
																						.value,
																			},
																		)
																	}
																/>

																<MoneyInput
																	value={
																		item.amount
																	}
																	placeholder="조사한 금액"
																	onChange={(
																		value,
																	) =>
																		updateGoalCostItem(
																			item.id,
																			{
																				amount:
																					value,
																			},
																		)
																	}
																/>

																<Button
																	variant="ghost"
																	colorScheme="red"
																	leftIcon={
																		<DeleteIcon />
																	}
																	onClick={() =>
																		removeGoalCostItem(
																			item.id,
																		)
																	}
																>
																	삭제
																</Button>
															</Grid>
														),
													)
												)}

												<Button
													size="sm"
													variant="outline"
													colorScheme="army"
													leftIcon={
														<AddIcon />
													}
													onClick={
														addGoalCostItem
													}
												>
													비용 항목 추가
												</Button>

												<Flex
													pt="3"
													borderTopWidth="1px"
													borderColor="army.200"
													align="center"
													justify="space-between"
												>
													<Text
														fontSize="sm"
														fontWeight="800"
													>
														조사한 목표 금액 합계
													</Text>

													<Text
														fontSize="xl"
														fontWeight="900"
														color="army.800"
													>
														{formatCurrency(
															goalAmount,
														)}
													</Text>
												</Flex>
											</Stack>

											<FormHelperText>
												시스템이 가격을 임의로 정하지 않으며, 입력한 항목 합계만 사용합니다.
											</FormHelperText>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												일반 보유 자금 · 선택
											</FormLabel>

											<MoneyInput
												value={
													currentSaved
												}
												onChange={
													setCurrentSaved
												}
											/>

											<FormHelperText>
												적금 누적 납입액을 제외한 현금성 보유 자금만 입력하세요.
											</FormHelperText>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												전역 예정일
											</FormLabel>

											<Input
												type="date"
												value={
													dischargeDate
												}
												isDisabled={
													profileLinked
												}
												onChange={(
													event,
												) =>
													setDischargeDate(
														event
															.target
															.value,
													)
												}
											/>
										</FormControl>
									</SimpleGrid>

									<SimpleGrid
										mt="5"
										columns={{
											base: 1,
											md: 3,
										}}
										spacing="4"
									>
										<Stat
											p="4"
											borderRadius="14px"
											bg="gray.50"
										>
											<StatLabel>
												전역까지 남은 기간
											</StatLabel>
											<StatNumber fontSize="xl">
												{snapshot
													.goal
													.monthsLeft}
												개월
											</StatNumber>
										</Stat>

										<Stat
											p="4"
											borderRadius="14px"
											bg="gray.50"
										>
											<StatLabel>
												예상 적금·매칭 합계
											</StatLabel>
											<StatNumber fontSize="xl">
												{formatCurrency(
													snapshot
														.goal
														.projectedMilitarySavings,
												)}
											</StatNumber>
										</Stat>

										<Stat
											p="4"
											borderRadius="14px"
											bg="gray.50"
										>
											<StatLabel>
												월 추가 목표 저축액
											</StatLabel>
											<StatNumber fontSize="xl">
												{goalAmount >
												0
													? formatCurrency(
															snapshot
																.goal
																.monthlyGoalNeeded,
														)
													: "-"}
											</StatNumber>
										</Stat>
									</SimpleGrid>

									<Alert
										mt="5"
										status={
											goalAmount ===
											0
												? "info"
												: goalPossible
													? "success"
													: "warning"
										}
										borderRadius="12px"
									>
										<AlertIcon />
										<AlertDescription>
											{goalAmount ===
											0
												? "목표 금액을 직접 조사해 입력하면 달성 가능 여부를 계산합니다."
												: goalPossible
													? `현재 계획으로 ${goalName || "전역 목표"} 달성이 가능합니다.`
													: `현재 계획으로는 ${goalName || "전역 목표"} 달성이 불가능합니다. 월 ${formatCurrency(
															Math.max(
																0,
																snapshot
																	.goal
																	.monthlyGoalNeeded -
																	snapshot
																		.remainingAmount,
															),
														)}이 추가로 필요합니다.`}
										</AlertDescription>
									</Alert>
								</CardBody>
							</Card>

							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="army.200"
							>
								<CardHeader pb="0">
									<Heading size="md">
										4. 복무 기간 자금 시뮬레이션
									</Heading>

									<Text
										mt="1"
										fontSize="sm"
										color="gray.500"
									>
										입대일을 기준으로 예상 진급과 계급별 봉급을 반영하고, 급여 상승분 중 얼마를 소비로 늘릴지 선택해 비교합니다.
									</Text>
								</CardHeader>

								<CardBody>
									<SimpleGrid
										mb="5"
										columns={{
											base: 1,
											md: 2,
										}}
										spacing="4"
									>
										<FormControl>
											<FormLabel fontWeight="800">
												입대일
											</FormLabel>

											<Input
												type="date"
												value={
													enlistmentDate
												}
												isDisabled={
													profileLinked
												}
												onChange={(
													event,
												) =>
													setEnlistmentDate(
														event.target.value,
													)
												}
											/>

											<FormHelperText>
												계급별 예상 급여 구간을 계산하는 기준입니다.
											</FormHelperText>
										</FormControl>

										<FormControl>
											<FormLabel fontWeight="800">
												진급 후 급여 상승분 소비 반영
											</FormLabel>

											<Select
												value={
													promotionSpendingRate
												}
												onChange={(
													event,
												) =>
													setPromotionSpendingRate(
														Number(
															event.target.value,
														),
													)
												}
											>
												<option value={0}>
													0% · 상승분 전액 보유
												</option>
												<option value={0.3}>
													30% · 절약형
												</option>
												<option value={0.5}>
													50% · 균형형
												</option>
												<option value={0.7}>
													70% · 소비 증가형
												</option>
												<option value={1}>
													100% · 상승분 전액 소비
												</option>
											</Select>

											<FormHelperText>
												진급한다고 무조건 같은 금액을 더 쓰는 것은 아니므로, 급여 상승분 중 소비로 늘어날 비율을 직접 선택합니다.
											</FormHelperText>
										</FormControl>
									</SimpleGrid>

									{aiResult ? (
										<>
											<SimpleGrid
												columns={{
													base: 1,
													md: 3,
												}}
												spacing="4"
											>
												<Stat
													p="4"
													borderRadius="14px"
													bg="gray.50"
												>
													<StatLabel>
														확정 저축 경로
													</StatLabel>

													<StatNumber fontSize="xl">
														{formatCurrency(
															aiResult
																.projection
																.confirmedAssetsAtDischarge,
														)}
													</StatNumber>

													<Text
														mt="1"
														fontSize="xs"
														color="gray.500"
													>
														현재 보유금과 적금·매칭 예상액
													</Text>
												</Stat>

												<Stat
													p="4"
													borderRadius="14px"
													bg="khaki.50"
												>
													<StatLabel>
														현재 소비 유지
													</StatLabel>

													<StatNumber fontSize="xl">
														{formatCurrency(
															aiResult
																.projection
																.baselineAssetsAtDischarge,
														)}
													</StatNumber>

													<Text
														mt="1"
														fontSize="xs"
														color="gray.500"
													>
														월 잔여금을 보유한다고 가정
													</Text>
												</Stat>

												<Stat
													p="4"
													borderRadius="14px"
													bg="army.50"
												>
													<StatLabel>
														행동 플랜 적용
													</StatLabel>

													<StatNumber
														fontSize="xl"
														color="army.800"
													>
														{formatCurrency(
															aiResult
																.projection
																.actionPlanAssetsAtDischarge,
														)}
													</StatNumber>

													<Text
														mt="1"
														fontSize="xs"
														color="army.700"
													>
														추가 확보{" "}
														{formatCurrency(
															aiResult
																.projection
																.additionalSecured,
														)}
													</Text>
												</Stat>
											</SimpleGrid>

											<Alert
												mt="5"
												status={
													aiResult
														.projection
														.actionPlanGoalBalance >=
													0
														? "success"
														: "warning"
												}
												borderRadius="12px"
											>
												<AlertIcon />

												<AlertDescription>
													{aiResult
														.projection
														.actionPlanGoalBalance >=
													0
														? `행동 플랜을 유지하면 목표 금액보다 ${formatCurrency(
																aiResult
																	.projection
																	.actionPlanGoalBalance,
															)}의 여유를 확보할 수 있습니다.`
														: `행동 플랜을 적용해도 목표까지 ${formatCurrency(
																Math.abs(
																	aiResult
																		.projection
																		.actionPlanGoalBalance,
																),
															)}이 부족합니다.`}
												</AlertDescription>
											</Alert>

											<Box
												mt="5"
												overflowX="auto"
											>
												<Text
													mb="3"
													fontSize="sm"
													fontWeight="900"
												>
													계급별 예상 월 현금흐름
												</Text>

												<Box
													minW="620px"
													borderWidth="1px"
													borderColor="army.200"
													borderRadius="12px"
													overflow="hidden"
												>
													<Grid
														templateColumns="0.8fr 0.7fr 1.2fr 1.2fr 1.2fr"
														px="4"
														py="3"
														bg="army.50"
														fontSize="xs"
														fontWeight="900"
													>
														<Text>계급</Text>
														<Text>예상 개월</Text>
														<Text textAlign="right">
															월 봉급
														</Text>
														<Text textAlign="right">
															예상 월 지출
														</Text>
														<Text textAlign="right">
															예상 월 잔여
														</Text>
													</Grid>

													{Array.isArray(
														aiResult
															.projection
															.rankSegments,
													) &&
													aiResult.projection
														.rankSegments
														.length >
														0 ? (
														aiResult.projection.rankSegments.map(
															(
																segment,
															) => (
																<Grid
																	key={
																		segment.rank
																	}
																	templateColumns="0.8fr 0.7fr 1.2fr 1.2fr 1.2fr"
																	px="4"
																	py="3"
																	borderTopWidth="1px"
																	borderColor="gray.200"
																	fontSize="sm"
																>
																	<Text fontWeight="800">
																		{
																			segment.rank
																		}
																	</Text>

																	<Text>
																		{
																			segment.months
																		}
																		개월
																	</Text>

																	<Text textAlign="right">
																		{formatCurrency(
																			segment.monthlySalary,
																		)}
																	</Text>

																	<Text textAlign="right">
																		{formatCurrency(
																			segment.estimatedMonthlyExpenses,
																		)}
																	</Text>

																	<Text
																		textAlign="right"
																		fontWeight="900"
																		color={
																			segment.estimatedMonthlyRemaining >=
																			0
																				? "green.600"
																				: "red.500"
																		}
																	>
																		{formatCurrency(
																			segment.estimatedMonthlyRemaining,
																		)}
																	</Text>
																</Grid>
															),
														)
													) : (
														<Box
															px="4"
															py="5"
															borderTopWidth="1px"
															borderColor="gray.200"
															bg="orange.50"
														>
															<Text
																fontSize="sm"
																fontWeight="800"
																color="orange.700"
															>
																이전 버전 분석 결과입니다.
															</Text>

															<Text
																mt="1"
																fontSize="xs"
																color="gray.600"
															>
																입대일과 소비 반영률을 확인한 뒤 플랜 다시 생성을 눌러 계급별 예측을 갱신하세요.
															</Text>
														</Box>
													)}
												</Box>
											</Box>

											<Text
												mt="3"
												fontSize="xs"
												color="gray.500"
											>
												육군 18개월 표준 진급 구간을 이용한 예상치입니다. 실제 진급일, 조기진급, 진급누락 및 군별 복무기간에 따라 달라질 수 있습니다. 진급 후 소비 증가는 사용자가 선택한 가정이며 실제 소비를 단정하지 않습니다.
											</Text>
										</>
									) : (
										<Box
											p="5"
											borderWidth="1px"
											borderStyle="dashed"
											borderColor="army.300"
											borderRadius="14px"
											bg="army.50"
										>
											<Text
												fontWeight="900"
												color="army.800"
											>
												시뮬레이션 대기 중
											</Text>

											<Text
												mt="2"
												fontSize="sm"
												color="gray.600"
											>
												AI 플랜을 생성하면 현재 소비 유지 시나리오와 행동 플랜 적용 시나리오를 비교합니다.
											</Text>
										</Box>
									)}
								</CardBody>
							</Card>
						</Stack>
					</GridItem>

					<GridItem>
						<Box
							position={{
								base:
									"static",
								xl: "sticky",
							}}
							top="20px"
						>
							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="army.200"
								boxShadow="lg"
							>
								<CardHeader pb="0">
									<Flex
										align="center"
										justify="space-between"
									>
										<Heading size="md">
											월간 자금 상황
										</Heading>

										<Badge
											colorScheme="green"
										>
											실시간 계산
										</Badge>
									</Flex>
								</CardHeader>

								<CardBody>
									<Box
										p="5"
										borderRadius="16px"
										bgGradient="linear(to-br, khaki.50, army.50)"
									>
										<Text
											fontSize="sm"
											color="gray.600"
										>
											월 잔여금
										</Text>

										<Text
											mt="1"
											fontSize="32px"
											fontWeight="900"
											letterSpacing="-0.04em"
											color={
												snapshot.overspendAmount >
												0
													? "red.500"
													: "gray.900"
											}
										>
											{snapshot.overspendAmount >
											0
												? `-${formatCurrency(
														snapshot
															.overspendAmount,
													)}`
												: formatCurrency(
														snapshot
															.remainingAmount,
													)}
										</Text>
									</Box>

									<Stack
										mt="5"
										spacing="3"
									>
										<Flex justify="space-between">
											<Text
												fontSize="sm"
												color="gray.500"
											>
												월 급여
											</Text>

											<Text fontWeight="900">
												{formatCurrency(
													monthlySalary,
												)}
											</Text>
										</Flex>

										<Flex justify="space-between">
											<Text
												fontSize="sm"
												color="gray.500"
											>
												장병적금
											</Text>

											<Text fontWeight="900">
												{formatCurrency(
													militarySavings,
												)}
											</Text>
										</Flex>

										<Flex justify="space-between">
											<Text
												fontSize="sm"
												color="gray.500"
											>
												고정지출
											</Text>

											<Text fontWeight="900">
												{formatCurrency(
													fixedExpenses,
												)}
											</Text>
										</Flex>

										<Flex justify="space-between">
											<Text
												fontSize="sm"
												color="gray.500"
											>
												변동지출
											</Text>

											<Text fontWeight="900">
												{formatCurrency(
													variableExpenses,
												)}
											</Text>
										</Flex>
									</Stack>

									<Divider my="5" />

									<Text
										mb="3"
										fontSize="sm"
										fontWeight="900"
									>
										현재 비율
									</Text>

									<Stack spacing="4">
										<RatioProgress
											label="저축률"
											value={
												snapshot
													.actualRatios
													.savings
											}
											colorScheme="blue"
										/>

										<RatioProgress
											label="지출률"
											value={
												snapshot
													.actualRatios
													.expenses
											}
											colorScheme="red"
										/>

										<RatioProgress
											label="잔여금 비율"
											value={
												snapshot
													.actualRatios
													.remaining
											}
											colorScheme="green"
										/>
									</Stack>

									<Divider my="5" />

									{aiResult ? (
										<>
											<Text
												mb="3"
												fontSize="sm"
												fontWeight="900"
											>
												AI 권장 비율 · 보조 지표
											</Text>

											<Stack spacing="4">
												<RatioProgress
													label="권장 저축률"
													value={
														aiResult
															.recommendedRatios
															.savings
													}
													colorScheme="army"
												/>

												<RatioProgress
													label="권장 지출률"
													value={
														aiResult
															.recommendedRatios
															.expenses
													}
													colorScheme="orange"
												/>

												<RatioProgress
													label="권장 자유 잔여율"
													value={
														aiResult
															.recommendedRatios
															.remaining
													}
													colorScheme="khaki"
												/>
											</Stack>

											<Divider my="5" />

											<Text
												mb="3"
												fontSize="sm"
												fontWeight="900"
											>
												잔여금 권장 배분
											</Text>

											<Flex
												h="9px"
												mb="4"
												overflow="hidden"
												borderRadius="full"
												bg="gray.100"
											>
												<Box
													bg="field.500"
													w={`${(aiResult.allocation.emergency / allocationTotal) * 100}%`}
												/>

												<Box
													bg="army.500"
													w={`${(aiResult.allocation.goal / allocationTotal) * 100}%`}
												/>

												<Box
													bg="blue.500"
													w={`${(aiResult.allocation.investmentPractice / allocationTotal) * 100}%`}
												/>

												<Box
													bg="khaki.500"
													w={`${(aiResult.allocation.flexible / allocationTotal) * 100}%`}
												/>
											</Flex>

											<Stack spacing="3">
												<Flex justify="space-between">
													<Text fontSize="sm">
														비상금
													</Text>
													<Text fontWeight="900">
														{formatCurrency(
															aiResult
																.allocation
																.emergency,
														)}
													</Text>
												</Flex>

												<Flex justify="space-between">
													<Text fontSize="sm">
														전역 목표 저축
													</Text>
													<Text fontWeight="900">
														{formatCurrency(
															aiResult
																.allocation
																.goal,
														)}
													</Text>
												</Flex>

												<Flex justify="space-between">
													<Text fontSize="sm">
														모의투자·금융학습
													</Text>

													<Text fontWeight="900">
														{formatCurrency(
															aiResult
																.allocation
																.investmentPractice,
														)}
													</Text>
												</Flex>

												<Flex justify="space-between">
													<Text fontSize="sm">
														자기계발·자유지출
													</Text>
													<Text fontWeight="900">
														{formatCurrency(
															aiResult
																.allocation
																.flexible,
														)}
													</Text>
												</Flex>
											</Stack>

											<Box
												mt="4"
												p="3"
												borderRadius="12px"
												bg="gray.50"
											>
												<Text
													fontSize="xs"
													color="gray.600"
													lineHeight="1.7"
												>
													{
														aiResult
															.allocationReason
													}
												</Text>
											</Box>

											{aiResult
												.allocation
												.investmentPractice >
												0 && (
												<Box
													mt="4"
													p="4"
													borderWidth="1px"
													borderColor="blue.200"
													borderRadius="14px"
													bg="blue.50"
												>
													<Text
														fontSize="sm"
														fontWeight="900"
														color="blue.800"
													>
														모의투자로 금융 판단 연습
													</Text>

													<Text
														mt="1"
														fontSize="xs"
														color="blue.700"
														lineHeight="1.7"
													>
														실제 투자 권유가 아니라, 월{" "}
														{formatCurrency(
															aiResult
																.allocation
																.investmentPractice,
														)}을 가상 기준금으로 설정해 매수·매도 판단을 연습하는 방식입니다.
													</Text>

													<Button
														mt="3"
														w="full"
														size="sm"
														colorScheme="blue"
														onClick={() =>
															void enableMonthlyTradingFunding()
														}
														isLoading={
															isFundingTrading
														}
														loadingText="계좌 반영 중"
													>
														매월 이 금액으로 모의투자 시작
													</Button>
												</Box>
											)}

											<Divider my="5" />

											<Text
												mb="3"
												fontSize="sm"
												fontWeight="900"
											>
												실행 제안
											</Text>

											<Stack spacing="3">
												{aiResult.actions.map(
													(
														action,
														index,
													) => (
														<Flex
															key={`${action}-${index}`}
															gap="3"
															align="flex-start"
														>
															<Box
																mt="7px"
																w="7px"
																h="7px"
																flexShrink={
																	0
																}
																borderRadius="full"
																bg="army.500"
															/>
															<Text fontSize="sm">
																{action}
															</Text>
														</Flex>
													),
												)}
											</Stack>
										</>
									) : (
										<Box
											p="4"
											borderWidth="1px"
											borderStyle="dashed"
											borderColor="army.300"
											borderRadius="14px"
											bg="army.50"
										>
											<Text
												fontSize="sm"
												fontWeight="900"
												color="army.800"
											>
												AI 결과 없음
											</Text>

											<Text
												mt="2"
												fontSize="sm"
												color="gray.600"
											>
												상단의 AI 플랜 생성 버튼을 누르기 전에는 권장 비율과 배분안을 표시하지 않습니다.
											</Text>
										</Box>
									)}

									<Alert
										mt="5"
										status="info"
										borderRadius="12px"
										fontSize="xs"
									>
										<AlertIcon />
										<AlertDescription>
											분석 결과는 금융 교육과 소비 습관 점검을 위한 참고 정보입니다.
										</AlertDescription>
									</Alert>
								</CardBody>
							</Card>
						</Box>
					</GridItem>
				</Grid>
			</Box>
		</Box>
	);
}
