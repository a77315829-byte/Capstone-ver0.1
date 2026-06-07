import React from "react";
import { Box, Button, Flex, IconButton, Text } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { StarIcon, SunIcon } from "@chakra-ui/icons";

type MenuCircleProps = {
	label: string;
	to: string;
	left: number;
	active: boolean;
};

const OUTER = 61.7;
const INNER = 54.58;
const INNER_OFFSET = 3.56;

function MenuCircle({ label, to, left, active }: MenuCircleProps) {
	return (
		<Box
			as={RouterLink}
			to={to}
			position="absolute"
			left={`${left}px`}
			top="18px"
			w={`${OUTER}px`}
			h={`${OUTER}px`}
			borderRadius="full"
			bg="white"
			display="flex"
			alignItems="center"
			justifyContent="center"
			textDecoration="none"
			zIndex={2}
		>
			<Box
				w={`${INNER}px`}
				h={`${INNER}px`}
				borderRadius="full"
				bg={active ? "#FFEEF9" : "#D9D9D9"}
				display="flex"
				alignItems="center"
				justifyContent="center"
				fontSize="9px"
				fontWeight="700"
				color="black"
				fontFamily="'SUIT', 'Suite', 'Pretendard', sans-serif"
				transition="0.15s ease"
				_hover={{
					bg: active ? "#FFEEF9" : "#eeeeee",
				}}
			>
				{label}
			</Box>
		</Box>
	);
}

function AntFace() {
	return (
		<Box
			position="absolute"
			left="0"
			top="14px"
			w="62px"
			h="62px"
			zIndex={10}
			pointerEvents="none"
		>
			{/* 더듬이 */}
			<svg
				width="50"
				height="48"
				viewBox="0 0 72 40"
				style={{
					position: "absolute",
					left: "14px",
					top: "-24px",
					overflow: "visible",
					zIndex: 20,
				}}
			>
				<path
					d="M18 44 C16 26 22 12 30 4"
					stroke="black"
					strokeWidth="2.2"
					fill="none"
					strokeLinecap="round"
				/>
				<path
					d="M34 44 C42 24 50 14 62 8"
					stroke="black"
					strokeWidth="2.2"
					fill="none"
					strokeLinecap="round"
				/>

				<circle cx="30" cy="4" r="4" fill="black" />
				<circle cx="62" cy="8" r="4" fill="black" />
			</svg>

			{/* 흰 테두리 */}
			<Box
				position="absolute"
				left="0"
				top="1"
				w="62px"
				h="62px"
				borderRadius="full"
				bg="white"
			>
				{/* 검은 얼굴 */}
				<Box
					position="absolute"
					left="4px"
					top="4px"
					w="54px"
					h="54px"
					borderRadius="full"
					bg="black"
				>
					{/* 흰 눈 */}
					<Box
						position="absolute"
						left="15px"
						top="10px"
						w="22px"
						h="22px"
						borderRadius="full"
						bg="white"
					>
						{/* 검은 눈동자 */}
						<Box
							position="absolute"
							right="2px"
							top="4px"
							w="13px"
							h="13px"
							borderRadius="full"
							bg="black"
						>
							{/* 반짝이 */}
							<Box
								position="absolute"
								right="2px"
								top="4px"
								w="3px"
								h="3px"
								borderRadius="full"
								bg="white"
							/>
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
function AntitudeMenu() {
	const location = useLocation();

	const isActive = (path: string) => {
		if (path === "/exchange") {
			return (
				location.pathname === "/" ||
				location.pathname.startsWith("/exchange")
			);
		}

		return location.pathname.startsWith(path);
	};

	return (
		<Box
			position="relative"
			w="260px"
			h="82px"
			flexShrink={0}
			fontFamily="'SUIT', 'Suite', 'Pretendard', sans-serif"
		>
			<AntFace />

			<MenuCircle
	label="거래소"
	to="/exchange"
	left={50}
	active={isActive("/exchange")}
/>

<MenuCircle
	label="시나리오"
	to="/scenario"
	left={102}
	active={isActive("/scenario")}
/>

<MenuCircle
	label="마이페이지"
	to="/mypage"
	left={154}
	active={isActive("/Mypage")}
/>
		</Box>
	);
}

export default function Navbar() {
	return (
		<Box
			as="header"
			w="100%"
			bg="white"
			borderBottom="1px solid #edf2f7"
			px={{ base: 4, md: 6 }}
			py="2px"
			minH="88px"
			overflow="visible"
			fontFamily="'SUIT', 'Suite', 'Pretendard', sans-serif"
		>
			<Flex align="center" justify="space-between" h="100%">
	<Flex align="center" gap="14px">
		<Text
			fontFamily="'SUIT', 'Suite', 'Pretendard', sans-serif"
			fontSize="24px"
			fontWeight="900"
			letterSpacing="-0.04em"
			color="black"
			whiteSpace="nowrap"
			lineHeight="0"
			mt="-2px"
		>
			앤티튜드
		</Text>

		<AntitudeMenu />
	</Flex>

	<Flex align="center" gap="2">
					<IconButton
						aria-label="toggle color mode"
						icon={<SunIcon />}
						variant="outline"
						size="sm"
					/>
					<IconButton
						aria-label="favorite"
						icon={<StarIcon />}
						variant="outline"
						size="sm"
					/>
					<Button as={RouterLink} to="/login" size="sm" variant="outline">
						Login
					</Button>
				</Flex>
			</Flex>
		</Box>
	);
}