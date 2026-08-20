import {
	Box,
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerOverlay,
	Flex,
	Icon,
	Image,
	Stack,
	Text,
} from "@chakra-ui/react";

import {
	Link as RouterLink,
	useLocation,
} from "react-router-dom";

import type {
	IconType,
} from "react-icons";

import {
	FiBarChart2,
} from "react-icons/fi";

import {
	LuHouse,
	LuClock,
	LuFileText,
	LuBookOpen,
} from "react-icons/lu";


interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}


interface NavigationItem {
	label: string;
	to: string;
	activePaths: string[];
	icon: IconType;
}


const NAVIGATION_ITEMS: NavigationItem[] = [
	{
		label: "마이페이지",
		to: "/mypage",
		activePaths: [
			"/mypage",
		],
		icon: LuHouse,
	},
	{
		label: "실시간 차트",
		to: "/exchange",
		activePaths: [
			"/exchange",
			"/stocks",
		],
		icon: FiBarChart2,
	},
	{
		label: "과거 시나리오",
		to: "/scenario",
		activePaths: [
			"/scenario",
		],
		icon: LuClock,
	},
	{
		label: "실시간 뉴스",
		to: "/news",
		activePaths: [
			"/news",
		],
		icon: LuFileText,
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
		icon: LuBookOpen,
	},
];


function isPathActive(
	pathname: string,
	activePaths: string[],
) {
	return activePaths.some(
		(path) =>
			pathname === path ||
			pathname.startsWith(
				`${path}/`,
			),
	);
}


function SidebarItem({
	item,
	onNavigate,
}: {
	item: NavigationItem;
	onNavigate?: () => void;
}) {
	const location =
		useLocation();

	const active =
		isPathActive(
			location.pathname,
			item.activePaths,
		);

	return (
		<Flex
			as={RouterLink}
			to={item.to}
			h="48px"
			px="18px"
			align="center"
			gap="12px"
			position="relative"
			borderRadius="8px"
			bg={
				active
					? "white"
					: "transparent"
			}
			color={
				active
					? "#F36F2A"
					: "#29231E"
			}
			boxShadow={
				active
					? "0 4px 12px rgba(70, 48, 27, 0.08)"
					: "none"
			}
			fontSize="14px"
			fontWeight={
				active
					? "900"
					: "700"
			}
			textDecoration="none"
			transition="all .15s ease"
			_hover={{
				bg:
					active
						? "white"
						: "#F8F1E8",
			}}
			onClick={
				onNavigate
			}
		>
			{active && (
				<Box
					position="absolute"
					left="0"
					top="7px"
					bottom="7px"
					w="4px"
					borderRadius="0 999px 999px 0"
					bg="#F36F2A"
				/>
			)}

			<Icon
				as={item.icon}
				boxSize="20px"
				strokeWidth="2"
				flexShrink={0}
			/>

			<Text>
				{item.label}
			</Text>
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
				to="/mypage"
				align="center"
				justify="center"
				h="88px"
				mb="12px"
				overflow="hidden"
				onClick={
					onNavigate
				}
			>
				<Image
					src="/logo.png?v=4"
					alt="앤튜"
					w="190px"
					h="76px"
					objectFit="contain"
					transform="scale(1.28)"
				/>
			</Flex>

			<Stack spacing="4px">
				{NAVIGATION_ITEMS.map(
					(item) => (
						<SidebarItem
							key={
								item.label
							}
							item={
								item
							}
							onNavigate={
								onNavigate
							}
						/>
					),
				)}
			</Stack>

			<Box
				mt="28px"
				mx="2px"
				p="18px 20px"
				borderRadius="8px"
				bg="#F8F1E7"
				borderWidth="1px"
				borderColor="#E8DCCE"
			>
				<Text
					fontSize="14px"
					fontWeight="900"
					color="#29231E"
				>
					연속 학습 3일째!
				</Text>

				<Text
					mt="10px"
					fontSize="12px"
					color="#887D73"
				>
					꾸준함이 학습을
					만듭니다.
				</Text>

				<Text
					mt="14px"
					fontSize="12px"
					fontWeight="800"
					color="#29231E"
				>
					3일 연속
				</Text>
			</Box>

			<Box
				flex="1"
				minH="24px"
			/>
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
				display={{
					base: "none",
					"2xl": "block",
				}}
				position="fixed"
				left="0"
				top="0"
				bottom="0"
				w="246px"
				bg="#FBF7EE"
				borderRightWidth="1px"
				borderColor="#E8DCCE"
				zIndex={1300}
				overflowY="auto"
			>
				<SidebarContent />
			</Box>

			<Drawer
				isOpen={isOpen}
				placement="left"
				onClose={
					onClose
				}
				size="xs"
			>
				<DrawerOverlay />

				<DrawerContent
					bg="#FBF7EE"
				>
					<DrawerBody p="0">
						<SidebarContent
							onNavigate={
								onClose
							}
						/>
					</DrawerBody>
				</DrawerContent>
			</Drawer>
		</>
	);
}