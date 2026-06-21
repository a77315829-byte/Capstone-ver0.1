import React, { useEffect, useState } from "react";
import {
	Badge,
	Box,
	Card,
	CardBody,
	Flex,
	Heading,
	Link,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
} from "@chakra-ui/react";
import axios from "axios";

interface NewsItem {
	title: string;
	description: string;
	publishedAt: string;
	symbols?: string[];
	source: string;
	sourceUrl: string;
}

interface NewsfeedProps {
	symbol: string;
	name?: string;
	market?: string;
	layout?: "grid" | "list";
}

function timeSince(dateString: string): string {
	const targetTime = new Date(dateString).getTime();

	if (Number.isNaN(targetTime)) {
		return "";
	}

	const seconds = Math.max(
		0,
		Math.floor((Date.now() - targetTime) / 1000),
	);

	const intervals = [
		{ label: "년", seconds: 31_536_000 },
		{ label: "개월", seconds: 2_592_000 },
		{ label: "일", seconds: 86_400 },
		{ label: "시간", seconds: 3_600 },
		{ label: "분", seconds: 60 },
	];

	for (const interval of intervals) {
		const value = Math.floor(seconds / interval.seconds);

		if (value >= 1) {
			return `${value}${interval.label} 전`;
		}
	}

	return "방금 전";
}

export default function Newsfeed({
	symbol,
	name = "",
	market = "",
	layout = "grid",
}: NewsfeedProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [news, setNews] = useState<NewsItem[]>([]);
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		let isMounted = true;

		const fetchNews = async () => {
			if (!symbol) {
				setNews([]);
				setErrorMessage("");
				return;
			}

			try {
				setIsLoading(true);
				setErrorMessage("");

				const response = await axios.get(
					`/api/news/${encodeURIComponent(symbol)}`,
					{
						params: {
							name,
							market,
						},
					},
				);

				if (!isMounted) {
					return;
				}

				setNews(
					Array.isArray(response.data)
						? response.data.slice(0, 12)
						: [],
				);
			} catch (error: any) {
				console.error("뉴스 조회 실패:", error);

				if (!isMounted) {
					return;
				}

				setNews([]);
				setErrorMessage(
					error?.response?.data?.message ||
						"뉴스를 불러오지 못했습니다.",
				);
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchNews();

		return () => {
			isMounted = false;
		};
	}, [symbol, name, market]);

	if (isLoading) {
		return (
			<Flex minH="280px" align="center" justify="center">
				<Stack align="center" spacing="3">
					<Spinner size="lg" color="blue.500" />
					<Text fontSize="sm" color="gray.500">
						최신 뉴스를 불러오는 중입니다.
					</Text>
				</Stack>
			</Flex>
		);
	}

	if (errorMessage) {
		return (
			<Flex minH="240px" align="center" justify="center">
				<Stack align="center" spacing="2">
					<Text fontWeight="800">
						뉴스를 불러오지 못했습니다.
					</Text>

					<Text
						fontSize="sm"
						color="red.500"
						textAlign="center"
					>
						{errorMessage}
					</Text>
				</Stack>
			</Flex>
		);
	}

	if (news.length === 0) {
		return (
			<Flex minH="240px" align="center" justify="center">
				<Stack align="center" spacing="2">
					<Text fontWeight="800">
						표시할 뉴스가 없습니다.
					</Text>

					<Text
						fontSize="sm"
						color="gray.500"
						textAlign="center"
					>
						선택한 종목과 관련된 최신 기사가 없습니다.
					</Text>
				</Stack>
			</Flex>
		);
	}

	const newsCards = news.map((item, index) => (
		<Card
			key={`${item.sourceUrl}-${index}`}
			h="100%"
			borderWidth="1px"
			borderColor="gray.200"
			borderRadius="xl"
			boxShadow="sm"
			bg="white"
			overflow="hidden"
			transition="all 0.16s ease"
			_hover={{
				transform: "translateY(-2px)",
				boxShadow: "md",
				borderColor: "blue.200",
			}}
		>
			<Link
				href={item.sourceUrl}
				isExternal
				color="inherit"
				_hover={{
					textDecoration: "none",
				}}
			>
				<CardBody p={layout === "list" ? "18px" : "20px"}>
					<Flex align="center" gap="2" mb="3">
						<Badge
							colorScheme="blue"
							maxW="220px"
							overflow="hidden"
							textOverflow="ellipsis"
							whiteSpace="nowrap"
						>
							{item.source || "뉴스"}
						</Badge>

						<Text
							ml="auto"
							fontSize="xs"
							fontWeight="600"
							color="gray.500"
							whiteSpace="nowrap"
						>
							{timeSince(item.publishedAt)}
						</Text>
					</Flex>

					<Heading
						size="sm"
						lineHeight="1.55"
						noOfLines={layout === "list" ? 3 : 2}
					>
						{item.title}
					</Heading>

					<Text
						mt="3"
						fontSize="sm"
						lineHeight="1.75"
						color="gray.600"
						noOfLines={layout === "list" ? 5 : 4}
					>
						{item.description ||
							"기사 요약이 제공되지 않습니다."}
					</Text>

					<Flex mt="4" align="center">
						{Array.isArray(item.symbols) &&
							item.symbols.length > 0 && (
								<Text
									fontSize="xs"
									fontWeight="700"
									color="gray.500"
								>
									{item.symbols.join(", ")}
								</Text>
							)}

						<Text
							ml="auto"
							fontSize="sm"
							fontWeight="800"
							color="blue.500"
						>
							원문 보기
						</Text>
					</Flex>
				</CardBody>
			</Link>
		</Card>
	));

	if (layout === "list") {
		return <Stack spacing="4">{newsCards}</Stack>;
	}

	return (
		<SimpleGrid
			columns={{
				base: 1,
				md: 2,
				xl: 3,
			}}
			spacing="4"
		>
			{newsCards}
		</SimpleGrid>
	);
}