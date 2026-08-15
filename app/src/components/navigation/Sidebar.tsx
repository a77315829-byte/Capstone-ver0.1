import {
	Box,
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerOverlay,
	Flex,
	Image,
	Stack,
	Text,
} from "@chakra-ui/react";
import {
	Link as RouterLink,
	useLocation,
} from "react-router-dom";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

interface NavigationItem {
	label: string;
	to?: string;
	activePaths?: string[];
}

const NAVIGATION_ITEMS: NavigationItem[] = [
	{
		label: "실시간 차트",
		to: "/exchange",
		activePaths: ["/exchange", "/stocks"],
	},
	{
		label: "과거 시나리오",
		to: "/scenario",
		activePaths: ["/scenario"],
	},
	{
		label: "금융 사전퀴즈",
		to: "/learn",
		activePaths: [
			"/learn",
			"/learning",
			"/finance-learning",
			"/dictionary",
			"/quiz",
		],
	},
	{
		label: "시장반응 시뮬레이터",
		to: "/simulator",
		activePaths: ["/simulator"],
	},
	{
		label: "실시간 뉴스",
		to: "/news",
		activePaths: ["/news"],
	},
	{
		label: "AI 라면",
		to: "/ai-judgment",
		activePaths: ["/ai-judgment"],
	},
	{ label: "설정" },
];

function isPathActive(
	pathname: string,
	activePaths: string[] = [],
): boolean {
	return activePaths.some(
		(path) =>
			pathname === path ||
			pathname.startsWith(`${path}/`),
	);
}

function SidebarItem({
	item,
	onNavigate,
}: {
	item: NavigationItem;
	onNavigate?: () => void;
}) {
	const location = useLocation();
	const active = isPathActive(
		location.pathname,
		item.activePaths,
	);

	const commonProps = {
		h: "48px",
		px: "18px",
		align: "center",
		borderRadius: "8px",
		fontSize: "14px",
		fontWeight: active ? "800" : "700",
		letterSpacing: "-0.025em",
		position: "relative" as const,
		transition: "background-color 0.15s ease, color 0.15s ease",
	};

	if (!item.to) {
		return (
			<Flex
				{...commonProps}
				color="app.text"
				opacity="0.72"
				cursor="default"
			>
				<Text>{item.label}</Text>
			</Flex>
		);
	}

	return (
		<Flex
			{...commonProps}
			as={RouterLink}
			to={item.to}
			bg={active ? "app.surface" : "transparent"}
			color={active ? "brand.500" : "app.text"}
			boxShadow={active ? "0 3px 10px rgba(86, 61, 38, 0.09)" : "none"}
			textDecoration="none"
			_hover={{
				bg: active ? "app.surface" : "app.hover",
				color: active ? "brand.500" : "app.text",
			}}
			onClick={onNavigate}
		>
			{active && (
				<Box
					position="absolute"
					left="0"
					top="7px"
					bottom="7px"
					w="4px"
					borderRadius="0 999px 999px 0"
					bg="brand.500"
				/>
			)}
			<Text>{item.label}</Text>
		</Flex>
	);
}

function SidebarContent({
	onNavigate,
}: {
	onNavigate?: () => void;
}) {
	return (
		<Flex
			h="100%"
			direction="column"
			px="14px"
			pt="17px"
			pb="22px"
		>
			<Flex
				as={RouterLink}
				to="/scenario"
				align="center"
				justify="center"
				h="88px"
				mb="4px"
				overflow="hidden"
				onClick={onNavigate}
				textDecoration="none"
			>
				<Image
					src="/logo.png?v=4"
					alt="앤튜"
					w="190px"
					h="76px"
					maxW="none"
					maxH="none"
					objectFit="contain"
					transform="scale(1.28)"
					transformOrigin="center"
				/>
			</Flex>

			<Stack spacing="4px">
				{NAVIGATION_ITEMS.map((item) => (
					<SidebarItem
						key={item.label}
						item={item}
						onNavigate={onNavigate}
					/>
				))}
			</Stack>

			<Box
				mt="28px"
				mx="2px"
				p="18px 20px"
				borderRadius="8px"
				bg="#F8F1E7"
				borderWidth="1px"
				borderColor="app.borderSoft"
			>
				<Text
					fontSize="14px"
					fontWeight="800"
					letterSpacing="-0.025em"
				>
					연속 학습 3일째!
				</Text>
				<Text mt="10px" fontSize="12px" color="app.subtleText">
					꾸준함이 학습을 만듭니다.
				</Text>
				<Text mt="14px" fontSize="12px" fontWeight="700">
					3일 연속
				</Text>
			</Box>

			<Box flex="1" minH="24px" />
		</Flex>
	);
}

export default function Sidebar({
	isOpen,
	onClose,
}: SidebarProps) {
	return (
		<>
			<Box
				display={{ base: "none", "2xl": "block" }}
				position="fixed"
				left="0"
				top="0"
				bottom="0"
				w="246px"
				bg="app.sidebar"
				borderRightWidth="1px"
				borderColor="app.border"
				zIndex={1300}
				overflowY="auto"
			>
				<SidebarContent />
			</Box>

			<Drawer
				isOpen={isOpen}
				placement="left"
				onClose={onClose}
				size="xs"
			>
				<DrawerOverlay />
				<DrawerContent bg="app.sidebar">
					<DrawerBody p="0">
						<SidebarContent onNavigate={onClose} />
					</DrawerBody>
				</DrawerContent>
			</Drawer>
		</>
	);
}
