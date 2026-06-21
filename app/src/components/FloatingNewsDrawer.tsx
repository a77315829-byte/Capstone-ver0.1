import React from "react";
import {
	Badge,
	Box,
	Button,
	Drawer,
	DrawerBody,
	DrawerCloseButton,
	DrawerContent,
	DrawerHeader,
	Flex,
	Text,
	useDisclosure,
} from "@chakra-ui/react";
import { FiFileText } from "react-icons/fi";

import Newsfeed from "./Newsfeed";

interface FloatingNewsDrawerProps {
	symbol?: string;
	name?: string;
	market?: string;
}

export default function FloatingNewsDrawer({
	symbol = "",
	name = "",
	market = "",
}: FloatingNewsDrawerProps) {
	const { isOpen, onOpen, onClose } = useDisclosure();

	const stockLabel = name
		? `${name}${symbol ? ` · ${symbol}` : ""}`
		: "선택 종목";

	return (
		<>
			<Button
				position="fixed"
				right={{ base: "16px", md: "28px" }}
				bottom={{ base: "122px", md: "132px" }}
				zIndex={1400}
				h={{ base: "48px", md: "52px" }}
				px={{ base: "18px", md: "22px" }}
				leftIcon={<FiFileText size={19} />}
				borderRadius="full"
				colorScheme="blue"
				boxShadow="0 8px 24px rgba(0, 0, 0, 0.18)"
				onClick={onOpen}
				isDisabled={!symbol}
				_hover={{
					transform: "translateY(-2px)",
					boxShadow: "0 12px 28px rgba(0, 0, 0, 0.22)",
				}}
				transition="all 0.18s ease"
			>
				실시간 뉴스
			</Button>

			<Drawer
				isOpen={isOpen}
				placement="right"
				onClose={onClose}
				size="md"
				blockScrollOnMount={false}
				trapFocus={false}
				closeOnEsc
			>
				{/* Overlay를 넣지 않아 본문과 뉴스 패널을 별도로 조작할 수 있음 */}

				<DrawerContent
					maxW={{ base: "100vw", sm: "480px", xl: "520px" }}
					borderLeftWidth="1px"
					borderColor="gray.200"
					boxShadow="-12px 0 32px rgba(0, 0, 0, 0.12)"
				>
					<DrawerCloseButton
						top="18px"
						right="18px"
						size="lg"
					/>

					<DrawerHeader
						px={{ base: "18px", md: "24px" }}
						py="18px"
						pr="64px"
						borderBottomWidth="1px"
						bg="white"
					>
						<Flex align="center" gap="3">
							<Box
								display="flex"
								alignItems="center"
								justifyContent="center"
								w="42px"
								h="42px"
								borderRadius="12px"
								bg="blue.50"
								color="blue.600"
								flexShrink={0}
							>
								<FiFileText size={21} />
							</Box>

							<Box minW={0}>
								<Text fontSize="lg" fontWeight="900">
									실시간 종목 뉴스
								</Text>

								<Text
									mt="1"
									fontSize="sm"
									fontWeight="500"
									color="gray.500"
									overflow="hidden"
									textOverflow="ellipsis"
									whiteSpace="nowrap"
								>
									{stockLabel}
								</Text>
							</Box>

							{market && (
								<Badge
									ml="auto"
									mr="2"
									px="2"
									py="1"
									colorScheme="blue"
									borderRadius="full"
								>
									{market}
								</Badge>
							)}
						</Flex>
					</DrawerHeader>

					<DrawerBody
						p="0"
						bg="gray.50"
						overflowY="auto"
						overscrollBehavior="contain"
					>
						<Box px={{ base: "16px", md: "22px" }} py="20px">
							{symbol ? (
								<Newsfeed
									symbol={symbol}
									name={name}
									market={market}
									layout="list"
								/>
							) : (
								<Flex
									minH="320px"
									align="center"
									justify="center"
								>
									<Text color="gray.500">
										뉴스를 확인할 종목을 선택하세요.
									</Text>
								</Flex>
							)}
						</Box>
					</DrawerBody>
				</DrawerContent>
			</Drawer>
		</>
	);
}