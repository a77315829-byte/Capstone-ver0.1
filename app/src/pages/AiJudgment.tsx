import React, { useEffect, useMemo, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Divider,
	Flex,
	Grid,
	GridItem,
	Heading,
	HStack,
	Input,
	Progress,
	SimpleGrid,
	Skeleton,
	Spacer,
	Stack,
	Text,
	useToast,
} from "@chakra-ui/react";

import api from "../services/api.service";
import judgmentService, {
	type AiJudgment,
	type AiJudgmentFactor,
	type AiJudgmentLabel,
} from "../services/judgment.service";

type SearchResult = {
	symbol: string;
	name: string;
	market?: string;
};

type StockInfo = {
	symbol: string;
	name: string;
	market: string;
	price: number;
	changePrice: number;
	changeRate: number;
	open: number;
	high: number;
	low: number;
	volume: number;
};

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});
const numberFormat = new Intl.NumberFormat("ko-KR");

function unwrap(raw: any) {
	if (raw?.success === true && raw?.data !== undefined) return raw.data;
	if (raw?.data !== undefined && !raw?.symbol) return raw.data;
	if (raw?.output !== undefined) return raw.output;
	return raw;
}

function normalizeStock(symbol: string, raw: any): StockInfo {
	const data = unwrap(raw);
	const price = Number(
		data?.price ??
			data?.regularMarketPrice ??
			data?.stck_prpr ??
			data?.output?.stck_prpr ??
			0,
	);
	const previousClose = Number(
		data?.regularMarketPreviousClose ??
			data?.stck_sdpr ??
			data?.output?.stck_sdpr ??
			0,
	);
	const changePrice = Number(
		data?.changePrice ??
			data?.regularMarketChange ??
			data?.prdy_vrss ??
			data?.output?.prdy_vrss ??
			(price && previousClose ? price - previousClose : 0),
	);

	return {
		symbol: data?.symbol ?? data?.code ?? symbol,
		name:
			data?.name ??
			data?.longName ??
			data?.longname ??
			data?.shortName ??
			data?.shortname ??
			data?.hts_kor_isnm ??
			data?.output?.hts_kor_isnm ??
			symbol,
		market: data?.market ?? data?.exchange ?? "KRX",
		price,
		changePrice,
		changeRate: Number(
			data?.changeRate ??
				data?.regularMarketChangePercent ??
				data?.prdy_ctrt ??
				data?.output?.prdy_ctrt ??
				0,
		),
		open: Number(data?.open ?? data?.stck_oprc ?? data?.output?.stck_oprc ?? 0),
		high: Number(data?.high ?? data?.stck_hgpr ?? data?.output?.stck_hgpr ?? 0),
		low: Number(data?.low ?? data?.stck_lwpr ?? data?.output?.stck_lwpr ?? 0),
		volume: Number(data?.volume ?? data?.acml_vol ?? data?.output?.acml_vol ?? 0),
	};
}

function normalizeSearch(raw: any): SearchResult[] {
	const list = unwrap(raw);
	if (!Array.isArray(list)) return [];

	return list
		.map((item: any) => ({
			symbol: String(item?.symbol ?? item?.code ?? item?.pdno ?? "")
				.trim()
				.toUpperCase(),
			name:
				item?.name ??
				item?.longName ??
				item?.longname ??
				item?.shortName ??
				item?.shortname ??
				item?.prdt_name ??
				"",
			market: item?.market ?? item?.exchange ?? "KRX",
		}))
		.filter((item) => item.symbol);
}

function judgeTheme(judge: AiJudgmentLabel) {
	if (judge === "매수") {
		return { color: "#E85D35", soft: "#FFF0E8", border: "#F1BDA8" };
	}
	if (judge === "매도") {
		return { color: "#356BC6", soft: "#EFF4FF", border: "#C7D5EF" };
	}
	return { color: "#655B52", soft: "#F4EFE9", border: "#DBCEC1" };
}

function factorColor(direction?: string | null) {
	if (direction === "긍정") return "#E16A42";
	if (direction === "부정") return "#4A73B8";
	return "#74685D";
}

function FactorCard({ factor }: { factor: AiJudgmentFactor }) {
	const weight = Math.max(0, Math.min(100, Number(factor.weight) || 0));
	const color = factorColor(factor.direction);

	return (
		<Box p="14px" borderWidth="1px" borderColor="#E9DDD2" borderRadius="12px" bg="white">
			<Flex align="flex-start" gap="10px">
				<Box minW="0" flex="1">
					<HStack spacing="6px" mb="7px" flexWrap="wrap">
						{factor.direction && (
							<Badge
								bg="white"
								color={color}
								borderWidth="1px"
								borderColor={color}
								borderRadius="full"
								px="8px"
								py="3px"
								fontSize="9px"
							>
								{factor.direction}
							</Badge>
						)}
					</HStack>

					<Text fontSize="13px" fontWeight="800" lineHeight="1.55">
						{factor.factor}
					</Text>
				</Box>

				<Box textAlign="right" minW="52px">
					<Text fontSize="9px" color="app.subtleText">가중치</Text>
					<Text mt="2px" fontSize="18px" fontWeight="900">{weight.toFixed(0)}</Text>
				</Box>
			</Flex>

			<Box mt="10px" h="6px" bg="#EFE7DF" borderRadius="full" overflow="hidden">
				<Box h="100%" w={`${weight}%`} bg={color} borderRadius="full" />
			</Box>
		</Box>
	);
}

function formatDate(value?: string) {
	if (!value) return "-";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleString("ko-KR", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
}

export default function AiJudgmentPage() {
	const toast = useToast();

	const [keyword, setKeyword] = useState("삼성전자");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedSymbol, setSelectedSymbol] = useState("005930");
	const [stock, setStock] = useState<StockInfo | null>(null);
	const [judgment, setJudgment] = useState<AiJudgment | null>(null);

	const [isSearching, setIsSearching] = useState(false);
	const [isLoadingStock, setIsLoadingStock] = useState(false);
	const [isLoadingJudgment, setIsLoadingJudgment] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const [errorText, setErrorText] = useState("");

	const load = async (symbol: string) => {
		const next = symbol.trim().toUpperCase();
		if (!next) return;

		setSelectedSymbol(next);
		setResults([]);
		setIsLoadingStock(true);
		setIsLoadingJudgment(true);
		setNotFound(false);
		setErrorText("");

		const [stockResult, judgmentResult] = await Promise.allSettled([
			api.get(`/stocks/${next}/info`),
			judgmentService.getJudgment(next),
		]);

		if (stockResult.status === "fulfilled") {
			setStock(normalizeStock(next, stockResult.value.data));
		} else {
			setStock(null);
		}
		setIsLoadingStock(false);

		if (judgmentResult.status === "fulfilled") {
			setJudgment(judgmentResult.value);
		} else {
			const error: any = judgmentResult.reason;
			if (error?.response?.status === 404) {
				// 이력이 없는 종목 - 감시 대상으로 등록하면 백엔드가 콜드스타트로
				// 첫 판단을 만들어주니, 그걸 기다렸다가 한 번 더 조회해본다.
				try {
					await judgmentService.watchSymbol(next);
					setJudgment(await judgmentService.getJudgment(next));
				} catch {
					setJudgment(null);
					setNotFound(true);
				}
			} else {
				setJudgment(null);
				setErrorText(
					error?.response?.data?.detail ??
						error?.response?.data?.message ??
						error?.response?.data?.error ??
						"AI 판단 서비스에 연결하지 못했습니다.",
				);
			}
		}
		setIsLoadingJudgment(false);
	};

	useEffect(() => {
		void load("005930");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 지금 보고 있는 종목만 백엔드가 실시간으로 감시하도록, 화면에 떠 있는 동안
	// 주기적으로 구독을 갱신(하트비트)하고 종목이 바뀌거나 화면을 벗어나면 해제한다.
	useEffect(() => {
		if (!selectedSymbol) return;

		void judgmentService.watchSymbol(selectedSymbol);
		const heartbeat = setInterval(() => {
			void judgmentService.watchSymbol(selectedSymbol);
		}, 30_000);

		return () => {
			clearInterval(heartbeat);
			void judgmentService.unwatchSymbol(selectedSymbol);
		};
	}, [selectedSymbol]);

	const search = async () => {
		if (!keyword.trim()) return;
		try {
			setIsSearching(true);
			const response = await api.get(
				`/stocks/search/${encodeURIComponent(keyword.trim())}`,
			);
			const next = normalizeSearch(response.data).slice(0, 8);
			setResults(next);

			if (next.length === 0) {
				toast({
					title: "검색 결과가 없습니다.",
					status: "info",
					isClosable: true,
				});
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "종목 검색에 실패했습니다.",
				status: "error",
				isClosable: true,
			});
		} finally {
			setIsSearching(false);
		}
	};

	const factors = useMemo(
		() => [...(judgment?.factors ?? [])].sort((a, b) => b.weight - a.weight),
		[judgment],
	);
	const theme = judgeTheme(judgment?.judge ?? "관망");
	const isUp = Number(stock?.changeRate ?? 0) >= 0;

	return (
		<Box px={{ base: 4, md: 6, xl: 8 }} py={{ base: 5, md: 7 }} minH="100vh" bg="app.background">
			<Flex align={{ base: "stretch", md: "flex-end" }} direction={{ base: "column", md: "row" }} gap="4" mb="6">
				<Box>
					<Badge mb="8px" px="9px" py="4px" borderRadius="full" bg="#2F2924" color="white" fontSize="9px">
						ANTITUDE AI
					</Badge>
					<Heading fontSize={{ base: "28px", md: "35px" }} letterSpacing="-0.05em">AI라면?</Heading>
					<Text mt="6px" color="app.subtleText" fontSize={{ base: "12px", md: "14px" }}>
						같은 시장 데이터를 보고 AI는 어떤 투자 판단을 내렸는지 확인해보세요.
					</Text>
				</Box>
				<Spacer />
				<Badge px="12px" py="7px" borderRadius="full" bg="#FFF0E8" color="#D85D35" borderWidth="1px" borderColor="#F1C2AF">
					학습용 AI 투자 판단
				</Badge>
			</Flex>

			<Card mb="5" borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73,52,30,.05)">
				<CardBody p="5">
					<Flex gap="10px" direction={{ base: "column", md: "row" }}>
						<Input
							h="48px"
							value={keyword}
							onChange={(event) => setKeyword(event.target.value)}
							onKeyDown={(event) => event.key === "Enter" && void search()}
							placeholder="종목명 또는 종목코드 검색"
							bg="white"
							borderColor="#E5D5C6"
							fontSize="13px"
						/>
						<Button h="48px" minW="145px" bg="#F26438" color="white" _hover={{ bg: "#DE562E" }} isLoading={isSearching} onClick={() => void search()}>
							종목 검색
						</Button>
					</Flex>

					{results.length > 0 && (
						<Stack mt="10px" spacing="0" borderWidth="1px" borderColor="#E9DDD2" borderRadius="10px" overflow="hidden">
							{results.map((result, index) => (
								<Flex
									key={result.symbol}
									as="button"
									type="button"
									px="14px"
									py="11px"
									align="center"
									textAlign="left"
									borderBottomWidth={index === results.length - 1 ? "0" : "1px"}
									borderColor="#EEE5DD"
									bg="white"
									_hover={{ bg: "#FFF9F4" }}
									onClick={() => {
										setKeyword(result.name || result.symbol);
										void load(result.symbol);
									}}
								>
									<Box>
										<Text fontSize="12px" fontWeight="900">{result.name || result.symbol}</Text>
										<Text mt="2px" fontSize="9px" color="app.subtleText">{result.symbol} · {result.market}</Text>
									</Box>
									<Spacer />
									<Text fontSize="10px" fontWeight="900" color="#D85D35">AI 판단 보기</Text>
								</Flex>
							))}
						</Stack>
					)}
				</CardBody>
			</Card>

			<Grid templateColumns={{ base: "1fr", xl: "330px minmax(0, 1fr)" }} gap="5" alignItems="start">
				<GridItem>
					<Card borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73,52,30,.04)">
						<CardBody p="5">
							<Text fontSize="10px" fontWeight="800" color="app.subtleText">현재 선택 종목</Text>

							{isLoadingStock ? (
								<Stack mt="14px"><Skeleton h="28px" /><Skeleton h="45px" /><Skeleton h="120px" /></Stack>
							) : stock ? (
								<>
									<Flex mt="8px" align="flex-start">
										<Box>
											<Heading fontSize="21px">{stock.name}</Heading>
											<Text mt="4px" fontSize="10px" color="app.subtleText">{stock.symbol} · {stock.market}</Text>
										</Box>
										<Spacer />
										<Badge variant="outline" borderColor="#DEC8B5">국내주식</Badge>
									</Flex>

									<Heading mt="20px" fontSize="28px">{stock.price > 0 ? won.format(stock.price) : "-"}</Heading>
									<Text mt="5px" fontSize="13px" fontWeight="900" color={isUp ? "#E85D35" : "#356BC6"}>
										{isUp ? "▲" : "▼"} {won.format(Math.abs(stock.changePrice))} ({stock.changeRate > 0 ? "+" : ""}{stock.changeRate.toFixed(2)}%)
									</Text>

									<Divider my="18px" />

									<SimpleGrid columns={2} spacing="9px">
										{[
											["시가", stock.open, "price"],
											["고가", stock.high, "price"],
											["저가", stock.low, "price"],
											["거래량", stock.volume, "volume"],
										].map(([label, value, kind]) => (
											<Box key={String(label)} p="10px" borderRadius="9px" bg="#FAF6F1">
												<Text fontSize="9px" color="app.subtleText">{label}</Text>
												<Text mt="4px" fontSize="11px" fontWeight="900">
													{kind === "volume" ? numberFormat.format(Number(value)) : won.format(Number(value))}
												</Text>
											</Box>
										))}
									</SimpleGrid>
								</>
							) : (
								<Flex minH="240px" align="center" justify="center"><Text fontSize="11px" color="app.subtleText">종목 정보를 불러오지 못했습니다.</Text></Flex>
							)}
						</CardBody>
					</Card>

					<Card mt="5" borderColor="app.borderSoft">
						<CardBody p="5">
							<Heading fontSize="14px">AI 판단 읽는 법</Heading>
							<Stack mt="12px" spacing="10px">
								<Text fontSize="10px" lineHeight="1.7" color="app.subtleText"><b>판단</b> · 매수, 매도, 관망 중 현재 AI 결과입니다.</Text>
								<Text fontSize="10px" lineHeight="1.7" color="app.subtleText"><b>신뢰도</b> · 판단 확신도를 0~100으로 표시합니다.</Text>
								<Text fontSize="10px" lineHeight="1.7" color="app.subtleText"><b>요인</b> · 판단에 영향을 준 직접·간접 요인과 가중치입니다.</Text>
							</Stack>
						</CardBody>
					</Card>
				</GridItem>

				<GridItem minW="0">
					<Card borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73,52,30,.05)" overflow="hidden">
						{isLoadingJudgment ? (
							<CardBody p="6"><Stack><Skeleton h="160px" /><Skeleton h="120px" /><Skeleton h="220px" /></Stack></CardBody>
						) : errorText ? (
							<Flex minH="570px" direction="column" align="center" justify="center" textAlign="center" p="8">
								<Heading fontSize="18px">AI 판단을 불러오지 못했습니다.</Heading>
								<Text mt="8px" maxW="420px" fontSize="11px" color="app.subtleText">{errorText}</Text>
								<Button mt="16px" variant="outline" onClick={() => void load(selectedSymbol)}>다시 시도</Button>
							</Flex>
						) : notFound ? (
							<Flex minH="570px" direction="column" align="center" justify="center" textAlign="center" p="8">
								<Flex w="58px" h="58px" borderRadius="full" align="center" justify="center" bg="#F2ECE5" fontWeight="900">AI</Flex>
								<Heading mt="15px" fontSize="18px">아직 계산된 판단이 없습니다.</Heading>
								<Text mt="8px" fontSize="11px" color="app.subtleText">{stock?.name ?? selectedSymbol}의 AI 판단이 아직 저장되어 있지 않습니다.</Text>
								<Button mt="16px" variant="outline" onClick={() => void load(selectedSymbol)}>새로고침</Button>
							</Flex>
						) : judgment ? (
							<>
								<Box p={{ base: 5, md: 6 }} bg={theme.soft} borderBottomWidth="1px" borderColor={theme.border}>
									<Flex align={{ base: "flex-start", md: "center" }} direction={{ base: "column", md: "row" }} gap="18px">
										<Box>
											<Text fontSize="10px" fontWeight="900" color={theme.color}>AI의 현재 판단</Text>
											<Heading mt="6px" fontSize={{ base: "42px", md: "52px" }} lineHeight="1" letterSpacing="-0.07em" color={theme.color}>
												{judgment.judge}
											</Heading>
											<Text mt="10px" fontSize="10px" color="app.subtleText">{stock?.name ?? judgment.symbol} · {judgment.symbol}</Text>
										</Box>
										<Spacer />
										<Box w={{ base: "100%", md: "250px" }}>
											<Flex align="end">
												<Box>
													<Text fontSize="9px" color="app.subtleText">판단 신뢰도</Text>
													<Text mt="2px" fontSize="30px" fontWeight="900" color={theme.color}>{Math.round(judgment.confidence)}%</Text>
												</Box>
												<Spacer />
												<Text fontSize="9px" color="app.subtleText">0 — 100</Text>
											</Flex>
											<Progress mt="8px" value={judgment.confidence} h="8px" borderRadius="full" bg="rgba(255,255,255,.7)" sx={{ "& > div": { background: theme.color } }} />
										</Box>
									</Flex>
								</Box>

								<CardBody p={{ base: 5, md: 6 }}>
									<Heading fontSize="16px">AI 판단 요약</Heading>
									<Box mt="10px" p="15px" borderWidth="1px" borderColor="#E9DDD2" borderRadius="11px" bg="#FFFEFC">
										<Text fontSize="12px" lineHeight="1.85" color="#4E453E" whiteSpace="pre-wrap">{judgment.summary || "판단 요약이 없습니다."}</Text>
									</Box>

									<Divider my="22px" />

									<Box>
										<Flex mb="9px"><Heading fontSize="15px">핵심 판단 근거</Heading><Spacer /><Badge>{factors.length}</Badge></Flex>
										<Stack spacing="8px">
											{factors.map((factor, index) => <FactorCard key={`${factor.factor}-${index}`} factor={factor} />)}
											{factors.length === 0 && <Text fontSize="11px" color="app.subtleText">지금은 특별한 신호가 감지되지 않았어요.</Text>}
										</Stack>
									</Box>

									<Flex mt="20px" p="12px" borderRadius="10px" bg="#F7F2EC" align={{ base: "flex-start", md: "center" }} direction={{ base: "column", md: "row" }} gap="7px">
										<Text fontSize="9px" color="app.subtleText">최근 AI 계산 시각</Text>
										<Text fontSize="10px" fontWeight="900">{formatDate(judgment.computed_at)}</Text>
										<Spacer />
										<Button size="xs" variant="outline" onClick={() => void load(selectedSymbol)}>최신 판단 새로고침</Button>
									</Flex>

									<Box mt="12px" p="11px" borderWidth="1px" borderColor="#E8DDD2" borderRadius="9px">
										<Text fontSize="9px" lineHeight="1.7" color="#71665C">
											AI라면의 판단은 투자 권유가 아닌 학습·비교용 정보입니다. 실제 투자 의사결정은 사용자가 직접 확인한 정보와 위험을 함께 고려해야 합니다.
										</Text>
									</Box>
								</CardBody>
							</>
						) : null}
					</Card>
				</GridItem>
			</Grid>
		</Box>
	);
}
