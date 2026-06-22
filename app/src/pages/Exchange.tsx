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
import FloatingNewsDrawer from "../components/FloatingNewsDrawer";
import UsMarketPanel from "../components/UsMarketPanel";

type MarketView =
	| "KR"
	| "US";

export interface SelectedNewsStock {
	symbol: string;
	name: string;
	market: string;
}

export default function Exchange() {
	const [
		searchParams,
		setSearchParams,
	] = useSearchParams();

	const queryMarket =
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

	const [
		selectedNewsStock,
		setSelectedNewsStock,
	] =
		useState<SelectedNewsStock>(
			queryMarket === "US"
				? {
						symbol: "NVDA",
						name: "엔비디아",
						market: "NASDAQ",
					}
				: {
						symbol: "005930",
						name: "삼성전자",
						market: "KOSPI",
					},
		);

	const handleSelectedStockChange =
		useCallback(
			(
				stock:
					SelectedNewsStock,
			) => {
				setSelectedNewsStock(
					stock,
				);
			},
			[],
		);

	useEffect(() => {
		setMarketView(
			queryMarket,
		);
	}, [queryMarket]);

	const changeMarket = (
		market: MarketView,
	) => {
		setMarketView(market);

		setSelectedNewsStock(
			market === "US"
				? {
						symbol: "NVDA",
						name: "엔비디아",
						market: "NASDAQ",
					}
				: {
						symbol: "005930",
						name: "삼성전자",
						market: "KOSPI",
					},
		);

		setSearchParams({
			market,
		});
	};

	return (
		<Box
			minH="100vh"
			bg="gray.50"
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
				bg="white"
				borderBottomWidth="1px"
				borderColor="gray.200"
			>
				<Box>
					<Text
						fontWeight="900"
					>
						거래시장 선택
					</Text>
					<Text
						fontSize="xs"
						color="gray.500"
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
						colorScheme="blue"
						variant={
							marketView ===
							"KR"
								? "solid"
								: "outline"
						}
						onClick={() =>
							changeMarket(
								"KR",
							)
						}
					>
						국내 주식
					</Button>

					<Button
						colorScheme="blue"
						variant={
							marketView ===
							"US"
								? "solid"
								: "outline"
						}
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

			<FloatingNewsDrawer
				symbol={
					selectedNewsStock.symbol
				}
				name={
					selectedNewsStock.name
				}
				market={
					selectedNewsStock.market
				}
			/>
		</Box>
	);
}
