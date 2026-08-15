import React, { useEffect, useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	CloseButton,
	Divider,
	Flex,
	Heading,
	HStack,
	Progress,
	Skeleton,
	Spacer,
	Stack,
	Text,
	useToast,
} from "@chakra-ui/react";

import judgmentService, {
	type AiJudgment,
	type AiJudgmentFactor,
	type AiJudgmentLabel,
} from "../services/judgment.service";

type AiRamenStock = {
	symbol: string;
	name: string;
	market?: string;
	price?: number;
	changeRate?: number;
	changePrice?: number;
};

type AiRamenChartPoint = {
	time: number;
	open?: number;
	high?: number;
	low?: number;
	close?: number;
	volume?: number;
};

type AiRamenPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	stock: AiRamenStock | null;
	chartPoints?: AiRamenChartPoint[];
	chartPeriod?: string;
	chartInterval?: string;
};

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatPrice(value?: number | null) {
	const number = Number(value ?? 0);

	if (!Number.isFinite(number) || number <= 0) {
		return "-";
	}

	return `${numberFormat.format(number)}원`;
}

function formatComputedAt(value?: string) {
	if (!value) return "-";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function judgmentStyle(judge: AiJudgmentLabel) {
	if (judge === "매수") {
		return {
			color: "#E85831",
			bg: "#FFF0E8",
			border: "#F5B89F",
			label: "매수 관점",
		};
	}

	if (judge === "매도") {
		return {
			color: "#2F67D8",
			bg: "#EEF3FF",
			border: "#B8C9F2",
			label: "매도 관점",
		};
	}

	return {
		color: "#62574D",
		bg: "#F5F0EA",
		border: "#D8CBBF",
		label: "관망 관점",
	};
}

function factorStyle(factor: AiJudgmentFactor) {
	const positive = factor.direction === "긍정";

	if (factor.direction == null) {
		return {
			color: "#62574D",
			bg: "#F6F1EB",
			border: "#DED2C7",
		};
	}

	return positive
		? {
				color: "#C9562D",
				bg: "#FFF3EC",
				border: "#F0C2AD",
			}
		: {
				color: "#315FAE",
				bg: "#F0F4FC",
				border: "#C6D3EC",
			};
}

function ConfidenceBar({ value }: { value: number }) {
	const confidence = Math.max(0, Math.min(100, Number(value) || 0));

	return (
		<Box>
			<Flex align="end">
				<Box>
					<Text fontSize="10px" color="app.subtleText" fontWeight="700">
						판단 신뢰도
					</Text>
					<Text
						mt="1"
						fontSize="25px"
						lineHeight="1"
						fontWeight="900"
						letterSpacing="-0.04em"
					>
						{confidence.toFixed(0)}
						<Text
							as="span"
							ml="2px"
							fontSize="12px"
							color="app.subtleText"
						>
							%
						</Text>
					</Text>
				</Box>

				<Spacer />

				<Text fontSize="9px" color="app.subtleText">
					0
					<Text as="span" mx="4px">
						—
					</Text>
					100
				</Text>
			</Flex>

			<Progress
				mt="9px"
				value={confidence}
				h="7px"
				borderRadius="full"
				bg="#EFE6DC"
				colorScheme="orange"
				sx={{
					"& > div": {
						background: "#F26438",
					},
				}}
			/>
		</Box>
	);
}

function FactorRow({ factor }: { factor: AiJudgmentFactor }) {
	const style = factorStyle(factor);
	const weight = Math.max(0, Math.min(100, Number(factor.weight) || 0));

	return (
		<Box
			px="11px"
			py="10px"
			borderWidth="1px"
			borderColor="#EFE3D7"
			borderRadius="9px"
			bg="#FFFEFC"
		>
			<Flex align="flex-start" gap="8px">
				<Box minW="0" flex="1">
					<HStack spacing="5px" mb="5px" wrap="wrap">
						<Badge
							px="6px"
							py="2px"
							borderRadius="full"
							bg={factor.type === "직접" ? "#2E2925" : "#F2ECE5"}
							color={factor.type === "직접" ? "white" : "#62574D"}
							fontSize="8px"
						>
							{factor.type}요인
						</Badge>

						{factor.direction && (
							<Badge
								px="6px"
								py="2px"
								borderRadius="full"
								bg={style.bg}
								color={style.color}
								borderWidth="1px"
								borderColor={style.border}
								fontSize="8px"
							>
								{factor.direction}
							</Badge>
						)}
					</HStack>

					<Text
						fontSize="11px"
						lineHeight="1.45"
						fontWeight="800"
						color="#2A2521"
					>
						{factor.factor}
					</Text>
				</Box>

				<Box minW="48px" textAlign="right">
					<Text fontSize="8px" color="app.subtleText">
						가중치
					</Text>
					<Text mt="2px" fontSize="13px" fontWeight="900">
						{weight.toFixed(0)}
					</Text>
				</Box>
			</Flex>

			<Box
				mt="8px"
				h="4px"
				borderRadius="full"
				bg="#F0E8E0"
				overflow="hidden"
			>
				<Box
					h="100%"
					w={`${weight}%`}
					borderRadius="full"
					bg={factor.direction === "부정" ? "#5D7FBA" : "#F28A5C"}
				/>
			</Box>
		</Box>
	);
}

function LoadingPanel() {
	return (
		<Stack spacing="10px">
			<Skeleton h="82px" borderRadius="10px" />
			<Skeleton h="74px" borderRadius="10px" />
			<Skeleton h="106px" borderRadius="10px" />
			<Skeleton h="62px" borderRadius="10px" />
			<Skeleton h="62px" borderRadius="10px" />
		</Stack>
	);
}

export default function AiRamenPanel({
	isOpen,
	onClose,
	stock,
	chartPoints = [],
	chartPeriod,
	chartInterval,
}: AiRamenPanelProps) {
	const toast = useToast();

	const [judgment, setJudgment] = useState<AiJudgment | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [notCalculated, setNotCalculated] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);

	const loadJudgment = async () => {
		if (!stock?.symbol) {
			setJudgment(null);
			return;
		}

		try {
			setIsLoading(true);
			setErrorText(null);
			setNotCalculated(false);

			const next = await judgmentService.getJudgment(stock.symbol);

			setJudgment(next);
		} catch (error: any) {
			console.error("AI라면 판단 조회 실패:", error);

			setJudgment(null);

			if (error?.response?.status === 404) {
				setNotCalculated(true);
				return;
			}

			const message =
				error?.response?.data?.detail ||
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				"AI 판단 서버에 연결하지 못했습니다.";

			setErrorText(
				typeof message === "string"
					? message
					: "AI 판단 서버에 연결하지 못했습니다.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (!isOpen || !stock?.symbol) {
			return;
		}

		void loadJudgment();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, stock?.symbol]);

	const factors = useMemo(
		() =>
			[...(judgment?.factors ?? [])].sort(
				(a, b) => Number(b.weight) - Number(a.weight),
			),
		[judgment?.factors],
	);

	const directFactors = factors.filter((factor) => factor.type === "직접");
	const indirectFactors = factors.filter((factor) => factor.type === "간접");

	const currentStyle = judgment
		? judgmentStyle(judgment.judge)
		: judgmentStyle("관망");

	const latestChartPoint =
		chartPoints.length > 0
			? chartPoints[chartPoints.length - 1]
			: undefined;

	if (!isOpen) {
		return null;
	}

	return (
		<Box
			w={{ base: "100%", xl: "390px" }}
			minW={{ xl: "390px" }}
			h={{ base: "auto", xl: "540px" }}
			maxH={{ xl: "540px" }}
			borderWidth="1px"
			borderColor="#E5D5C5"
			borderRadius="12px"
			bg="#FFFCF8"
			overflow="hidden"
			boxShadow="0 10px 28px rgba(68, 48, 29, 0.08)"
		>
			<Flex
				h="58px"
				px="15px"
				align="center"
				borderBottomWidth="1px"
				borderColor="#EDE1D6"
				bg="#FFF9F3"
			>
				<Box>
					<Flex align="baseline" gap="7px">
						<Heading
							fontSize="17px"
							letterSpacing="-0.035em"
							color="#25211D"
						>
							AI라면?
						</Heading>

						<Badge
							bg="#2E2925"
							color="white"
							fontSize="7px"
							borderRadius="full"
							px="6px"
							py="2px"
						>
							AI 판단
						</Badge>
					</Flex>

					<Text mt="2px" fontSize="9px" color="app.subtleText">
						최근 계산된 판단을 확인합니다.
					</Text>
				</Box>

				<Spacer />

				<CloseButton
					size="sm"
					color="#62574D"
					onClick={onClose}
				/>
			</Flex>

			<Box
				h={{ base: "auto", xl: "482px" }}
				overflowY={{ base: "visible", xl: "auto" }}
				px="14px"
				py="13px"
				sx={{
					"&::-webkit-scrollbar": {
						width: "6px",
					},
					"&::-webkit-scrollbar-thumb": {
						background: "#D7C9BC",
						borderRadius: "999px",
					},
				}}
			>
				{isLoading ? (
					<LoadingPanel />
				) : errorText ? (
					<Flex
						minH="350px"
						direction="column"
						align="center"
						justify="center"
						textAlign="center"
						px="20px"
					>
						<Flex
							w="42px"
							h="42px"
							borderRadius="full"
							align="center"
							justify="center"
							bg="#FFF0E8"
							color="#E85831"
							fontSize="20px"
							fontWeight="900"
						>
							!
						</Flex>

						<Text mt="14px" fontSize="13px" fontWeight="900">
							AI 판단을 불러오지 못했습니다.
						</Text>

						<Text
							mt="7px"
							fontSize="10px"
							lineHeight="1.6"
							color="app.subtleText"
						>
							{errorText}
						</Text>

						<Button
							mt="16px"
							size="sm"
							variant="outline"
							borderColor="#E5C6B4"
							color="#C95530"
							onClick={() => void loadJudgment()}
						>
							다시 시도
						</Button>
					</Flex>
				) : notCalculated ? (
					<Flex
						minH="350px"
						direction="column"
						align="center"
						justify="center"
						textAlign="center"
						px="22px"
					>
						<Flex
							w="48px"
							h="48px"
							borderRadius="full"
							align="center"
							justify="center"
							bg="#F3EEE7"
							color="#62574D"
							fontSize="20px"
							fontWeight="900"
						>
							AI
						</Flex>

						<Text mt="14px" fontSize="13px" fontWeight="900">
							아직 계산된 판단이 없습니다.
						</Text>

						<Text
							mt="7px"
							fontSize="10px"
							lineHeight="1.65"
							color="app.subtleText"
						>
							{stock?.name ?? stock?.symbol}에 대한 AI 판단이 아직
							저장되지 않았습니다.
							<br />
							AI 판단 파이프라인이 실행된 뒤 다시 확인해주세요.
						</Text>

						<Button
							mt="16px"
							size="sm"
							variant="outline"
							borderColor="#E5C6B4"
							onClick={() => void loadJudgment()}
						>
							새로고침
						</Button>
					</Flex>
				) : judgment ? (
					<Stack spacing="11px">
						{/* 현재 종목 */}
						<Box
							px="12px"
							py="10px"
							borderWidth="1px"
							borderColor="#EADBCD"
							borderRadius="10px"
							bg="white"
						>
							<Flex align="center">
								<Box minW="0">
									<Text fontSize="9px" color="app.subtleText">
										현재 종목
									</Text>
									<Flex mt="2px" align="baseline" gap="6px">
										<Text
											fontSize="13px"
											fontWeight="900"
											noOfLines={1}
										>
											{stock?.name ?? judgment.symbol}
										</Text>
										<Text fontSize="8px" color="app.subtleText">
											{judgment.symbol}
										</Text>
									</Flex>
								</Box>

								<Spacer />

								<Box textAlign="right">
									<Text fontSize="12px" fontWeight="900">
										{formatPrice(stock?.price)}
									</Text>

									{stock?.changeRate != null && (
										<Text
											mt="1px"
											fontSize="9px"
											fontWeight="800"
											color={
												Number(stock.changeRate) >= 0
													? "#E85831"
													: "#2F67D8"
											}
										>
											{Number(stock.changeRate) > 0 ? "+" : ""}
											{Number(stock.changeRate).toFixed(2)}%
										</Text>
									)}
								</Box>
							</Flex>
						</Box>

						{/* 핵심 판단 */}
						<Box
							px="13px"
							py="13px"
							borderWidth="1px"
							borderColor={currentStyle.border}
							borderRadius="10px"
							bg={currentStyle.bg}
						>
							<Flex align="center">
								<Box>
									<Text
										fontSize="9px"
										fontWeight="800"
										color={currentStyle.color}
									>
										AI의 현재 판단
									</Text>

									<Flex mt="4px" align="baseline" gap="7px">
										<Text
											fontSize="28px"
											lineHeight="1"
											fontWeight="900"
											letterSpacing="-0.05em"
											color={currentStyle.color}
										>
											{judgment.judge}
										</Text>

										<Text
											fontSize="9px"
											fontWeight="800"
											color={currentStyle.color}
										>
											{currentStyle.label}
										</Text>
									</Flex>
								</Box>

								<Spacer />

								<Box
									px="9px"
									py="6px"
									borderRadius="8px"
									bg="rgba(255,255,255,0.72)"
									borderWidth="1px"
									borderColor={currentStyle.border}
									textAlign="center"
								>
									<Text fontSize="7px" color="app.subtleText">
										신뢰도
									</Text>
									<Text
										mt="1px"
										fontSize="16px"
										fontWeight="900"
										color={currentStyle.color}
									>
										{Math.round(judgment.confidence)}%
									</Text>
								</Box>
							</Flex>
						</Box>

						<ConfidenceBar value={judgment.confidence} />

						<Divider borderColor="#EADFD4" />

						{/* 요약 */}
						<Box>
							<Flex align="center">
								<Text fontSize="11px" fontWeight="900">
									AI 판단 요약
								</Text>
								<Spacer />
								<Text fontSize="8px" color="app.subtleText">
									설명 생성
								</Text>
							</Flex>

							<Box
								mt="7px"
								px="11px"
								py="10px"
								borderWidth="1px"
								borderColor="#EADFD4"
								borderRadius="9px"
								bg="white"
							>
								<Text
									fontSize="10px"
									lineHeight="1.7"
									color="#49413A"
									whiteSpace="pre-wrap"
								>
									{judgment.summary || "판단 요약이 없습니다."}
								</Text>
							</Box>
						</Box>

						{/* 직접 요인 */}
						{directFactors.length > 0 && (
							<Box>
								<Flex align="center" mb="7px">
									<Text fontSize="11px" fontWeight="900">
										핵심 직접요인
									</Text>
									<Spacer />
									<Badge
										bg="#2E2925"
										color="white"
										borderRadius="full"
										fontSize="7px"
										px="6px"
									>
										{directFactors.length}
									</Badge>
								</Flex>

								<Stack spacing="6px">
									{directFactors.map((factor, index) => (
										<FactorRow
											key={`direct-${factor.factor}-${index}`}
											factor={factor}
										/>
									))}
								</Stack>
							</Box>
						)}

						{/* 간접 요인 */}
						{indirectFactors.length > 0 && (
							<Box>
								<Flex align="center" mb="7px">
									<Text fontSize="11px" fontWeight="900">
										간접 영향요인
									</Text>
									<Spacer />
									<Badge
										bg="#F0EAE3"
										color="#62574D"
										borderRadius="full"
										fontSize="7px"
										px="6px"
									>
										{indirectFactors.length}
									</Badge>
								</Flex>

								<Stack spacing="6px">
									{indirectFactors.map((factor, index) => (
										<FactorRow
											key={`indirect-${factor.factor}-${index}`}
											factor={factor}
										/>
									))}
								</Stack>
							</Box>
						)}

						{/* 메타 정보 */}
						<Box
							px="11px"
							py="10px"
							borderRadius="9px"
							bg="#F7F2EC"
						>
							<Flex align="center">
								<Text fontSize="8px" color="app.subtleText">
									AI 계산 시각
								</Text>
								<Spacer />
								<Text fontSize="8px" fontWeight="800">
									{formatComputedAt(judgment.computed_at)}
								</Text>
							</Flex>

							<Flex mt="6px" align="center">
								<Text fontSize="8px" color="app.subtleText">
									현재 화면 차트
								</Text>
								<Spacer />
								<Text fontSize="8px" fontWeight="800">
									{chartPeriod ?? "-"} · {chartInterval ?? "-"} ·{" "}
									{chartPoints.length}개
								</Text>
							</Flex>

							{latestChartPoint?.close != null && (
								<Flex mt="6px" align="center">
									<Text fontSize="8px" color="app.subtleText">
										화면 마지막 종가
									</Text>
									<Spacer />
									<Text fontSize="8px" fontWeight="800">
										{formatPrice(latestChartPoint.close)}
									</Text>
								</Flex>
							)}
						</Box>

						<Box
							px="11px"
							py="9px"
							borderWidth="1px"
							borderColor="#E7DDD2"
							borderRadius="9px"
							bg="#FFFEFC"
						>
							<Text fontSize="8px" lineHeight="1.6" color="#6F655C">
								판단·신뢰도·요인 가중치는 AI 판단 서비스의 점수 계산
								결과이며, 요약 문장은 그 결과를 설명하기 위해 생성됩니다.
								현재 화면의 차트 설정은 참고 표시이며 AI 판단 입력값이라고
								가정하지 않습니다.
							</Text>
						</Box>

						<Button
							h="34px"
							size="sm"
							variant="outline"
							borderColor="#DDCBBB"
							color="#51483F"
							fontSize="10px"
							onClick={() => {
								void loadJudgment();

								toast({
									title: "최신 AI 판단을 다시 조회합니다.",
									status: "info",
									duration: 1200,
									isClosable: true,
								});
							}}
						>
							최신 판단 새로고침
						</Button>
					</Stack>
				) : null}
			</Box>
		</Box>
	);
}
