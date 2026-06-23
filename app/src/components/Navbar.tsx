import React from "react";
import {
	Box,
	Button,
	Flex,
	HStack,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Image,
	Text,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import {
	Link as RouterLink,
	useLocation,
} from "react-router-dom";
import AccountMenu from "./AccountMenu";

interface NavItem {
	label: string;
	to: string;
	activePaths: string[];
	background: string;
	hoverBackground: string;
}

const NAV_ITEMS: NavItem[] = [
	{
		label: "실시간 차트",
		to: "/exchange",
		activePaths: ["/exchange", "/stocks"],
		background: "#F97316",
		hoverBackground: "#EA580C",
	},
	{
		label: "전역자금 플래너",
		to: "/salary",
		activePaths: ["/salary", "/advisor"],
		background: "#2563EB",
		hoverBackground: "#1D4ED8",
	},
	{
		label: "금융 사전·퀴즈",
		to: "/learn",
		activePaths: ["/learn", "/quiz"],
		background: "#EC4899",
		hoverBackground: "#DB2777",
	},
	{
		label: "군 커뮤니티",
		to: "/community",
		activePaths: ["/community"],
		background: "#7C3AED",
		hoverBackground: "#6D28D9",
	},
];

function isPathActive(
	pathname: string,
	activePaths: string[],
): boolean {
	return activePaths.some(
		(path) =>
			pathname === path ||
			pathname.startsWith(`${path}/`),
	);
}

function LogoPlaceholder() {
	return (
		<Box
			as={RouterLink}
			to="/exchange"
			display="flex"
			alignItems="center"
			justifyContent="center"
			flexShrink={0}
			w={{ base: "90px", md: "120px" }}
			h="42px"
			textDecoration="none"
		>
			<Image
				src="/logo.png"
				alt="Antitude"
				maxW="100%"
				maxH="38px"
				w="auto"
				h="auto"
				objectFit="contain"
			/>
		</Box>
	);
}

function DesktopNavigation() {
	const location = useLocation();

	return (
		<HStack
			display={{ base: "none", lg: "flex" }}
			spacing="7px"
		>
			{NAV_ITEMS.map((item) => {
				const active = isPathActive(
					location.pathname,
					item.activePaths,
				);

				return (
					<Button
						key={item.to}
						as={RouterLink}
						to={item.to}
						h="32px"
						minW="auto"
						px="14px"
						borderRadius="full"
						bg={item.background}
						color="white"
						fontSize="13px"
						fontWeight="800"
						letterSpacing="-0.02em"
						boxShadow={
							active
								? `0 0 0 3px ${item.background}33`
								: "none"
						}
						borderWidth={active ? "2px" : "0"}
						borderColor={
							active
								? "whiteAlpha.700"
								: "transparent"
						}
						transition="all 0.15s ease"
						_hover={{
							bg: item.hoverBackground,
							transform: "translateY(-1px)",
							boxShadow: "sm",
						}}
						_active={{
							transform: "translateY(0)",
						}}
					>
						{item.label}
					</Button>
				);
			})}
		</HStack>
	);
}

function MobileNavigation() {
	const location = useLocation();

	return (
		<Menu placement="bottom-end">
			<MenuButton
				as={Button}
				display={{ base: "inline-flex", lg: "none" }}
				minW="40px"
				h="40px"
				p="0"
				variant="outline"
				borderRadius="10px"
				aria-label="메뉴 열기"
			>
				<HamburgerIcon boxSize="20px" />
			</MenuButton>

			<MenuList
				minW="210px"
				py="8px"
				borderRadius="12px"
				boxShadow="xl"
			>
				{NAV_ITEMS.map((item) => {
					const active = isPathActive(
						location.pathname,
						item.activePaths,
					);

					return (
						<MenuItem
							key={item.to}
							as={RouterLink}
							to={item.to}
							mx="8px"
							my="3px"
							w="calc(100% - 16px)"
							borderRadius="8px"
							fontWeight={active ? "800" : "600"}
							color={active ? "white" : "gray.700"}
							bg={
								active
									? item.background
									: "transparent"
							}
							_hover={{
								bg: active
									? item.hoverBackground
									: "gray.100",
							}}
						>
							<Box
								w="8px"
								h="8px"
								mr="10px"
								borderRadius="full"
								bg={item.background}
							/>

							{item.label}
						</MenuItem>
					);
				})}

				<MenuItem
					as={RouterLink}
					to="/mypage"
					mx="8px"
					mt="8px"
					w="calc(100% - 16px)"
					borderRadius="8px"
					fontWeight="600"
				>
					마이페이지
				</MenuItem>

				<MenuItem
					as={RouterLink}
					to="/login"
					mx="8px"
					w="calc(100% - 16px)"
					borderRadius="8px"
					fontWeight="600"
				>
					로그인
				</MenuItem>
			</MenuList>
		</Menu>
	);
}

export default function Navbar() {
	return (
		<Box
			as="header"
			position="sticky"
			top="0"
			zIndex={1500}
			w="100%"
			bg="white"
			borderBottomWidth="1px"
			borderBottomColor="gray.200"
			boxShadow="0 1px 4px rgba(0, 0, 0, 0.04)"
		>
			<Flex
				w="100%"
				minH="66px"
				px={{ base: "10px", md: "16px" }}
				align="center"
				justify="space-between"
				gap="16px"
			>
				<Flex
					align="center"
					gap={{ base: "10px", xl: "16px" }}
					minW={0}
				>
					<LogoPlaceholder />
					<DesktopNavigation />
				</Flex>

				<Flex
					align="center"
					justify="flex-end"
					gap="8px"
					flexShrink={0}
				>
					<Button
						as={RouterLink}
						to="/mypage"
						display={{
							base: "none",
							md: "inline-flex",
						}}
						size="sm"
						variant="ghost"
						fontSize="13px"
						fontWeight="700"
						color="gray.700"
					>
						마이페이지
					</Button>

					<AccountMenu />

					<MobileNavigation />
				</Flex>
			</Flex>
		</Box>
	);
}