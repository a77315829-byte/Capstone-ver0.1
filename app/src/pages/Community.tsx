import React, {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	Divider,
	Flex,
	FormControl,
	FormLabel,
	Grid,
	Heading,
	HStack,
	IconButton,
	Input,
	InputGroup,
	InputLeftElement,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
	Skeleton,
	Stack,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useDisclosure,
	useToast,
} from "@chakra-ui/react";
import {
	EditIcon,
	SearchIcon,
	SettingsIcon,
	StarIcon,
} from "@chakra-ui/icons";
import {
	Link as RouterLink,
	useNavigate,
} from "react-router-dom";

import api from "../services/api.service";
import {
	COMMUNITY_CATEGORIES,
	DIVISION_OPTIONS,
} from "../data/community.constants";
import type {
	CommunityCategory,
	CommunityLeaderboardEntry,
	CommunityPostListResponse,
	CommunityPostSummary,
	CommunityProfile,
	CommunityScope,
	CommunitySort,
} from "../types/community.types";

const EMPTY_PROFILE: CommunityProfile = {
	nickname: "ㅇㅇ",
	divisionCode: null,
	divisionName: null,
};

const DEMO_LEADERBOARD: CommunityLeaderboardEntry[] = [
	{
		id: "demo-rank-1",
		month: "2026-06",
		divisionCode: "DIV_03",
		divisionName: "3사단",
		nickname: "ㅇㅇ",
		authorCode: "182.21",
		returnRate: 8.42,
		maxDrawdown: 3.1,
		consistencyScore: 92,
		activityScore: 88,
		totalScore: 91.4,
		divisionRank: 1,
		overallRank: 4,
		badge: "투자왕",
	},
	{
		id: "demo-rank-2",
		month: "2026-06",
		divisionCode: "DIV_03",
		divisionName: "3사단",
		nickname: "ETF초보",
		authorCode: "57.204",
		returnRate: 7.15,
		maxDrawdown: 4.2,
		consistencyScore: 87,
		activityScore: 91,
		totalScore: 87.8,
		divisionRank: 2,
		overallRank: 11,
		badge: "안정왕",
	},
	{
		id: "demo-rank-3",
		month: "2026-06",
		divisionCode: "DIV_03",
		divisionName: "3사단",
		nickname: "주린이병장",
		authorCode: "91.33",
		returnRate: 9.76,
		maxDrawdown: 8.7,
		consistencyScore: 71,
		activityScore: 80,
		totalScore: 82.9,
		divisionRank: 3,
		overallRank: 18,
		badge: "수익왕",
	},
];

function formatDate(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();

	if (isToday) {
		return date.toLocaleTimeString("ko-KR", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	}

	return date.toLocaleDateString("ko-KR", {
		month: "2-digit",
		day: "2-digit",
	});
}

function AuthorLabel({
	nickname,
	code,
}: {
	nickname: string;
	code: string;
}) {
	return (
		<Text
			fontSize="12px"
			color="gray.700"
			whiteSpace="nowrap"
		>
			{nickname}
			<Text
				as="span"
				ml="1"
				color="gray.400"
			>
				({code})
			</Text>
		</Text>
	);
}

function BoardTabs({
	scope,
	onScopeChange,
	featuredOnly,
	onFeaturedChange,
	showLeaderboard,
	onLeaderboardChange,
	profile,
}: {
	scope: CommunityScope;
	onScopeChange: (scope: CommunityScope) => void;
	featuredOnly: boolean;
	onFeaturedChange: (value: boolean) => void;
	showLeaderboard: boolean;
	onLeaderboardChange: (value: boolean) => void;
	profile: CommunityProfile;
}) {
	const baseButtonProps = {
		size: "sm",
		borderRadius: "0",
		fontWeight: "800",
	};

	return (
		<Flex
			borderTopWidth="2px"
			borderTopColor="gray.800"
			borderBottomWidth="1px"
			borderBottomColor="gray.300"
			bg="gray.50"
			overflowX="auto"
		>
			<Button
				{...baseButtonProps}
				variant={
					scope === "global" &&
					!featuredOnly &&
					!showLeaderboard
						? "solid"
						: "ghost"
				}
				colorScheme="gray"
				onClick={() => {
					onScopeChange("global");
					onFeaturedChange(false);
					onLeaderboardChange(false);
				}}
			>
				전체 게시판
			</Button>

			<Button
				{...baseButtonProps}
				variant={
					scope === "division" &&
					!featuredOnly &&
					!showLeaderboard
						? "solid"
						: "ghost"
				}
				colorScheme="gray"
				onClick={() => {
					onScopeChange("division");
					onFeaturedChange(false);
					onLeaderboardChange(false);
				}}
			>
				{profile.divisionName
					? `${profile.divisionName} 라운지`
					: "내 사단"}
			</Button>

			<Button
				{...baseButtonProps}
				leftIcon={<StarIcon />}
				variant={featuredOnly ? "solid" : "ghost"}
				colorScheme="pink"
				onClick={() => {
					onFeaturedChange(true);
					onLeaderboardChange(false);
				}}
			>
				추천글
			</Button>

			<Button
				{...baseButtonProps}
				variant={showLeaderboard ? "solid" : "ghost"}
				colorScheme="purple"
				onClick={() => {
					onFeaturedChange(false);
					onLeaderboardChange(true);
				}}
			>
				이달의 투자왕
			</Button>
		</Flex>
	);
}

function LeaderboardPanel({
	entries,
	profile,
}: {
	entries: CommunityLeaderboardEntry[];
	profile: CommunityProfile;
}) {
	const displayEntries =
		entries.length > 0 ? entries : DEMO_LEADERBOARD;

	return (
		<Card
			borderRadius="0"
			borderWidth="1px"
			borderColor="gray.300"
			boxShadow="none"
		>
			<CardBody p="0">
				<Flex
					px="16px"
					py="13px"
					align="center"
					justify="space-between"
					borderBottomWidth="1px"
					borderColor="gray.300"
					bg="purple.50"
				>
					<Box>
						<Heading size="sm">
							{profile.divisionName ?? "내 사단"} 이달의 투자왕
						</Heading>
						<Text mt="1" fontSize="12px" color="gray.600">
							수익률·최대손실폭·운용안정성·참여도를
							종합한 모의투자 점수입니다.
						</Text>
					</Box>

					{entries.length === 0 && (
						<Badge colorScheme="orange">
							시연 데이터
						</Badge>
					)}
				</Flex>

				<TableContainer>
					<Table size="sm">
						<Thead bg="gray.50">
							<Tr>
								<Th w="70px" textAlign="center">
									순위
								</Th>
								<Th>사용자</Th>
								<Th isNumeric>수익률</Th>
								<Th isNumeric>최대 손실</Th>
								<Th isNumeric>투자점수</Th>
								<Th textAlign="center">배지</Th>
							</Tr>
						</Thead>

						<Tbody>
							{displayEntries.map((entry) => (
								<Tr key={entry.id}>
									<Td textAlign="center" fontWeight="900">
										{entry.divisionRank}
									</Td>
									<Td>
										<AuthorLabel
											nickname={entry.nickname}
											code={entry.authorCode}
										/>
									</Td>
									<Td
										isNumeric
										color={
											entry.returnRate >= 0
												? "red.500"
												: "blue.500"
										}
										fontWeight="800"
									>
										{entry.returnRate >= 0 ? "+" : ""}
										{entry.returnRate.toFixed(2)}%
									</Td>
									<Td isNumeric>
										-{Math.abs(entry.maxDrawdown).toFixed(2)}%
									</Td>
									<Td isNumeric fontWeight="900">
										{entry.totalScore.toFixed(1)}
									</Td>
									<Td textAlign="center">
										{entry.badge && (
											<Badge
												colorScheme={
													entry.badge === "투자왕"
														? "purple"
														: entry.badge === "수익왕"
															? "red"
															: "green"
												}
											>
												{entry.badge}
											</Badge>
										)}
									</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</TableContainer>
			</CardBody>
		</Card>
	);
}

function CommunityBoardTable({
	posts,
	isLoading,
}: {
	posts: CommunityPostSummary[];
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<Stack spacing="2" py="4">
				{Array.from({ length: 8 }).map((_, index) => (
					<Skeleton
						key={index}
						h="38px"
						borderRadius="0"
					/>
				))}
			</Stack>
		);
	}

	if (posts.length === 0) {
		return (
			<Flex
				minH="260px"
				align="center"
				justify="center"
				borderBottomWidth="1px"
				borderColor="gray.300"
			>
				<Stack align="center" spacing="2">
					<Text fontWeight="900">
						등록된 게시글이 없습니다.
					</Text>
					<Text fontSize="sm" color="gray.500">
						첫 번째 글을 작성해 보세요.
					</Text>
				</Stack>
			</Flex>
		);
	}

	return (
		<TableContainer>
			<Table size="sm" sx={{ tableLayout: "fixed" }}>
				<Thead bg="gray.50">
					<Tr>
						<Th w="70px" textAlign="center">
							구분
						</Th>
						<Th>제목</Th>
						<Th w="145px">글쓴이</Th>
						<Th w="76px" textAlign="center">
							작성일
						</Th>
						<Th w="58px" isNumeric>
							조회
						</Th>
						<Th w="58px" isNumeric>
							추천
						</Th>
					</Tr>
				</Thead>

				<Tbody>
					{posts.map((post) => (
						<Tr
							key={post.id}
							bg={post.isFeatured ? "pink.50" : "white"}
							_hover={{ bg: "gray.50" }}
						>
							<Td textAlign="center" px="2">
								{post.isFeatured ? (
									<Badge colorScheme="pink">
										추천
									</Badge>
								) : (
									<Text
										fontSize="11px"
										color="gray.500"
										noOfLines={1}
									>
										{post.category}
									</Text>
								)}
							</Td>

							<Td px="2">
								<Flex align="center" minW={0}>
									<Text
										as={RouterLink}
										to={`/community/${post.id}`}
										fontSize="13px"
										color="gray.800"
										noOfLines={1}
										_hover={{
											textDecoration: "underline",
											color: "blue.600",
										}}
									>
										{post.title}
									</Text>

									{post.commentCount > 0 && (
										<Text
											ml="1.5"
											fontSize="11px"
											color="red.500"
											fontWeight="800"
										>
											[{post.commentCount}]
										</Text>
									)}
								</Flex>
							</Td>

							<Td px="2">
								<AuthorLabel
									nickname={post.authorNickname}
									code={post.authorCode}
								/>
							</Td>

							<Td textAlign="center" px="2">
								<Text fontSize="11px" color="gray.500">
									{formatDate(post.createdAt)}
								</Text>
							</Td>

							<Td isNumeric px="2">
								<Text fontSize="11px">
									{post.viewCount}
								</Text>
							</Td>

							<Td isNumeric px="2">
								<Text
									fontSize="11px"
									color={
										post.likeCount > 0
											? "red.500"
											: "gray.600"
									}
								>
									{post.likeCount}
								</Text>
							</Td>
						</Tr>
					))}
				</Tbody>
			</Table>
		</TableContainer>
	);
}

export default function Community() {
	const toast = useToast();
	const navigate = useNavigate();
	const profileModal = useDisclosure();

	const [profile, setProfile] =
		useState<CommunityProfile>(EMPTY_PROFILE);
	const [nicknameDraft, setNicknameDraft] =
		useState("ㅇㅇ");
	const [divisionCodeDraft, setDivisionCodeDraft] =
		useState("");

	const [scope, setScope] =
		useState<CommunityScope>("global");
	const [category, setCategory] =
		useState<CommunityCategory>("전체");
	const [sort, setSort] =
		useState<CommunitySort>("latest");
	const [search, setSearch] = useState("");
	const [searchDraft, setSearchDraft] = useState("");
	const [featuredOnly, setFeaturedOnly] = useState(false);
	const [showLeaderboard, setShowLeaderboard] = useState(false);

	const [posts, setPosts] =
		useState<CommunityPostSummary[]>([]);
	const [leaderboard, setLeaderboard] =
		useState<CommunityLeaderboardEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const loadProfile = useCallback(async () => {
		try {
			const response =
				await api.get<CommunityProfile>(
					"/community/profile",
				);

			setProfile(response.data);
			setNicknameDraft(response.data.nickname || "ㅇㅇ");
			setDivisionCodeDraft(
				response.data.divisionCode || "",
			);
		} catch (error) {
			console.warn("커뮤니티 프로필 조회 실패:", error);
		}
	}, []);

	const loadPosts = useCallback(async () => {
		if (showLeaderboard) {
			return;
		}

		if (scope === "division" && !profile.divisionCode) {
			setPosts([]);
			return;
		}

		try {
			setIsLoading(true);

			const response =
				await api.get<CommunityPostListResponse>(
					"/community/posts",
					{
						params: {
							scope,
							divisionCode:
								scope === "division"
									? profile.divisionCode
									: undefined,
							category:
								category === "전체"
									? undefined
									: category,
							sort,
							search: search || undefined,
							featured: featuredOnly || undefined,
							page,
							limit: 20,
						},
					},
				);

			setPosts(response.data.posts);
			setTotalPages(response.data.totalPages || 1);
		} catch (error) {
			console.error("게시글 조회 실패:", error);
			setPosts([]);

			toast({
				title: "게시글을 불러오지 못했습니다.",
				status: "error",
				duration: 3000,
				isClosable: true,
			});
		} finally {
			setIsLoading(false);
		}
	}, [
		category,
		featuredOnly,
		page,
		profile.divisionCode,
		scope,
		search,
		showLeaderboard,
		sort,
		toast,
	]);

	const loadLeaderboard = useCallback(async () => {
		if (!showLeaderboard) {
			return;
		}

		try {
			const response =
				await api.get<CommunityLeaderboardEntry[]>(
					"/community/leaderboard",
					{
						params: {
							divisionCode:
								profile.divisionCode || undefined,
						},
					},
				);

			setLeaderboard(response.data);
		} catch (error) {
			console.warn("투자왕 조회 실패:", error);
			setLeaderboard([]);
		}
	}, [profile.divisionCode, showLeaderboard]);

	useEffect(() => {
		void loadProfile();
	}, [loadProfile]);

	useEffect(() => {
		void loadPosts();
	}, [loadPosts]);

	useEffect(() => {
		void loadLeaderboard();
	}, [loadLeaderboard]);

	useEffect(() => {
		setPage(1);
	}, [
		scope,
		category,
		sort,
		search,
		featuredOnly,
		showLeaderboard,
	]);

	const selectedDivision = useMemo(
		() =>
			DIVISION_OPTIONS.find(
				(item) => item.code === divisionCodeDraft,
			),
		[divisionCodeDraft],
	);

	const saveProfile = async () => {
		try {
			const response =
				await api.patch<CommunityProfile>(
					"/community/profile",
					{
						nickname:
							nicknameDraft.trim() || "ㅇㅇ",
						divisionCode:
							selectedDivision?.code ?? null,
						divisionName:
							selectedDivision?.name ?? null,
					},
				);

			setProfile(response.data);
			profileModal.onClose();

			toast({
				title: "커뮤니티 설정을 저장했습니다.",
				status: "success",
				duration: 2500,
				isClosable: true,
			});
		} catch (error: any) {
			toast({
				title: "설정 저장 실패",
				description:
					error?.response?.data?.message ||
					"로그인 상태와 입력값을 확인하세요.",
				status: "error",
				duration: 3500,
				isClosable: true,
			});
		}
	};

	const openWrite = () => {
		if (scope === "division" && !profile.divisionCode) {
			toast({
				title: "사단 설정이 필요합니다.",
				description:
					"커뮤니티 설정에서 사단을 먼저 선택하세요.",
				status: "warning",
				duration: 3000,
				isClosable: true,
			});

			profileModal.onOpen();
			return;
		}

		navigate(
			`/community/write?scope=${scope}`,
		);
	};

	return (
		<Box minH="calc(100vh - 72px)" bg="#F4F5F7">
			<Box
				maxW="1280px"
				mx="auto"
				px={{ base: "10px", md: "20px" }}
				py={{ base: "18px", md: "28px" }}
			>
				<Flex
					mb="12px"
					align={{ base: "flex-start", md: "center" }}
					justify="space-between"
					direction={{ base: "column", md: "row" }}
					gap="3"
				>
					<Box>
						<HStack spacing="2">
							<Heading size="lg">
								장병 투자 커뮤니티
							</Heading>

							<Badge colorScheme="pink">
								BETA
							</Badge>
						</HStack>

						<Text mt="1" fontSize="13px" color="gray.600">
							기본 닉네임은 ㅇㅇ이며 실제 IP 대신
							게시판별 가상 식별코드가 표시됩니다.
						</Text>
					</Box>

					<HStack spacing="2">
						<IconButton
							aria-label="커뮤니티 설정"
							icon={<SettingsIcon />}
							size="sm"
							variant="outline"
							bg="white"
							onClick={profileModal.onOpen}
						/>

						<Button
							leftIcon={<EditIcon />}
							size="sm"
							colorScheme="pink"
							onClick={openWrite}
						>
							글쓰기
						</Button>
					</HStack>
				</Flex>

				<Card
					borderRadius="0"
					borderWidth="1px"
					borderColor="gray.300"
					boxShadow="none"
				>
					<CardBody p="0">
						<Flex
							px="14px"
							py="11px"
							align="center"
							justify="space-between"
							bg="white"
						>
							<HStack spacing="2" wrap="wrap">
								<Text fontWeight="900">
									{showLeaderboard
										? "이달의 투자왕"
										: featuredOnly
											? "추천글"
											: scope === "division"
												? `${profile.divisionName ?? "사단 미설정"} 라운지`
												: "전체 게시판"}
								</Text>

								{scope === "division" &&
									profile.divisionName && (
										<Badge colorScheme="blue">
											{profile.divisionName}
										</Badge>
									)}
							</HStack>

							<Text fontSize="11px" color="gray.500">
								민감한 부대 위치·훈련·근무 정보 작성 금지
							</Text>
						</Flex>

						<BoardTabs
							scope={scope}
							onScopeChange={setScope}
							featuredOnly={featuredOnly}
							onFeaturedChange={setFeaturedOnly}
							showLeaderboard={showLeaderboard}
							onLeaderboardChange={setShowLeaderboard}
							profile={profile}
						/>

						{showLeaderboard ? (
							<Box p={{ base: "10px", md: "16px" }}>
								<LeaderboardPanel
									entries={leaderboard}
									profile={profile}
								/>
							</Box>
						) : (
							<>
								<Flex
									px="10px"
									py="9px"
									align={{ base: "stretch", md: "center" }}
									justify="space-between"
									direction={{ base: "column", md: "row" }}
									gap="2"
									borderBottomWidth="1px"
									borderColor="gray.300"
									bg="white"
								>
									<HStack
										spacing="1"
										overflowX="auto"
									>
										{COMMUNITY_CATEGORIES.map(
											(item) => (
												<Button
													key={item}
													size="xs"
													borderRadius="0"
													variant={
														category === item
															? "solid"
															: "ghost"
													}
													colorScheme={
														category === item
															? "pink"
															: "gray"
													}
													onClick={() =>
														setCategory(item)
													}
												>
													{item}
												</Button>
											),
										)}
									</HStack>

									<Select
										w={{ base: "100%", md: "130px" }}
										size="sm"
										borderRadius="0"
										value={sort}
										onChange={(event) =>
											setSort(
												event.target
													.value as CommunitySort,
											)
										}
									>
										<option value="latest">
											최신순
										</option>
										<option value="popular">
											추천순
										</option>
										<option value="comments">
											댓글순
										</option>
									</Select>
								</Flex>

								<CommunityBoardTable
									posts={posts}
									isLoading={isLoading}
								/>

								<Flex
									px="10px"
									py="10px"
									align="center"
									justify="space-between"
									bg="white"
									borderTopWidth="1px"
									borderColor="gray.200"
								>
									<HStack spacing="1">
										<Button
											size="xs"
											borderRadius="0"
											isDisabled={page <= 1}
											onClick={() =>
												setPage((value) =>
													Math.max(
														1,
														value - 1,
													),
												)
											}
										>
											이전
										</Button>

										<Text
											px="2"
											fontSize="12px"
											color="gray.600"
										>
											{page} / {totalPages}
										</Text>

										<Button
											size="xs"
											borderRadius="0"
											isDisabled={
												page >= totalPages
											}
											onClick={() =>
												setPage((value) =>
													Math.min(
														totalPages,
														value + 1,
													),
												)
											}
										>
											다음
										</Button>
									</HStack>

									<Button
										leftIcon={<EditIcon />}
										size="xs"
										borderRadius="0"
										colorScheme="pink"
										onClick={openWrite}
									>
										글쓰기
									</Button>
								</Flex>
							</>
						)}
					</CardBody>
				</Card>

				{!showLeaderboard && (
					<Flex
						mt="10px"
						justify="center"
					>
						<InputGroup
							maxW="480px"
							size="sm"
						>
							<InputLeftElement pointerEvents="none">
								<SearchIcon color="gray.400" />
							</InputLeftElement>

							<Input
								value={searchDraft}
								borderRadius="0"
								bg="white"
								placeholder="제목·내용·태그 검색"
								onChange={(event) =>
									setSearchDraft(event.target.value)
								}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										setSearch(searchDraft.trim());
									}
								}}
							/>

							<Button
								ml="2"
								borderRadius="0"
								onClick={() =>
									setSearch(searchDraft.trim())
								}
							>
								검색
							</Button>
						</InputGroup>
					</Flex>
				)}
			</Box>

			<Modal
				isOpen={profileModal.isOpen}
				onClose={profileModal.onClose}
				isCentered
			>
				<ModalOverlay />

				<ModalContent borderRadius="12px">
					<ModalHeader>커뮤니티 설정</ModalHeader>
					<ModalCloseButton />

					<ModalBody>
						<Stack spacing="5">
							<FormControl>
								<FormLabel fontWeight="800">
									닉네임
								</FormLabel>
								<Input
									value={nicknameDraft}
									maxLength={12}
									placeholder="미설정 시 ㅇㅇ"
									onChange={(event) =>
										setNicknameDraft(
											event.target.value,
										)
									}
								/>
								<Text mt="1.5" fontSize="12px" color="gray.500">
									닉네임은 중복될 수 있으며 가상 식별코드로
									구분됩니다.
								</Text>
							</FormControl>

							<FormControl>
								<FormLabel fontWeight="800">
									사단
								</FormLabel>
								<Select
									value={divisionCodeDraft}
									onChange={(event) =>
										setDivisionCodeDraft(
											event.target.value,
										)
									}
								>
									<option value="">
										사단 미설정
									</option>
									{DIVISION_OPTIONS.map((item) => (
										<option
											key={item.code}
											value={item.code}
										>
											{item.name}
										</option>
									))}
								</Select>
								<Text mt="1.5" fontSize="12px" color="red.500">
									중대·소대·생활관·근무지·훈련일정 등
									세부 정보는 입력하지 마세요.
								</Text>
							</FormControl>

							<Divider />

							<Box
								p="3"
								bg="gray.50"
								borderWidth="1px"
								borderColor="gray.200"
							>
								<Text fontSize="12px" lineHeight="1.7">
									화면 표시 예시:{" "}
									<strong>
										{nicknameDraft.trim() || "ㅇㅇ"}
										(182.21)
									</strong>
								</Text>
							</Box>
						</Stack>
					</ModalBody>

					<ModalFooter>
						<Button
							mr="2"
							variant="ghost"
							onClick={profileModal.onClose}
						>
							취소
						</Button>
						<Button
							colorScheme="pink"
							onClick={saveProfile}
						>
							저장
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Box>
	);
}
