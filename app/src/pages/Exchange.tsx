import React, {
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

	useEffect(() => {
		setMarketView(
			queryMarket,
		);
	}, [queryMarket]);

	const changeMarket = (
		market: MarketView,
	) => {
		setMarketView(market);
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
				<DomesticExchange />
			) : (
				<UsMarketPanel />
			)}
		</Box>
	);
}
