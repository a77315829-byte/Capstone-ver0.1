import React, { useEffect, useState } from "react";
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Flex,
	Grid,
	Heading,
	HStack,
	Progress,
	SimpleGrid,
	Stack,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	useToast,
} from "@chakra-ui/react";
import {
	CheckCircleIcon,
	InfoIcon,
	WarningIcon,
} from "@chakra-ui/icons";

import api from "../../services/api.service";

export interface AssetAdviceInput {
	rank: string;
	savingsAmount: number;
	fixedExpense: number;
	variableExpense: number;
}

interface AllocationItem {
	category: string;
	percentage: number;
	amount: number;
	reason: string;
}

interface AssetAdviceResponse {
	source: "ollama" | "fallback";
	model: string;

	calculated?: {
		rank: string;
		monthlySalary: number;
		savingsAmount: number;
		fixedExpense: number;
		variableExpense: number;
		totalExpense: number;
		remainingAmount: number;
		savingsRate: number;
		expenseRate: number;
		remainingRate: number;
	};

	advice: {
		summary: string;
		spendingDiagnosis: string[];
		allocation: AllocationItem[];
		monthlyActions: string[];
		riskWarning: string;
	};

	generatedAt: string;
}

interface AssetAdvicePanelProps {
	input: AssetAdviceInput;
	isDisabled: boolean;
}

const currencyFormatter = new Intl.NumberFormat("ko-KR");

function formatCurrency(value: number): string {
	const safeValue = Number.isFinite(value) ? value : 0;

	return `${currencyFormatter.format(
		Math.round(safeValue),
	)}원`;
}

function formatDate(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleString("ko-KR", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function getAllocationColor(category: string): string {
	switch (category) {
		case "비상금":
			return "green";

		case "추가 저축":
			return "blue";

		case "금융학습용 투자":
			return "purple";

		default:
			return "gray";
	}
}

function getAllocationBackground(category: string): string {
	switch (category) {
		case "비상금":
			return "green.50";

		case "추가 저축":
			return "blue.50";

		case "금융학습용 투자":
			return "purple.50";

		default:
			return "gray.50";
	}
}

interface AllocationCardProps {
	item: AllocationItem;
}

function AllocationCard({
	item,
}: AllocationCardProps) {
	const colorScheme = getAllocationColor(item.category);
	const background = getAllocationBackground(item.category);

	return (
		<Box
			p={{ base: "16px", md: "18px" }}
			borderWidth="1px"
			borderColor={`${colorScheme}.100`}
			borderRadius="16px"
			bg={background}
			minW={0}
			transition="all 0.18s ease"
			_hover={{
				transform: "translateY(-2px)",
				boxShadow: "md",
			}}
		>
			<Flex
				align="center"
				justify="space-between"
				gap="3"
			>
				<Text
					fontSize="sm"
					fontWeight="900"
					color={`${colorScheme}.700`}
				>
					{item.category}
				</Text>

				<Badge
					px="2.5"
					py="1"
					colorScheme={colorScheme}
					borderRadius="full"
					fontSize="xs"
				>
					{item.percentage}%
				</Badge>
			</Flex>

			<Text
				mt="3"
				fontSize={{
					base: "22px",
					md: "25px",
				}}
				fontWeight="900"
				letterSpacing="-0.04em"
			>
				{formatCurrency(item.amount)}
			</Text>

			<Progress
				mt="3"
				value={item.percentage}
				size="sm"
				colorScheme={colorScheme}
				bg="whiteAlpha.800"
				borderRadius="full"
			/>

			<Text
				mt="3"
				fontSize="xs"
				lineHeight="1.65"
				color="gray.600"
				noOfLines={2}
			>
				{item.reason}
			</Text>
		</Box>
	);
}

interface CompactListProps {
	items: string[];
	colorScheme: "blue" | "green";
}

function CompactList({
	items,
	colorScheme,
}: CompactListProps) {
	if (!items.length) {
		return (
			<Text
				py="4"
				fontSize="sm"
				color="gray.500"
				textAlign="center"
			>
				표시할 분석 내용이 없습니다.
			</Text>
		);
	}

	return (
		<Stack spacing="3">
			{items.map((item, index) => (
				<Flex
					key={`${item}-${index}`}
					align="flex-start"
					gap="3"
					p="3"
					borderRadius="12px"
					bg="gray.50"
				>
					<Box
						display="flex"
						alignItems="center"
						justifyContent="center"
						w="23px"
						h="23px"
						mt="1px"
						flexShrink={0}
						borderRadius="full"
						bg={`${colorScheme}.100`}
						color={`${colorScheme}.600`}
					>
						<CheckCircleIcon boxSize="12px" />
					</Box>

					<Text
						fontSize="sm"
						lineHeight="1.7"
						color="gray.700"
					>
						{item}
					</Text>
				</Flex>
			))}
		</Stack>
	);
}

export default function AssetAdvicePanel({
	input,
	isDisabled,
}: AssetAdvicePanelProps) {
	const toast = useToast();

	const [isLoading, setIsLoading] =
		useState(false);

	const [result, setResult] =
		useState<AssetAdviceResponse | null>(null);

	useEffect(() => {
		/*
		 * 입력값이 바뀌면 이전 추천 결과를 제거한다.
		 * 변경 전 결과와 현재 입력값이 섞이는 것을 방지한다.
		 */
		setResult(null);
	}, [
		input.rank,
		input.savingsAmount,
		input.fixedExpense,
		input.variableExpense,
	]);

	const requestAdvice = async () => {
		if (isDisabled) {
			toast({
				title: "입력값을 확인하세요.",
				description:
					"계급을 선택하고 월 잔여금이 발생하도록 입력해야 합니다.",
				status: "warning",
				duration: 3500,
				isClosable: true,
			});

			return;
		}

		try {
			setIsLoading(true);

			const response =
				await api.post<AssetAdviceResponse>(
					"/ai/asset-advice",
					input,
				);

			setResult(response.data);

			toast({
				title: "자산관리 분석 완료",
				description:
					response.data.source === "ollama"
						? "로컬 LLM이 소비패턴을 분석했습니다."
						: "규칙 기반 추천 결과를 생성했습니다.",
				status: "success",
				duration: 3000,
				isClosable: true,
			});
		} catch (error: any) {
			console.error(
				"AI 자산관리 추천 요청 실패:",
				error,
			);

			toast({
				title: "AI 추천 생성 실패",
				description:
					error?.response?.data?.message ||
					error?.response?.data?.error ||
					"서버 연결 상태를 확인하세요.",
				status: "error",
				duration: 5000,
				isClosable: true,
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card
			borderRadius="20px"
			borderWidth="1px"
			borderColor="blue.100"
			boxShadow="sm"
			overflow="hidden"
			bg="white"
		>
			<Box
				px={{ base: "20px", md: "28px" }}
				py={{ base: "18px", md: "22px" }}
				bgGradient="linear(to-r, blue.600, purple.600)"
				color="white"
			>
				<Flex
					align={{
						base: "flex-start",
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
						<HStack spacing="2" wrap="wrap">
							<Heading size="md">
								AI 자산관리 추천
							</Heading>

							<Badge
								px="2.5"
								py="1"
								borderRadius="full"
								bg="whiteAlpha.300"
								color="white"
							>
								소비패턴 분석
							</Badge>
						</HStack>

						<Text
							mt="2"
							fontSize="sm"
							color="whiteAlpha.900"
						>
							잔여금을 바탕으로 비상금, 저축,
							금융학습 비율을 제안합니다.
						</Text>
					</Box>

					<Button
						minW="130px"
						bg="white"
						color="blue.700"
						borderRadius="12px"
						boxShadow="sm"
						isDisabled={isDisabled}
						isLoading={isLoading}
						loadingText="분석 중"
						onClick={requestAdvice}
						_hover={{
							bg: "gray.50",
							transform: "translateY(-1px)",
						}}
					>
						AI 추천받기
					</Button>
				</Flex>
			</Box>

			<CardBody
				p={{ base: "20px", md: "28px" }}
			>
				{!result ? (
					<Flex
						minH="150px"
						align="center"
						justify="center"
					>
						<Stack
							maxW="520px"
							align="center"
							spacing="3"
							textAlign="center"
						>
							<Box
								display="flex"
								alignItems="center"
								justifyContent="center"
								w="48px"
								h="48px"
								borderRadius="16px"
								bg="blue.50"
								color="blue.500"
							>
								<InfoIcon boxSize="21px" />
							</Box>

							<Text fontWeight="900">
								{isDisabled
									? "입력 정보를 먼저 완성하세요."
									: "소비패턴 분석 준비가 완료되었습니다."}
							</Text>

							<Text
								fontSize="sm"
								lineHeight="1.7"
								color="gray.500"
							>
								{isDisabled
									? "계급을 선택하고 잔여금이 발생하도록 적금과 지출 금액을 입력하세요."
									: "AI 추천받기 버튼을 누르면 입력한 소비 정보를 바탕으로 맞춤형 배분안을 생성합니다."}
							</Text>
						</Stack>
					</Flex>
				) : (
					<Stack spacing="6">
						<Flex
							align={{
								base: "flex-start",
								md: "center",
							}}
							justify="space-between"
							direction={{
								base: "column",
								md: "row",
							}}
							gap="3"
						>
							<HStack spacing="2" wrap="wrap">
								<Badge
									px="3"
									py="1"
									borderRadius="full"
									colorScheme={
										result.source === "ollama"
											? "purple"
											: "orange"
									}
								>
									{result.source === "ollama"
										? "로컬 LLM 분석"
										: "규칙 기반 분석"}
								</Badge>

								<Badge
									px="3"
									py="1"
									borderRadius="full"
									colorScheme="gray"
								>
									{result.model}
								</Badge>
							</HStack>

							<Text
								fontSize="xs"
								color="gray.500"
							>
								분석 시각{" "}
								{formatDate(result.generatedAt)}
							</Text>
						</Flex>

						<Grid
							templateColumns={{
								base: "1fr",
								lg: "minmax(0, 1fr) 240px",
							}}
							gap="4"
						>
							<Box
								p="5"
								borderRadius="16px"
								bg="gray.50"
								borderWidth="1px"
								borderColor="gray.200"
							>
								<Text
									fontSize="xs"
									fontWeight="900"
									color="blue.600"
									letterSpacing="0.04em"
								>
									종합 분석
								</Text>

								<Text
									mt="3"
									fontSize="sm"
									lineHeight="1.85"
									color="gray.700"
								>
									{result.advice.summary}
								</Text>
							</Box>

							{result.calculated && (
								<Box
									p="5"
									borderRadius="16px"
									bg="green.50"
									borderWidth="1px"
									borderColor="green.100"
								>
									<Text
										fontSize="xs"
										fontWeight="900"
										color="green.700"
									>
										분석 기준 잔여금
									</Text>

									<Text
										mt="2"
										fontSize="25px"
										fontWeight="900"
										color="green.700"
									>
										{formatCurrency(
											result.calculated
												.remainingAmount,
										)}
									</Text>

									<Text
										mt="2"
										fontSize="xs"
										color="green.600"
									>
										월급의{" "}
										{result.calculated.remainingRate.toFixed(
											1,
										)}
										%
									</Text>
								</Box>
							)}
						</Grid>

						<Box>
							<Flex
								mb="3"
								align="center"
								justify="space-between"
							>
								<Text fontWeight="900">
									추천 잔여금 배분
								</Text>

								<Text
									fontSize="xs"
									color="gray.500"
								>
									전체 잔여금 기준
								</Text>
							</Flex>

							<SimpleGrid
								columns={{
									base: 1,
									md: 3,
								}}
								spacing="4"
							>
								{result.advice.allocation.map(
									(item) => (
										<AllocationCard
											key={item.category}
											item={item}
										/>
									),
								)}
							</SimpleGrid>
						</Box>

						<Tabs
							variant="soft-rounded"
							colorScheme="blue"
							isFitted
						>
							<TabList
								p="1"
								bg="gray.100"
								borderRadius="14px"
								gap="1"
							>
								<Tab
									fontSize={{
										base: "12px",
										md: "14px",
									}}
									fontWeight="800"
								>
									소비패턴 진단
								</Tab>

								<Tab
									fontSize={{
										base: "12px",
										md: "14px",
									}}
									fontWeight="800"
								>
									다음 달 실천 계획
								</Tab>

								<Tab
									fontSize={{
										base: "12px",
										md: "14px",
									}}
									fontWeight="800"
								>
									주의사항
								</Tab>
							</TabList>

							<TabPanels>
								<TabPanel px="0" pb="0">
									<CompactList
										items={
											result.advice
												.spendingDiagnosis
										}
										colorScheme="blue"
									/>
								</TabPanel>

								<TabPanel px="0" pb="0">
									<CompactList
										items={
											result.advice
												.monthlyActions
										}
										colorScheme="green"
									/>
								</TabPanel>

								<TabPanel px="0" pb="0">
									<Alert
										status="warning"
										borderRadius="14px"
										alignItems="flex-start"
									>
										<AlertIcon
											as={WarningIcon}
											mt="2px"
										/>

										<AlertDescription
											fontSize="sm"
											lineHeight="1.8"
										>
											{
												result.advice
													.riskWarning
											}
										</AlertDescription>
									</Alert>
								</TabPanel>
							</TabPanels>
						</Tabs>
					</Stack>
				)}
			</CardBody>
		</Card>
	);
}