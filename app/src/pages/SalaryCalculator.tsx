import React, { useEffect, useMemo, useState } from "react";
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Divider,
	Flex,
	FormControl,
	FormHelperText,
	FormLabel,
	Grid,
	Heading,
	HStack,
	NumberInput,
	NumberInputField,
	Progress,
	Select,
	SimpleGrid,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Text,
} from "@chakra-ui/react";
import AssetAdvicePanel from "../components/salary/AssetAdvicePanel";
import { useNavigate } from "react-router-dom";

import api from "../services/api.service";

type SoldierRank = "이병" | "일병" | "상병" | "병장";
type RankSelection = SoldierRank | "";
type MilitaryRank =
	| "PRIVATE"
	| "PRIVATE_FIRST_CLASS"
	| "CORPORAL"
	| "SERGEANT";

interface MilitaryProfileResponse {
	configured: boolean;
	profile: {
		displayRank: MilitaryRank;
		rankMode: "AUTO" | "MANUAL";
	} | null;
}
interface SalaryInputProps {
	label: string;
	description: string;
	value: number;
	max: number;
	isDisabled?: boolean;
	onChange: (value: number) => void;
}


const SALARY_STANDARD_YEAR = 2026;

const SALARY_BY_RANK: Record<SoldierRank, number> = {
	이병: 750_000,
	일병: 900_000,
	상병: 1_200_000,
	병장: 1_500_000,
};
const MILITARY_RANK_TO_SOLDIER_RANK: Record<
	MilitaryRank,
	SoldierRank
> = {
	PRIVATE: "이병",
	PRIVATE_FIRST_CLASS: "일병",
	CORPORAL: "상병",
	SERGEANT: "병장",
};
const SAVINGS_OPTIONS = Array.from(
	{ length: 12 },
	(_, index) => index * 50_000,
);

const currencyFormatter = new Intl.NumberFormat("ko-KR");

function formatCurrency(value: number): string {
	const safeValue = Number.isFinite(value) ? value : 0;

	return `${currencyFormatter.format(Math.round(safeValue))}원`;
}

function formatPercent(value: number): string {
	const safeValue = Number.isFinite(value) ? value : 0;

	return `${safeValue.toFixed(1)}%`;
}

function SalaryInput({
	label,
	description,
	value,
	max,
	isDisabled = false,
	onChange,
}: SalaryInputProps) {
	const safeMax = Number.isFinite(max)
		? Math.max(0, max)
		: 0;

	const safeValue = Number.isFinite(value)
		? Math.max(0, Math.min(safeMax, value))
		: 0;

	return (
		<FormControl isDisabled={isDisabled}>
			<FormLabel mb="2" fontSize="sm" fontWeight="800">
				{label}
			</FormLabel>

			<HStack spacing="2">
				<NumberInput
					flex="1"
					min={0}
					max={safeMax}
					value={safeValue}
					clampValueOnBlur
					keepWithinRange
					isDisabled={isDisabled}
					onChange={(_, valueAsNumber) => {
						const parsedValue = Number.isFinite(valueAsNumber)
							? valueAsNumber
							: 0;

						onChange(
							Math.max(
								0,
								Math.min(safeMax, parsedValue),
							),
						);
					}}
				>
					<NumberInputField
						h="46px"
						borderRadius="10px"
						textAlign="right"
						fontWeight="700"
						placeholder="0"
						_focusVisible={{
							borderColor: "blue.500",
							boxShadow:
								"0 0 0 1px var(--chakra-colors-blue-500)",
						}}
					/>
				</NumberInput>

				<Text
					w="26px"
					fontSize="sm"
					fontWeight="700"
					color="gray.600"
				>
					원
				</Text>
			</HStack>

			<FormHelperText mt="2" fontSize="xs" color="gray.500">
				{description}

				{!isDisabled && (
					<>
						{" "}
						· 최대 {formatCurrency(safeMax)}
					</>
				)}
			</FormHelperText>
		</FormControl>
	);
}


export default function SalaryCalculator() {
	const [rank, setRank] = useState<RankSelection>("");
	const [savingsAmount, setSavingsAmount] = useState(0);
	const [fixedExpense, setFixedExpense] = useState(0);
	const [variableExpense, setVariableExpense] = useState(0);
	const navigate = useNavigate();

	const [profileRank, setProfileRank] =
		useState<SoldierRank | null>(null);

	const [isProfileLoading, setIsProfileLoading] =
		useState(true);

	const [hasMilitaryProfile, setHasMilitaryProfile] =
		useState(false);

	const monthlySalary = rank ? SALARY_BY_RANK[rank] : 0;
	const spendableBudget = Math.max(
		0,
		monthlySalary - savingsAmount,
	);

	const fixedExpenseMax = Math.max(
		0,
		spendableBudget - variableExpense,
	);

	const variableExpenseMax = Math.max(
		0,
		spendableBudget - fixedExpense,
	);
	useEffect(() => {
		const loadMilitaryProfile = async () => {
			try {
				setIsProfileLoading(true);

				const response =
					await api.get<MilitaryProfileResponse>(
						"/user/military-profile",
					);

				const profile = response.data.profile;

				if (
					response.data.configured &&
					profile
				) {
					const mappedRank =
						MILITARY_RANK_TO_SOLDIER_RANK[
						profile.displayRank
						];

					setProfileRank(mappedRank);
					setRank(mappedRank);
					setHasMilitaryProfile(true);
				} else {
					setProfileRank(null);
					setHasMilitaryProfile(false);
				}
			} catch (error) {
				console.error(
					"군 프로필 계급 조회 실패:",
					error,
				);

				setProfileRank(null);
				setHasMilitaryProfile(false);
			} finally {
				setIsProfileLoading(false);
			}
		};

		void loadMilitaryProfile();
	}, []);
	useEffect(() => {
		const budget = Math.max(0, monthlySalary - savingsAmount);

		if (fixedExpense > budget) {
			setFixedExpense(budget);
			setVariableExpense(0);
			return;
		}

		const availableForVariable = Math.max(
			0,
			budget - fixedExpense,
		);

		if (variableExpense > availableForVariable) {
			setVariableExpense(availableForVariable);
		}
	}, [
		monthlySalary,
		savingsAmount,
		fixedExpense,
		variableExpense,
	]);

	const result = useMemo(() => {
		const totalExpense = fixedExpense + variableExpense;
		const totalOutflow = savingsAmount + totalExpense;
		const remainingAmount = monthlySalary - totalOutflow;

		const savingsRate =
			monthlySalary > 0
				? (savingsAmount / monthlySalary) * 100
				: 0;

		const fixedExpenseRate =
			monthlySalary > 0
				? (fixedExpense / monthlySalary) * 100
				: 0;

		const variableExpenseRate =
			monthlySalary > 0
				? (variableExpense / monthlySalary) * 100
				: 0;

		const expenseRate =
			monthlySalary > 0
				? (totalExpense / monthlySalary) * 100
				: 0;

		const remainingRate =
			monthlySalary > 0
				? (remainingAmount / monthlySalary) * 100
				: 0;

		return {
			totalExpense,
			totalOutflow,
			remainingAmount,
			savingsRate,
			fixedExpenseRate,
			variableExpenseRate,
			expenseRate,
			remainingRate,
		};
	}, [
		monthlySalary,
		savingsAmount,
		fixedExpense,
		variableExpense,
	]);

	const recommendation = useMemo(() => {
		const availableAmount = Math.max(0, result.remainingAmount);

		/*
		 * 현재는 UI 확인을 위한 임시 규칙 기반 비율이다.
		 * 다음 단계에서 LLM API 응답으로 교체한다.
		 */
		const emergencyRate = 50;
		const additionalSavingRate = 30;
		const learningInvestmentRate = 20;

		return {
			emergency: availableAmount * (emergencyRate / 100),
			additionalSaving:
				availableAmount * (additionalSavingRate / 100),
			learningInvestment:
				availableAmount * (learningInvestmentRate / 100),
			emergencyRate,
			additionalSavingRate,
			learningInvestmentRate,
		};
	}, [result.remainingAmount]);

	const analysisMessages = useMemo(() => {
		if (!rank) {
			return ["계급을 선택하면 월급과 소비 분석 결과가 표시됩니다."];
		}

		const messages: string[] = [];

		if (result.remainingAmount < 0) {
			messages.push(
				"현재 입력 기준으로 월 지출과 적금 납입액이 월급을 초과합니다.",
			);
			messages.push(
				"고정지출과 변동지출 중 즉시 줄일 수 있는 항목을 먼저 확인해야 합니다.",
			);
			return messages;
		}

		if (result.savingsRate >= 40) {
			messages.push(
				"월급 대비 적금 납입 비율이 높은 편으로, 저축 중심의 안정적인 구조입니다.",
			);
		} else if (result.savingsRate >= 20) {
			messages.push(
				"현재 적금 비율은 유지 가능한 수준입니다.",
			);
		} else {
			messages.push(
				"월급 대비 적금 비율이 낮아 추가 저축 여력을 검토할 수 있습니다.",
			);
		}

		if (result.variableExpenseRate >= 25) {
			messages.push(
				"기타 변동지출 비율이 높습니다. PX, 외출, 쇼핑 등의 소비 내역을 점검하는 것이 좋습니다.",
			);
		} else {
			messages.push(
				"기타 변동지출은 비교적 안정적인 범위로 관리되고 있습니다.",
			);
		}

		if (result.remainingRate >= 20) {
			messages.push(
				"월 잔여금 일부를 비상금과 추가 저축으로 분산할 수 있습니다.",
			);
		}

		return messages;
	}, [rank, result]);

	const handleReset = () => {
		setRank(profileRank ?? "");
		setSavingsAmount(0);
		setFixedExpense(0);
		setVariableExpense(0);
	};

	return (
		<Box minH="calc(100vh - 66px)" bg="#F6F8FC">
			<Box
				maxW="1440px"
				mx="auto"
				px={{ base: "16px", md: "24px", xl: "32px" }}
				py={{ base: "24px", md: "36px" }}
			>
				<Flex
					mb="7"
					align={{ base: "flex-start", md: "center" }}
					justify="space-between"
					direction={{ base: "column", md: "row" }}
					gap="4"
				>
					<Box>
						<HStack mb="2" spacing="2">
							<Badge
								px="3"
								py="1"
								colorScheme="blue"
								borderRadius="full"
							>
								{SALARY_STANDARD_YEAR}년 기준
							</Badge>

							<Badge
								px="3"
								py="1"
								colorScheme="purple"
								borderRadius="full"
							>
								장병 자산관리
							</Badge>
						</HStack>

						<Heading
							fontSize={{ base: "26px", md: "34px" }}
							letterSpacing="-0.04em"
						>
							월급 잔여금 계산기
						</Heading>

						<Text mt="2" color="gray.600">
							계급과 월 지출을 입력해 실제로 활용할 수 있는
							잔여금을 계산합니다.
						</Text>
					</Box>

					<Button
						variant="outline"
						bg="white"
						borderRadius="10px"
						onClick={handleReset}
					>
						입력 초기화
					</Button>
				</Flex>

				<Grid
					templateColumns={{
						base: "1fr",
						xl: "minmax(0, 1fr) 450px",
					}}
					gap="6"
					alignItems="start"
				>
					<Stack spacing="6" minW={0}>
						<Card
							borderRadius="18px"
							borderWidth="1px"
							borderColor="gray.200"
							boxShadow="sm"
						>
							<CardBody p={{ base: "20px", md: "28px" }}>
								<Flex
									mb="6"
									align="center"
									justify="space-between"
									gap="4"
								>
									<Box>
										<Heading size="md">
											월급 및 지출 입력
										</Heading>

										<Text
											mt="1"
											fontSize="sm"
											color="gray.500"
										>
											네 가지 항목만 입력하면 자동으로
											계산됩니다.
										</Text>
									</Box>

									<Badge
										px="3"
										py="1"
										colorScheme="green"
										borderRadius="full"
									>
										간편 입력
									</Badge>
								</Flex>

								<Stack spacing="6">
									<FormControl isRequired>
										<FormLabel
											mb="2"
											fontSize="sm"
											fontWeight="800"
										>
											계급
										</FormLabel>

										<Select
											h="46px"
											value={rank}
											placeholder={
												isProfileLoading
													? "군 프로필 확인 중"
													: "현재 계급을 선택하세요"
											}
											borderRadius="10px"
											fontWeight="700"
											isDisabled={
												isProfileLoading ||
												hasMilitaryProfile
											}
											onChange={(event) => {
												setRank(
													event.target.value as RankSelection,
												);
											}}
										>
											<option value="이병">이병</option>
											<option value="일병">일병</option>
											<option value="상병">상병</option>
											<option value="병장">병장</option>
										</Select>
										{!isProfileLoading &&
											!hasMilitaryProfile && (
												<Button
													mt="3"
													size="sm"
													variant="outline"
													colorScheme="purple"
													onClick={() =>
														navigate("/mypage")
													}
												>
													마이페이지에서 군 프로필 설정
												</Button>
											)}

										<FormHelperText
											mt="2"
											fontSize="xs"
											color="gray.500"
										>
											{isProfileLoading
												? "마이페이지의 군 프로필을 확인하고 있습니다."
												: hasMilitaryProfile
													? `마이페이지 계급 ${profileRank}이 자동 적용되었습니다.`
													: "군 프로필이 없어서 계급을 직접 선택해야 합니다."}
										</FormHelperText>
									</FormControl>

									{rank && (
										<Box
											p="4"
											borderRadius="12px"
											bg="blue.50"
											borderWidth="1px"
											borderColor="blue.100"
										>
											<Flex
												align="center"
												justify="space-between"
											>
												<Box>
													<Text
														fontSize="sm"
														fontWeight="700"
														color="blue.700"
													>
														{rank} 월 급여
													</Text>

													<Text
														mt="1"
														fontSize="xs"
														color="blue.600"
													>
														{
															SALARY_STANDARD_YEAR
														}
														년 봉급표 기준
													</Text>
												</Box>

												<Text
													fontSize={{
														base: "22px",
														md: "26px",
													}}
													fontWeight="900"
													color="blue.700"
												>
													{formatCurrency(
														monthlySalary,
													)}
												</Text>
											</Flex>
										</Box>
									)}

									<Divider />

									<FormControl isRequired isDisabled={!rank}>
										<FormLabel mb="2" fontSize="sm" fontWeight="800">
											장병내일준비적금 납입액
										</FormLabel>

										<Select
											h="46px"
											value={savingsAmount}
											borderRadius="10px"
											fontWeight="700"
											isDisabled={!rank}
											onChange={(event) => {
												setSavingsAmount(Number(event.target.value));
											}}
										>
											{SAVINGS_OPTIONS.map((amount) => (
												<option key={amount} value={amount}>
													{formatCurrency(amount)}
												</option>
											))}
										</Select>

										<FormHelperText mt="2" fontSize="xs" color="gray.500">
											0원부터 55만 원까지 5만 원 단위로 선택할 수 있습니다.
										</FormHelperText>
									</FormControl>

									<Box
										p="4"
										borderRadius="12px"
										bg="orange.50"
										borderWidth="1px"
										borderColor="orange.100"
									>
										<Flex
											align={{ base: "flex-start", md: "center" }}
											justify="space-between"
											direction={{ base: "column", md: "row" }}
											gap="2"
										>
											<Box>
												<Text fontSize="sm" fontWeight="800" color="orange.700">
													이번 달 입력 가능한 지출 한도
												</Text>
												<Text mt="1" fontSize="xs" color="orange.600">
													월급에서 적금 납입액을 제외한 금액입니다.
												</Text>
											</Box>

											<Text fontSize="22px" fontWeight="900" color="orange.700">
												{formatCurrency(spendableBudget)}
											</Text>
										</Flex>
									</Box>

									<SimpleGrid
										columns={{ base: 1, md: 2 }}
										spacing="6"
									>


										<SalaryInput
											label="월 고정지출"
											description="통신비, 구독료, 교통비, 정기결제 등"
											value={fixedExpense}
											max={fixedExpenseMax}
											isDisabled={!rank}
											onChange={setFixedExpense}
										/>

										<SalaryInput
											label="기타 변동지출"
											description="PX, 외출, 간식, 쇼핑 등 월별 변동 소비"
											value={variableExpense}
											max={variableExpenseMax}
											isDisabled={!rank}
											onChange={setVariableExpense}
										/>
									</SimpleGrid>
								</Stack>
							</CardBody>
						</Card>



						<Stack spacing="6" minW={0}>
							{/* 월급 및 지출 입력 카드 */}
							<Card
								borderRadius="18px"
								borderWidth="1px"
								borderColor="gray.200"
								boxShadow="sm"
							>
								<CardBody p={{ base: "20px", md: "28px" }}>
									{/* 기존 월급·지출 입력 내용 */}
								</CardBody>
							</Card>

							{/* 새 LLM 자산관리 추천 패널 */}
							<AssetAdvicePanel
								input={{
									rank,
									savingsAmount,
									fixedExpense,
									variableExpense,
								}}
								isDisabled={
									!rank ||
									result.remainingAmount <= 0
								}
							/>
						</Stack>
					</Stack>

					<Card
						position={{ base: "static", xl: "sticky" }}
						top="90px"
						borderRadius="18px"
						borderWidth="1px"
						borderColor="gray.200"
						boxShadow="md"
					>
						<CardBody p={{ base: "20px", md: "26px" }}>
							<Box mb="5">
								<Text
									fontSize="sm"
									fontWeight="800"
									color="blue.600"
								>
									이번 달 계산 결과
								</Text>

								<Heading mt="1" size="md">
									{rank
										? `${rank} 월급 분석`
										: "계급을 선택하세요"}
								</Heading>
							</Box>

							<Stack spacing="4">
								<Stat
									p="4"
									borderRadius="12px"
									bg="gray.50"
								>
									<StatLabel color="gray.500">
										월 급여
									</StatLabel>

									<StatNumber
										mt="1"
										fontSize="24px"
									>
										{formatCurrency(monthlySalary)}
									</StatNumber>
								</Stat>

								<SimpleGrid columns={2} spacing="3">
									<Box
										p="4"
										borderRadius="12px"
										bg="blue.50"
									>
										<Text
											fontSize="xs"
											fontWeight="700"
											color="blue.600"
										>
											적금 납입액
										</Text>

										<Text
											mt="1"
											fontSize="lg"
											fontWeight="900"
										>
											{formatCurrency(
												savingsAmount,
											)}
										</Text>
									</Box>

									<Box
										p="4"
										borderRadius="12px"
										bg="orange.50"
									>
										<Text
											fontSize="xs"
											fontWeight="700"
											color="orange.600"
										>
											총지출
										</Text>

										<Text
											mt="1"
											fontSize="lg"
											fontWeight="900"
										>
											{formatCurrency(
												result.totalExpense,
											)}
										</Text>
									</Box>
								</SimpleGrid>

								<Box
									p="5"
									borderRadius="14px"
									bg={
										result.remainingAmount < 0
											? "red.50"
											: "green.50"
									}
									borderWidth="1px"
									borderColor={
										result.remainingAmount < 0
											? "red.100"
											: "green.100"
									}
								>
									<Text
										fontSize="sm"
										fontWeight="800"
										color={
											result.remainingAmount < 0
												? "red.600"
												: "green.700"
										}
									>
										월 잔여금
									</Text>

									<Text
										mt="1"
										fontSize={{
											base: "28px",
											md: "34px",
										}}
										fontWeight="900"
										color={
											result.remainingAmount < 0
												? "red.600"
												: "green.700"
										}
									>
										{formatCurrency(
											result.remainingAmount,
										)}
									</Text>

									<Text
										mt="2"
										fontSize="xs"
										color="gray.600"
									>
										월급에서 적금과 모든 지출을 제외한
										금액
									</Text>
								</Box>

								<Divider />

								<Stack spacing="4">
									<Box>
										<Flex
											mb="2"
											justify="space-between"
										>
											<Text
												fontSize="sm"
												fontWeight="700"
											>
												저축률
											</Text>

											<Text
												fontSize="sm"
												fontWeight="800"
												color="blue.600"
											>
												{formatPercent(
													result.savingsRate,
												)}
											</Text>
										</Flex>

										<Progress
											value={Math.min(
												100,
												result.savingsRate,
											)}
											colorScheme="blue"
											borderRadius="full"
										/>
									</Box>

									<Box>
										<Flex
											mb="2"
											justify="space-between"
										>
											<Text
												fontSize="sm"
												fontWeight="700"
											>
												지출률
											</Text>

											<Text
												fontSize="sm"
												fontWeight="800"
												color="orange.600"
											>
												{formatPercent(
													result.expenseRate,
												)}
											</Text>
										</Flex>

										<Progress
											value={Math.min(
												100,
												result.expenseRate,
											)}
											colorScheme="orange"
											borderRadius="full"
										/>
									</Box>

									<Box>
										<Flex
											mb="2"
											justify="space-between"
										>
											<Text
												fontSize="sm"
												fontWeight="700"
											>
												잔여금 비율
											</Text>

											<Text
												fontSize="sm"
												fontWeight="800"
												color={
													result.remainingRate <
														0
														? "red.600"
														: "green.600"
												}
											>
												{formatPercent(
													result.remainingRate,
												)}
											</Text>
										</Flex>

										<Progress
											value={Math.max(
												0,
												Math.min(
													100,
													result.remainingRate,
												),
											)}
											colorScheme="green"
											borderRadius="full"
										/>
									</Box>
								</Stack>
							</Stack>
						</CardBody>
					</Card>
				</Grid>
			</Box>
		</Box>
	);
}