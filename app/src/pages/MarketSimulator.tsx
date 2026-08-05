import {
	Box,
	Card,
	CardBody,
	Flex,
	Heading,
	HStack,
	Stack,
	Text,
} from "@chakra-ui/react";
import {
	useMemo,
	useState,
} from "react";
import {
	useSearchParams,
} from "react-router-dom";

import MarketSimulatorPanel from "../components/MarketSimulatorPanel";
import StockSearchBox, {
	type StockMarketType,
	type StockSearchSelection,
} from "../components/search/StockSearchBox";

const STORAGE_KEY =
	"antitude:selectedStock";

const DEFAULT_STOCK: StockSearchSelection = {
	symbol: "005930",
	name: "삼성전자",
	market: "KOSPI",
	marketType: "KR",
};

function inferMarketType(
	market?: string,
): StockMarketType {
	const value = (
		market || ""
	).toUpperCase();

	return value.includes("NASDAQ") ||
		value.includes("NYSE") ||
		value.includes("AMEX") ||
		value === "NAS" ||
		value === "NYS" ||
		value === "AMS"
		? "US"
		: "KR";
}

function readStoredStock(): StockSearchSelection {
	try {
		const raw =
			sessionStorage.getItem(
				STORAGE_KEY,
			);

		if (!raw) {
			return DEFAULT_STOCK;
		}

		const parsed =
			JSON.parse(
				raw,
			) as Partial<StockSearchSelection>;

		if (!parsed.symbol) {
			return DEFAULT_STOCK;
		}

		return {
			symbol:
				parsed.symbol,
			name:
				parsed.name ||
				parsed.symbol,
			market:
				parsed.market ||
				"KRX",
			marketType:
				parsed.marketType ||
				inferMarketType(
					parsed.market,
				),
			exchange:
				parsed.exchange,
		};
	} catch {
		return DEFAULT_STOCK;
	}
}

export default function MarketSimulator() {
	const [
		searchParams,
		setSearchParams,
	] = useSearchParams();

	const initialStock =
		useMemo(() => {
			const stored =
				readStoredStock();

			const market =
				searchParams.get(
					"market",
				) ||
				stored.market;

			const marketType =
				(
					searchParams.get(
						"marketType",
					) as StockMarketType | null
				) ||
				stored.marketType ||
				inferMarketType(
					market,
				);

			return {
				symbol:
					searchParams.get(
						"symbol",
					) ||
					stored.symbol,
				name:
					searchParams.get(
						"name",
					) ||
					stored.name,
				market,
				marketType,
				exchange:
					searchParams.get(
						"exchange",
					) ||
					stored.exchange,
			};
		}, []);

	const [
		selectedStock,
		setSelectedStock,
	] =
		useState<StockSearchSelection>(
			initialStock,
		);

	const [
		searchMarketType,
		setSearchMarketType,
	] =
		useState<StockMarketType>(
			initialStock.marketType,
		);

	const selectStock = (
		stock: StockSearchSelection,
	) => {
		setSelectedStock(stock);
		setSearchMarketType(
			stock.marketType,
		);

		const nextParams: Record<
			string,
			string
		> = {
			symbol: stock.symbol,
			name: stock.name,
			market: stock.market,
			marketType:
				stock.marketType,
		};

		if (stock.exchange) {
			nextParams.exchange =
				stock.exchange;
		}

		setSearchParams(nextParams);

		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify(stock),
			);
		} catch {
			// 저장소를 사용할 수 없어도 현재 페이지의 시뮬레이션은 유지합니다.
		}
	};

	return (
		<Box
			px={{
				base: 4,
				md: 8,
			}}
			py="6"
			minH="100vh"
			bg="app.background"
		>
			<Stack spacing="5">
				<Box>
					<Heading size="lg">
						시장반응 시뮬레이터
					</Heading>
					<Text
						mt="1"
						color="app.subtleText"
					>
						기준 종목을 검색한 뒤 뉴스와 이벤트가 시장참여자에게 미칠 반응을 분석합니다.
					</Text>
				</Box>

				<Card>
					<CardBody>
						<Stack spacing="4">
							<Box>
								<Text
									fontSize="sm"
									fontWeight="800"
									mb="2"
								>
									기준 종목 검색
								</Text>

								<StockSearchBox
									marketType={
										searchMarketType
									}
									onMarketTypeChange={
										setSearchMarketType
									}
									onSelect={
										selectStock
									}
									placeholder="시뮬레이션 기준 종목명 또는 종목코드"
								/>
							</Box>

							<Flex
								px="16px"
								py="14px"
								align={{
									base:
										"flex-start",
									md: "center",
								}}
								direction={{
									base:
										"column",
									md: "row",
								}}
								gap="8px"
								borderWidth="1px"
								borderColor="app.borderSoft"
								borderRadius="10px"
								bg="#FAF6EF"
							>
								<Text
									fontSize="12px"
									fontWeight="800"
									color="app.subtleText"
								>
									현재 기준 종목
								</Text>

								<HStack
									spacing="8px"
									wrap="wrap"
								>
									<Text
										fontSize="15px"
										fontWeight="900"
									>
										{
											selectedStock.name
										}
									</Text>
									<Text
										fontSize="13px"
										color="app.subtleText"
									>
										{
											selectedStock.symbol
										}
										{" · "}
										{
											selectedStock.market
										}
									</Text>
								</HStack>
							</Flex>
						</Stack>
					</CardBody>
				</Card>

				<MarketSimulatorPanel
					stock={{
						symbol:
							selectedStock.symbol,
						name:
							selectedStock.name,
						price: 0,
						changeRate: 0,
					}}
					displayMode="page"
				/>
			</Stack>
		</Box>
	);
}
