import React, {
	useCallback,
	useEffect,
	useState,
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

function getDefaultStock(
	market: MarketView,
): SelectedExchangeStock {
	return market === "US"
		? {
			symbol: "NVDA",
			name: "엔비디아",
			market: "NASDAQ",
		}
		: {
			symbol: "005930",
			name: "삼성전자",
			market: "KOSPI",
		};
}

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

export default function Exchange() {
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

	const [
		marketView,
		setMarketView,
	] =
		useState<MarketView>(
			queryMarket,
		);

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
		setMarketView(
			queryMarket,
		);

		rememberSelectedStock(
			getDefaultStock(
				queryMarket,
			),
		);
	}, [queryMarket]);

	const changeMarket = (
		market: MarketView,
	) => {
		setMarketView(market);

		rememberSelectedStock(
			getDefaultStock(
				market,
			),
		);

		setSearchParams({
			market,
		});
	};

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
						선택한 시장의 데이터만
						불러와 속도 저하를
						줄입니다.
					</Text>
				</Box>

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

			{marketView === "KR" ? (
				<DomesticExchange
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
			)}
		</Box>
	);
}
