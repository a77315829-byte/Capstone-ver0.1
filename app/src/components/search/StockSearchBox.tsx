import {
	Badge,
	Box,
	Button,
	ButtonGroup,
	Flex,
	Input,
	InputGroup,
	InputLeftElement,
	Spinner,
	Stack,
	Text,
	useToast,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import {
	useEffect,
	useRef,
	useState,
} from "react";

import api from "../../services/api.service";

export type StockMarketType = "KR" | "US";

export interface StockSearchSelection {
	symbol: string;
	name: string;
	market: string;
	marketType: StockMarketType;
	exchange?: string;
}

interface StockSearchBoxProps {
	marketType: StockMarketType;
	onMarketTypeChange?: (
		marketType: StockMarketType,
	) => void;
	onSelect: (
		stock: StockSearchSelection,
	) => void;
	compact?: boolean;
	placeholder?: string;
}

type RawSearchResult = {
	symbol?: string;
	code?: string;
	pdno?: string;
	name?: string;
	longName?: string;
	longname?: string;
	shortName?: string;
	shortname?: string;
	prdt_name?: string;
	market?: string;
	exchange?: string;
	exchDisp?: string;
	mket_id_cd?: string;
	assetType?: string;
	quoteType?: string;
	tradable?: boolean;
};

function unwrapApiData(raw: unknown): unknown {
	const value = raw as {
		success?: boolean;
		data?: unknown;
		output?: unknown;
	};

	if (
		value?.success === true &&
		value.data !== undefined
	) {
		return value.data;
	}

	if (value?.data !== undefined) {
		return value.data;
	}

	if (value?.output !== undefined) {
		return value.output;
	}

	return raw;
}

function normalizeExchange(
	rawExchange?: string,
	rawMarket?: string,
): string {
	const value = (
		rawExchange ||
		rawMarket ||
		""
	).toUpperCase();

	if (
		value === "NAS" ||
		value.includes("NASDAQ")
	) {
		return "NAS";
	}

	if (
		value === "NYS" ||
		value.includes("NYSE")
	) {
		return "NYS";
	}

	if (
		value === "AMS" ||
		value.includes("AMEX")
	) {
		return "AMS";
	}

	return rawExchange || "NAS";
}

function normalizeMarketName(
	rawMarket?: string,
	rawExchange?: string,
): string {
	const market = (
		rawMarket ||
		rawExchange ||
		""
	).toUpperCase();

	if (
		market === "NAS" ||
		market.includes("NASDAQ")
	) {
		return "NASDAQ";
	}

	if (
		market === "NYS" ||
		market.includes("NYSE")
	) {
		return "NYSE";
	}

	if (
		market === "AMS" ||
		market.includes("AMEX")
	) {
		return "AMEX";
	}

	return rawMarket || rawExchange || "KRX";
}

function normalizeResults(
	raw: unknown,
	marketType: StockMarketType,
): StockSearchSelection[] {
	const list = unwrapApiData(raw);

	if (!Array.isArray(list)) {
		return [];
	}

	return list
		.map((item) => {
			const value =
				item as RawSearchResult;

			const symbol = (
				value.symbol ||
				value.code ||
				value.pdno ||
				""
			)
				.trim()
				.toUpperCase();

			const name =
				value.name ||
				value.longName ||
				value.longname ||
				value.shortName ||
				value.shortname ||
				value.prdt_name ||
				symbol;

			const market =
				normalizeMarketName(
					value.market ||
						value.exchDisp ||
						value.mket_id_cd,
					value.exchange,
				);

			return {
				symbol,
				name,
				market,
				marketType,
				exchange:
					marketType === "US"
						? normalizeExchange(
								value.exchange,
								market,
							)
						: undefined,
			};
		})
		.filter(
			(item) =>
				item.symbol &&
				item.name,
		)
		.slice(0, 10);
}

export default function StockSearchBox({
	marketType,
	onMarketTypeChange,
	onSelect,
	compact = false,
	placeholder,
}: StockSearchBoxProps) {
	const toast = useToast();
	const containerRef =
		useRef<HTMLDivElement | null>(
			null,
		);

	const [query, setQuery] =
		useState("");
	const [results, setResults] =
		useState<StockSearchSelection[]>(
			[],
		);
	const [isSearching, setIsSearching] =
		useState(false);
	const [isOpen, setIsOpen] =
		useState(false);

	useEffect(() => {
		setQuery("");
		setResults([]);
		setIsOpen(false);
	}, [marketType]);

	useEffect(() => {
		const handleOutsideClick = (
			event: MouseEvent,
		) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(
					event.target as Node,
				)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener(
			"mousedown",
			handleOutsideClick,
		);

		return () => {
			document.removeEventListener(
				"mousedown",
				handleOutsideClick,
			);
		};
	}, []);

	const runSearch = async () => {
		const keyword = query.trim();

		if (!keyword) {
			setResults([]);
			setIsOpen(false);
			return;
		}

		try {
			setIsSearching(true);

			const endpoint =
				marketType === "KR"
					? `/stocks/search/${encodeURIComponent(
							keyword,
						)}`
					: `/us-stocks/search/${encodeURIComponent(
							keyword,
						)}`;

			const response =
				await api.get(endpoint);

			const nextResults =
				normalizeResults(
					response.data,
					marketType,
				);

			setResults(nextResults);
			setIsOpen(true);

			if (
				nextResults.length === 0
			) {
				toast({
					title:
						"검색 결과가 없습니다.",
					description:
						marketType === "KR"
							? "종목명 또는 6자리 종목코드를 확인하세요."
							: "기업명, ETF명 또는 영문 티커를 확인하세요.",
					status: "info",
					duration: 2200,
					isClosable: true,
				});
			}
		} catch (error: any) {
			console.error(
				"종목 검색 실패:",
				error,
			);

			toast({
				title:
					"종목 검색에 실패했습니다.",
				description:
					error?.response?.data
						?.message ??
					"검색 API 연결 상태를 확인하세요.",
				status: "error",
				duration: 2800,
				isClosable: true,
			});
		} finally {
			setIsSearching(false);
		}
	};

	const selectResult = (
		stock: StockSearchSelection,
	) => {
		setQuery(stock.name);
		setResults([]);
		setIsOpen(false);
		onSelect(stock);
	};

	return (
		<Box
			ref={containerRef}
			position="relative"
			w="100%"
		>
			<Flex
				direction={{
					base: "column",
					sm: compact
						? "row"
						: "column",
					md: "row",
				}}
				gap="8px"
				align="stretch"
			>
				

				<Flex
					flex="1"
					gap="8px"
					minW="0"
				>
					<InputGroup>
						<InputLeftElement
							pointerEvents="none"
							h={compact
								? "40px"
								: "44px"}
						>
							<SearchIcon
								color="app.subtleText"
								boxSize="15px"
							/>
						</InputLeftElement>

						<Input
							h={compact
								? "40px"
								: "44px"}
							value={query}
							onChange={(event) =>
								setQuery(
									event.target.value,
								)
							}
							onFocus={() => {
								if (
									results.length > 0
								) {
									setIsOpen(true);
								}
							}}
							onKeyDown={(event) => {
								if (
									event.key ===
									"Enter"
								) {
									void runSearch();
								}

								if (
									event.key ===
									"Escape"
								) {
									setIsOpen(false);
								}
							}}
							placeholder={
								placeholder ??
								(marketType === "KR"
									? "종목명 또는 종목코드"
									: "기업명·ETF 또는 티커")
							}
							fontSize="13px"
							bg="app.surface"
						/>
					</InputGroup>

					<Button
						h={compact
							? "40px"
							: "44px"}
						minW={compact
							? "64px"
							: "82px"}
						bg="brand.500"
						color="white"
						onClick={() =>
							void runSearch()
						}
						isLoading={isSearching}
						loadingText="검색"
						_hover={{
							bg: "brand.600",
						}}
					>
						검색
					</Button>
				</Flex>
			</Flex>

			{isOpen && (
				<Box
					position="absolute"
					top="calc(100% + 8px)"
					left={{
						base: 0,
						md: compact
							? "104px"
							: "156px",
					}}
					right="0"
					zIndex={1700}
					bg="white"
					borderWidth="1px"
					borderColor="app.border"
					borderRadius="10px"
					boxShadow="0 14px 34px rgba(42, 31, 21, 0.16)"
					overflow="hidden"
				>
					{isSearching ? (
						<Flex
							h="96px"
							align="center"
							justify="center"
						>
							<Spinner size="sm" />
						</Flex>
					) : (
						<Stack
							spacing="0"
							maxH="360px"
							overflowY="auto"
						>
							{results.map(
								(stock) => (
									<Flex
										key={`${stock.marketType}-${stock.exchange ?? stock.market}-${stock.symbol}`}
										as="button"
										type="button"
										w="100%"
										px="14px"
										py="12px"
										align="center"
										gap="12px"
										textAlign="left"
										borderBottomWidth="1px"
										borderColor="app.borderSoft"
										bg="white"
										_hover={{
											bg: "app.hover",
										}}
										onClick={() =>
											selectResult(
												stock,
											)
										}
									>
										<Box minW="0">
											<Text
												fontSize="14px"
												fontWeight="800"
												noOfLines={1}
											>
												{stock.name}
											</Text>
											<Text
												mt="2px"
												fontSize="12px"
												color="app.subtleText"
											>
												{stock.symbol}
												{" · "}
												{stock.market}
											</Text>
										</Box>

										<Box flex="1" />

										<Badge
											colorScheme={
												stock.marketType ===
												"KR"
													? "orange"
													: "blue"
											}
										>
											{stock.marketType ===
											"KR"
												? "국내"
												: "미국"}
										</Badge>
									</Flex>
								),
							)}
						</Stack>
					)}
				</Box>
			)}
		</Box>
	);
}
