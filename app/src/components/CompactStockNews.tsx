import React, {
	useEffect,
	useState,
} from "react";

import {
	Box,
	Flex,
	Image,
	Skeleton,
	Spacer,
	Stack,
	Text,
} from "@chakra-ui/react";

import {
	useNavigate,
} from "react-router-dom";

import axios from "axios";

type Props = {
	symbol: string;
	name: string;
	market?: string;
};

type NewsItem = {
	title: string;
	description: string;
	publishedAt: string;
	source: string;
	sourceUrl: string;
	symbols?: string[];
	imageUrl?: string | null;
};

const BORDER = "#E8DCCE";
const TEXT = "#29231E";
const MUTED = "#887D73";
const ORANGE = "#F36F2A";

function timeSince(
	dateString: string,
): string {
	const time =
		new Date(dateString).getTime();

	if (Number.isNaN(time)) {
		return "";
	}

	const seconds =
		Math.max(
			0,
			Math.floor(
				(Date.now() - time) /
					1000,
			),
		);

	if (seconds < 60) {
		return "방금 전";
	}

	if (seconds < 3600) {
		return `${Math.floor(
			seconds / 60,
		)}분 전`;
	}

	if (seconds < 86400) {
		return `${Math.floor(
			seconds / 3600,
		)}시간 전`;
	}

	return `${Math.floor(
		seconds / 86400,
	)}일 전`;
}

function NewsThumbnail({
	item,
}: {
	item: NewsItem;
}) {
	const [
		failed,
		setFailed,
	] = useState(false);

	if (
		!item.imageUrl ||
		failed
	) {
		return (
			<Flex
				w="62px"
				h="52px"
				flexShrink={0}
				borderRadius="7px"
				align="center"
				justify="center"
				bg="#E5E5E5"
				overflow="hidden"
			>
				<Text
					fontSize="8px"
					fontWeight="900"
					color="#A5A5A5"
				>
					NEWS
				</Text>
			</Flex>
		);
	}

	return (
		<Image
			src={item.imageUrl}
			alt=""
			w="62px"
			h="52px"
			flexShrink={0}
			borderRadius="7px"
			objectFit="cover"
			loading="lazy"
			onError={() =>
				setFailed(true)
			}
		/>
	);
}

export default function CompactStockNews({
	symbol,
	name,
	market = "KOSPI",
}: Props) {
	const navigate =
		useNavigate();

	const [
		news,
		setNews,
	] = useState<NewsItem[]>([]);

	const [
		loading,
		setLoading,
	] = useState(false);

	useEffect(() => {
		if (!symbol) {
			return;
		}

		let active = true;

		const load = async () => {
			try {
				setLoading(true);

				const response =
					await axios.get(
						`/api/news/${encodeURIComponent(
							symbol,
						)}`,
						{
							params: {
								name,
								market,
							},
						},
					);

				if (!active) {
					return;
				}

				setNews(
					Array.isArray(
						response.data,
					)
						? response.data.slice(
								0,
								3,
							)
						: [],
				);
			} catch (error) {
				console.error(
					"차트 뉴스 조회 실패:",
					error,
				);

				if (active) {
					setNews([]);
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		};

		void load();

		return () => {
			active = false;
		};
	}, [
		symbol,
		name,
		market,
	]);

	const openNewsPage = () => {
		const params =
			new URLSearchParams({
				symbol,
				name,
				market,
				marketType: "KR",
			});

		navigate(
			`/news?${params.toString()}`,
		);
	};

	const openArticle = (
		url: string,
	) => {
		if (!url) {
			return;
		}

		window.open(
			url,
			"_blank",
			"noopener,noreferrer",
		);
	};

	return (
		<Box
			h="100%"
			minH="314px"
			p="16px"
			bg="white"
			borderWidth="1px"
			borderColor={BORDER}
			borderRadius="10px"
		>
			<Flex
				align="center"
				mb="14px"
			>
				<Text
					fontSize="16px"
					fontWeight="900"
					color={TEXT}
				>
					뉴스
				</Text>

				<Spacer />

				<Text
					fontSize="9px"
					color={MUTED}
				>
					최신 뉴스
				</Text>
			</Flex>

			{loading ? (
				<Stack spacing="10px">
					{[
						1,
						2,
						3,
					].map(
						(item) => (
							<Flex
								key={
									item
								}
								gap="10px"
							>
								<Skeleton
									w="62px"
									h="52px"
									borderRadius="7px"
								/>

								<Box flex="1">
									<Skeleton
										h="9px"
										w="90%"
									/>

									<Skeleton
										mt="7px"
										h="8px"
										w="55%"
									/>
								</Box>
							</Flex>
						),
					)}
				</Stack>
			) : news.length >
			  0 ? (
				<Stack spacing="0">
					{news.map(
						(
							item,
							index,
						) => (
							<Box
								key={`${item.sourceUrl}-${index}`}
								as="button"
								type="button"
								w="100%"
								py="10px"
								textAlign="left"
								borderBottomWidth={
									index ===
									news.length -
										1
										? "0"
										: "1px"
								}
								borderColor="#F0E8DF"
								transition="background .15s ease"
								_hover={{
									bg:
										"#FFFAF5",
								}}
								onClick={() =>
									openArticle(
										item.sourceUrl,
									)
								}
							>
								<Flex
									gap="11px"
									align="center"
								>
									<NewsThumbnail
										item={
											item
										}
									/>

									<Box
										minW="0"
										flex="1"
									>
										<Text
											fontSize="10px"
											fontWeight="900"
											lineHeight="1.5"
											color={
												TEXT
											}
											noOfLines={
												2
											}
										>
											{
												item.title
											}
										</Text>

										<Flex
											mt="6px"
											align="center"
											gap="6px"
										>
											<Text
												fontSize="8px"
												color={
													MUTED
												}
												noOfLines={
													1
												}
											>
												{
													item.source
												}
											</Text>

											<Text
												fontSize="8px"
												color="#B2A89F"
											>
												{
													timeSince(
														item.publishedAt,
													)
												}
											</Text>
										</Flex>
									</Box>
								</Flex>
							</Box>
						),
					)}
				</Stack>
			) : (
				<Flex
					h="190px"
					align="center"
					justify="center"
				>
					<Text
						fontSize="10px"
						color={MUTED}
					>
						관련 뉴스가 없습니다.
					</Text>
				</Flex>
			)}

			<Box
				mt="10px"
				pt="12px"
				borderTopWidth="1px"
				borderColor="#F0E8DF"
			>
				<Box
					as="button"
					type="button"
					w="100%"
					textAlign="center"
					fontSize="10px"
					fontWeight="800"
					color={MUTED}
					_hover={{
						color: ORANGE,
					}}
					onClick={
						openNewsPage
					}
				>
					더보기 〉
				</Box>
			</Box>
		</Box>
	);
}