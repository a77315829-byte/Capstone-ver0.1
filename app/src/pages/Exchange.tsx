import MarketOverview from "../components/MarketOverview";
import { FxProvider, FxToolbar } from "../components/FxExchange";
import {
	useCallback,
	useEffect,
} from "react";

import {
	Box,
	Button,
	ButtonGroup,
	Flex,
	Text,
} from "@chakra-ui/react";

import {
	useSearchParams,
} from "react-router-dom";

import DomesticExchange from "./DomesticExchange";
import UsMarketPanel from "../components/UsMarketPanel";
import HoldingsPanel from "../components/HoldingsPanel";

type MarketView =
	| "KR"
	| "US";

export interface SelectedExchangeStock {
	symbol: string;
	name: string;
	market: string;
}

const SELECTED_STOCK_STORAGE_KEY =
	"antitude:selectedStock";

function rememberSelectedStock(
	stock: SelectedExchangeStock,
) {
	try {
		sessionStorage.setItem(
			SELECTED_STOCK_STORAGE_KEY,
			JSON.stringify(stock),
		);
	} catch {
		// 브라우저 저장소를 사용할 수 없어도 거래 화면은 계속 동작합니다.
	}
}

function ExchangeContent() {
	const [
		searchParams,
		setSearchParams,
	] = useSearchParams();

	const queryMarket: MarketView =
		searchParams
			.get("market")
			?.toUpperCase() === "US"
			? "US"
			: "KR";

	const marketView = queryMarket;
	const selectedSymbol = searchParams.get("symbol")?.trim() || "";

	const handleSelectedStockChange =
		useCallback(
			(
				stock:
					SelectedExchangeStock,
			) => {
				rememberSelectedStock(
					stock,
				);
			},
			[],
		);

	useEffect(() => {
		if (!selectedSymbol) {
			try { sessionStorage.removeItem(SELECTED_STOCK_STORAGE_KEY); } catch { /* optional storage */ }
		}
	}, [selectedSymbol]);

	const changeMarket = (market: MarketView) => setSearchParams({ market, ...(searchParams.get('ranking') ? { ranking: searchParams.get('ranking')! } : {}) });

	return (
		<Box
			minH="100vh"
			bg="app.background"
		>
			<Flex
				position="sticky"
				top="0"
				zIndex="20"
				px={{
					base: 4,
					md: 8,
				}}
				py="3"
				align={{
					base:
						"stretch",
					md: "center",
				}}
				direction={{
					base:
						"column",
					md: "row",
				}}
				gap="3"
				bg="app.background"
				borderBottomWidth="1px"
				borderColor="app.borderSoft"
			>
				<Box>
					<Text
						fontWeight="900"
					>
						거래시장 선택
					</Text>
					<Text
						fontSize="xs"
						color="gray.600"
					>
						시장 순위에서 종목을 선택하거나 상단에서 검색하세요.
					</Text>
				</Box>

				<FxToolbar />
				<ButtonGroup
					ml={{
						base: 0,
						md: "auto",
					}}
					isAttached
					size="sm"
				>
					<Button
						bg={
							marketView ===
								"KR"
								? "brand.500"
								: "white"
						}
						color={
							marketView ===
								"KR"
								? "white"
								: "brand.500"
						}
						borderWidth="1px"
						borderColor="brand.500"
						fontWeight="800"
						_hover={{
							bg:
								marketView ===
									"KR"
									? "brand.500"
									: "#FFF1E8",
						}}
						_active={{
							bg:
								marketView ===
									"KR"
									? "brand.500"
									: "#FFE4D4",
						}}
						_focusVisible={{
							boxShadow:
								"0 0 0 3px rgba(255, 99, 56, 0.22)",
						}}
						onClick={() =>
							changeMarket(
								"KR",
							)
						}
					>
						국내 주식
					</Button>

					<Button
						bg={
							marketView ===
								"US"
								? "brand.500"
								: "white"
						}
						color={
							marketView ===
								"US"
								? "white"
								: "brand.500"
						}
						borderWidth="1px"
						borderColor="brand.500"
						fontWeight="800"
						_hover={{
							bg:
								marketView ===
									"US"
									? "brand.500"
									: "#FFF1E8",
						}}
						_active={{
							bg:
								marketView ===
									"US"
									? "brand.500"
									: "#FFE4D4",
						}}
						_focusVisible={{
							boxShadow:
								"0 0 0 3px rgba(255, 99, 56, 0.22)",
						}}
						onClick={() =>
							changeMarket(
								"US",
							)
						}
					>
						미국 주식
					</Button>
				</ButtonGroup>
			</Flex>

			{!selectedSymbol ? <MarketOverview market={marketView} /> : <>
                <Box px={{ base: 4, md: 8 }} pt="4"><Button size="sm" variant="ghost" colorScheme="orange" onClick={() => changeMarket(marketView)}>← 시장 둘러보기</Button></Box>
                {marketView === "KR" ? (
				<DomesticExchange key={selectedSymbol}
					onStockChange={
						handleSelectedStockChange
					}
				/>
			) : (
				<UsMarketPanel
					onStockChange={
						handleSelectedStockChange
					}
				/>
			)}</>}
			<HoldingsPanel market={queryMarket} />
		</Box>
	);
}

export default function Exchange() { return <FxProvider><ExchangeContent /></FxProvider>; }
