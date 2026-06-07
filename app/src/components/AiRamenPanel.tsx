import React, { useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Flex,
	HStack,
	Progress,
	Spacer,
	Stack,
	Text,
} from "@chakra-ui/react";

type AiDecision = "매수" | "매도" | "관망";

type StockLike = {
	symbol: string;
	name: string;
	price: number;
	changeRate: number;
	changePrice?: number;
	volume?: number;
};

type ChartPointLike = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
};

type AiFactor = {
	label: "직접" | "간접";
	factor: string;
	weight: number;
};

type AiRamenPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	stock: StockLike | null;
	chartPoints: ChartPointLike[];
	chartPeriod: string;
	chartInterval: string;
};

const decisionColor = (decision: AiDecision) => {
	if (decision === "매수") return "#e03131";
	if (decision === "매도") return "#1971c2";
	return "#868e96";
};

const decisionBg = (decision: AiDecision) => {
	if (decision === "매수") return "#fff5f5";
	if (decision === "매도") return "#e7f5ff";
	return "#f8f9fa";
};

const toAiDecision = (
	stock: StockLike | null,
	chartPoints: ChartPointLike[],
): AiDecision => {
	if (!stock) return "관망";

	const recent = chartPoints.slice(-12);
	const first = recent[0];
	const last = recent[recent.length - 1];

	const chartReturn =
		first && last && first.close > 0
			? ((last.close - first.close) / first.close) * 100
			: 0;

	const score = stock.changeRate * 0.65 + chartReturn * 0.35;

	if (score >= 2.5) return "매수";
	if (score <= -2.5) return "매도";
	return "관망";
};

const buildFactors = (
	stock: StockLike | null,
	chartPoints: ChartPointLike[],
): AiFactor[] => {
	if (!stock) {
		return [
			{ label: "직접", factor: "선택된 종목 없음", weight: 0 },
			{ label: "간접", factor: "차트 데이터 없음", weight: 0 },
		];
	}

	const recent = chartPoints.slice(-10);
	const first = recent[0];
	const last = recent[recent.length - 1];

	const chartReturn =
		first && last && first.close > 0
			? ((last.close - first.close) / first.close) * 100
			: 0;

	const avgVolume =
		recent.length > 0
			? recent.reduce((sum, item) => sum + Number(item.volume || 0), 0) /
			recent.length
			: 0;

	const volumeWeight = Math.min(
		95,
		Math.max(30, Math.round((avgVolume / Math.max(stock.volume || 1, 1)) * 100)),
	);

	return [
		{
			label: "직접",
			factor:
				stock.changeRate >= 0
					? "현재가 상승 흐름"
					: "현재가 하락 압력",
			weight: Math.min(95, Math.max(35, Math.round(Math.abs(stock.changeRate) * 8))),
		},
		{
			label: "직접",
			factor:
				chartReturn >= 0
					? "단기 차트 반등 흐름"
					: "단기 차트 약세 흐름",
			weight: Math.min(95, Math.max(35, Math.round(Math.abs(chartReturn) * 10))),
		},
		{
			label: "간접",
			factor: "거래량 기반 수급 강도",
			weight: volumeWeight,
		},
		{
			label: "간접",
			factor: "단기 변동성 리스크",
			weight: Math.min(
				90,
				Math.max(40, Math.round(Math.abs(stock.changeRate) * 6 + 35)),
			),
		},
	];
};

const buildSummary = (
	decision: AiDecision,
	stock: StockLike | null,
	chartPoints: ChartPointLike[],
) => {
	if (!stock) return "종목을 선택하면 AI 판단을 확인할 수 있습니다.";

	const recent = chartPoints.slice(-12);
	const first = recent[0];
	const last = recent[recent.length - 1];

	const chartReturn =
		first && last && first.close > 0
			? ((last.close - first.close) / first.close) * 100
			: 0;

	if (decision === "매수") {
		return `${stock.name}은 현재 등락률과 단기 차트 흐름이 비교적 우호적입니다. 다만 단기 급등 이후에는 추격매수 리스크가 있으므로 분할 접근이 적절합니다.`;
	}

	if (decision === "매도") {
		return `${stock.name}은 현재 가격 흐름과 단기 차트가 약세를 보입니다. 손실 확대 가능성과 변동성 리스크를 고려해 비중 축소 판단이 가능합니다.`;
	}

	return `${stock.name}은 현재 방향성이 뚜렷하지 않습니다. 최근 차트 변화율은 ${chartReturn.toFixed(
		2,
	)}% 수준으로, 추가 신호 확인 전까지 관망이 적절합니다.`;
};

export default function AiRamenPanel({
	isOpen,
	onClose,
	stock,
	chartPoints,
	chartPeriod,
	chartInterval,
}: AiRamenPanelProps) {
	const [tab, setTab] = useState<"판단근거" | "히스토리" | "비교">("판단근거");
	const [userDecision, setUserDecision] = useState<AiDecision | null>(null);

	const aiDecision = useMemo(
		() => toAiDecision(stock, chartPoints),
		[stock, chartPoints],
	);

	const factors = useMemo(
		() => buildFactors(stock, chartPoints),
		[stock, chartPoints],
	);

	const confidence = useMemo(() => {
		const avg =
			factors.length > 0
				? factors.reduce((sum, item) => sum + item.weight, 0) / factors.length
				: 50;

		return Math.min(95, Math.max(45, Math.round(avg)));
	}, [factors]);

	const summary = useMemo(
		() => buildSummary(aiDecision, stock, chartPoints),
		[aiDecision, stock, chartPoints],
	);

	const history = useMemo(() => {
		const base = aiDecision;

		return [
			{
				time: "09:30",
				decision: "관망" as AiDecision,
				reason: "장 초반 방향성 확인 필요",
				changed: false,
			},
			{
				time: "10:15",
				decision: base,
				reason: "현재가와 단기 차트 흐름 반영",
				changed: base !== "관망",
			},
			{
				time: "11:00",
				decision: base,
				reason: "거래량과 변동성 요인 재확인",
				changed: false,
			},
		];
	}, [aiDecision]);

	if (!isOpen) return null;

	return (
		<Box
			w="430px"
			bg="white"
			border="1px solid #e9ecef"
			borderRadius="14px"
			display="flex"
			flexDirection="column"
			overflow="hidden"
			boxShadow="0 6px 24px rgba(0,0,0,0.10)"
			flexShrink={0}
			minH="520px"
			maxH="760px"
		>
			<Box p="14px 16px" borderBottom="1px solid #f1f3f5" bg="#f8f9fa">
				<Flex align="center" mb="3">
					<Box>
						<Text fontSize="12px" fontWeight="900" color="#212529">
							AI라면?
						</Text>
						<Text fontSize="11px" color="#868e96">
							{stock ? `${stock.name} · ${stock.symbol}` : "선택 종목 없음"}
						</Text>
					</Box>

					<Spacer />

					<Button size="xs" variant="ghost" onClick={onClose}>
						✕
					</Button>
				</Flex>

				<Flex
					align="center"
					justify="space-between"
					p="10px 14px"
					borderRadius="10px"
					bg={decisionBg(aiDecision)}
					border={`1px solid ${decisionColor(aiDecision)}22`}
				>
					<Box>
						<Text fontSize="10px" color="#adb5bd" mb="1">
							현재 판단
						</Text>
						<Text
							fontSize="22px"
							fontWeight="900"
							color={decisionColor(aiDecision)}
						>
							{aiDecision}
						</Text>
					</Box>

					<Box textAlign="right">
						<Text fontSize="10px" color="#adb5bd" mb="1">
							신뢰도
						</Text>
						<Text
							fontSize="18px"
							fontWeight="800"
							color={decisionColor(aiDecision)}
						>
							{confidence}%
						</Text>
					</Box>
				</Flex>
			</Box>

			<Flex borderBottom="1px solid #f1f3f5">
				{(["판단근거", "히스토리", "비교"] as const).map((item) => (
					<Button
						key={item}
						flex="1"
						size="sm"
						variant="ghost"
						borderRadius="0"
						fontSize="12px"
						fontWeight={tab === item ? "900" : "500"}
						color={tab === item ? "#212529" : "#adb5bd"}
						borderBottom={
							tab === item ? "2px solid #212529" : "2px solid transparent"
						}
						onClick={() => setTab(item)}
					>
						{item}
					</Button>
				))}
			</Flex>

			<Box flex="1" overflowY="auto" p="12px">
				{tab === "판단근거" && (
					<Stack spacing="2">
						<Box
							fontSize="12px"
							color="#495057"
							lineHeight="1.7"
							p="10px"
							bg="#f8f9fa"
							borderRadius="8px"
						>
							{summary}
						</Box>

						<Box fontSize="11px" color="#868e96" px="1">
							차트 기준: {chartPeriod} / {chartInterval}
						</Box>

						{factors.map((factor, index) => {
							const color = factor.label === "직접" ? "#e03131" : "#f59f00";

							return (
								<Box
									key={`${factor.factor}-${index}`}
									p="10px"
									bg="white"
									border="1px solid #f1f3f5"
									borderRadius="8px"
								>
									<Flex align="center" mb="2">
										<HStack spacing="2">
											<Badge
												bg={`${color}18`}
												color={color}
												fontSize="9px"
												borderRadius="3px"
											>
												{factor.label}
											</Badge>
											<Text fontSize="12px" color="#495057">
												{factor.factor}
											</Text>
										</HStack>

										<Spacer />

										<Text fontSize="12px" fontWeight="700" color="#868e96">
											{factor.weight}%
										</Text>
									</Flex>

									<Progress
										value={factor.weight}
										size="xs"
										borderRadius="full"
										sx={{
											"& > div": {
												background: color,
											},
										}}
									/>
								</Box>
							);
						})}
					</Stack>
				)}

				{tab === "히스토리" && (
					<Stack spacing="0">
						{history.map((item, index) => (
							<Flex key={`${item.time}-${index}`} gap="10px" pb="3">
								<Flex direction="column" align="center">
									<Box
										w="10px"
										h="10px"
										borderRadius="full"
										mt="3px"
										bg={
											item.changed
												? decisionColor(item.decision)
												: "#dee2e6"
										}
									/>
									{index < history.length - 1 && (
										<Box w="1px" flex="1" bg="#f1f3f5" mt="3px" />
									)}
								</Flex>

								<Box flex="1">
									<Flex mb="1">
										<Text
											fontSize="12px"
											fontWeight="900"
											color={decisionColor(item.decision)}
										>
											{item.decision}
										</Text>
										<Spacer />
										<Text fontSize="10px" color="#adb5bd">
											{item.time}
										</Text>
									</Flex>

									<Text fontSize="11px" color="#868e96" lineHeight="1.5">
										{item.reason}
									</Text>

									{item.changed && (
										<Badge mt="1" fontSize="9px" color="#f59f00" bg="#fff9db">
											판단 변경
										</Badge>
									)}
								</Box>
							</Flex>
						))}
					</Stack>
				)}

				{tab === "비교" && !userDecision && (
					<Stack spacing="2">
						<Text fontSize="12px" color="#868e96" lineHeight="1.7" mb="1">
							내 판단을 선택하면 AI 판단과 비교합니다.
						</Text>

						{(["매수", "관망", "매도"] as AiDecision[]).map((decision) => (
							<Button
								key={decision}
								h="44px"
								borderRadius="10px"
								border={`1px solid ${decisionColor(decision)}33`}
								bg={decisionBg(decision)}
								color={decisionColor(decision)}
								fontSize="15px"
								fontWeight="900"
								_hover={{ bg: decisionBg(decision) }}
								onClick={() => setUserDecision(decision)}
							>
								{decision}
							</Button>
						))}
					</Stack>
				)}

				{tab === "비교" && userDecision && (
					<Stack spacing="3">
						<Flex gap="2">
							<Box
								flex="1"
								p="12px"
								borderRadius="10px"
								textAlign="center"
								bg={decisionBg(userDecision)}
								border={`1px solid ${decisionColor(userDecision)}22`}
							>
								<Text fontSize="10px" color="#adb5bd" mb="1">
									내 판단
								</Text>
								<Text
									fontSize="18px"
									fontWeight="900"
									color={decisionColor(userDecision)}
								>
									{userDecision}
								</Text>
							</Box>

							<Box
								flex="1"
								p="12px"
								borderRadius="10px"
								textAlign="center"
								bg={decisionBg(aiDecision)}
								border={`1px solid ${decisionColor(aiDecision)}22`}
							>
								<Text fontSize="10px" color="#adb5bd" mb="1">
									AI 판단
								</Text>
								<Text
									fontSize="18px"
									fontWeight="900"
									color={decisionColor(aiDecision)}
								>
									{aiDecision}
								</Text>
							</Box>
						</Flex>

						<Box
							p="12px"
							borderRadius="10px"
							fontSize="12px"
							lineHeight="1.7"
							bg={userDecision === aiDecision ? "#ebfbee" : "#fff9db"}
							border={`1px solid ${userDecision === aiDecision ? "#40c057" : "#f59f00"
								}33`}
							color="#495057"
						>
							{userDecision === aiDecision
								? `AI와 같은 판단입니다. ${summary}`
								: `AI는 ${aiDecision}을 선택했습니다. 현재 판단에서는 가격 흐름, 거래량, 변동성 요인을 함께 확인할 필요가 있습니다.`}
						</Box>

						<Button
							size="sm"
							variant="outline"
							onClick={() => setUserDecision(null)}
						>
							다시 판단하기
						</Button>
					</Stack>
				)}
			</Box>
		</Box>
	);
}