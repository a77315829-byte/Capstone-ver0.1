import {
	Box,
	Flex,
	IconButton,
	Text,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import {
	useLocation,
	useNavigate,
} from "react-router-dom";

import AccountMenu from "../AccountMenu";
import StockSearchBox, {
	type StockMarketType,
	type StockSearchSelection,
} from "../search/StockSearchBox";

interface TopHeaderProps {
	onOpenNavigation: () => void;
}

const STORAGE_KEY =
	"antitude:selectedStock";

function AntTrail() {
	return (
		<Box
			display={{ base: "none", "2xl": "block" }}
			flex="1"
			minW="300px"
			maxW="760px"
			h="46px"
			overflow="hidden"
		>
			<svg
				width="100%"
				height="46"
				viewBox="0 0 760 46"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path
					d="M8 14 C58 42 96 4 148 24 C208 47 245 5 302 25 C360 47 404 5 463 24 C525 46 569 4 628 24 C678 43 712 13 752 24"
					fill="none"
					stroke="#E7D6C2"
					strokeWidth="1.2"
					strokeDasharray="5 6"
				/>
				{[
					[18, 18],
					[112, 17],
					[207, 23],
					[300, 25],
					[395, 19],
					[492, 26],
					[589, 20],
					[690, 28],
				].map(([x, y], index) => (
					<g
						key={`${x}-${y}-${index}`}
						transform={`translate(${x} ${y})`}
					>
						<circle
							cx="0"
							cy="0"
							r="2.1"
							fill="#171717"
						/>
						<circle
							cx="5"
							cy="-1"
							r="1.8"
							fill="#171717"
						/>
						<line
							x1="1"
							y1="1"
							x2="-3"
							y2="4"
							stroke="#171717"
							strokeWidth="0.9"
						/>
						<line
							x1="3"
							y1="1"
							x2="5"
							y2="4"
							stroke="#171717"
							strokeWidth="0.9"
						/>
					</g>
				))}
			</svg>
		</Box>
	);
}

export default function TopHeader({
	onOpenNavigation,
}: TopHeaderProps) {
	const location = useLocation();
	const navigate = useNavigate();

	const isExchangePage =
		location.pathname === "/exchange";

	const currentMarket: StockMarketType =
		new URLSearchParams(
			location.search,
		)
			.get("market")
			?.toUpperCase() === "US"
			? "US"
			: "KR";

	const changeMarket = (
		marketType: StockMarketType,
	) => {
		const params =
			new URLSearchParams();

		params.set(
			"market",
			marketType,
		);

		navigate({
			pathname: "/exchange",
			search: params.toString(),
		});
	};

	const selectStock = (
		stock: StockSearchSelection,
	) => {
		const params =
			new URLSearchParams();

		params.set(
			"market",
			stock.marketType,
		);
		params.set(
			"symbol",
			stock.symbol,
		);
		params.set(
			"name",
			stock.name,
		);
		params.set(
			"stockMarket",
			stock.market,
		);

		if (stock.exchange) {
			params.set(
				"exchange",
				stock.exchange,
			);
		}

		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify(stock),
			);
		} catch {
			// 저장소를 사용할 수 없어도 URL과 현재 화면 전환은 유지합니다.
		}

		navigate({
			pathname: "/exchange",
			search: params.toString(),
		});

		window.dispatchEvent(
			new CustomEvent(
				"antitude:stock-selected",
				{
					detail: stock,
				},
			),
		);
	};

	return (
		<Flex
			as="header"
			position="sticky"
			top="0"
			zIndex={1200}
			minH={{
				base: "68px",
				xl: "82px",
			}}
			px={{
				base: "14px",
				md: "22px",
			}}
			py={{
				base: "10px",
				xl: "14px",
			}}
			align="center"
			gap={{
				base: "10px",
				xl: "16px",
			}}
			bg="rgba(253, 250, 244, 0.96)"
			backdropFilter="blur(10px)"
			borderBottomWidth="1px"
			borderColor="app.borderSoft"
		>
			<IconButton
				display={{
					base: "inline-flex",
					"2xl": "none",
				}}
				aria-label="메뉴 열기"
				icon={<HamburgerIcon />}
				variant="ghost"
				onClick={onOpenNavigation}
			/>

			{isExchangePage && (
				<Box
					flex={{
						base: "1",
						md: "0 0 520px",
						xl: "0 0 590px",
					}}
					minW="0"
					maxW="100%"
				>
					<StockSearchBox
						marketType={currentMarket}
						onMarketTypeChange={
							changeMarket
						}
						onSelect={selectStock}
						compact
					/>
				</Box>
			)}

			<Text
				display={{
					base: "none",
					lg: "block",
				}}
				fontSize="12px"
				fontWeight="700"
				whiteSpace="nowrap"
				color="app.text"
			>
				성실한 개미의 태도가 곧{" "}
				<Box
					as="span"
					color="brand.500"
				>
					수익
				</Box>
				이 됩니다!
			</Text>

			<AntTrail />

			<Box flex="1" />
			<AccountMenu />
		</Flex>
	);
}
