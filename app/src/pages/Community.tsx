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
	SimpleGrid,
	Skeleton,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
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
	RepeatIcon,
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
	COMMUNITY_BRANCH_OPTIONS,
	COMMUNITY_CATEGORIES,
	getCommunityBranchName,
} from "../data/community.constants";
import type {
	CommunityBranchWinner,
	CommunityCategory,
	CommunityLeaderboardEntry,
	CommunityLeaderboardMode,
	CommunityLeaderboardResponse,
	CommunityPostListResponse,
	CommunityPostSummary,
	CommunityProfile,
	CommunityScope,
	CommunitySort,
	MilitaryBranch,
} from "../types/community.types";

const EMPTY_PROFILE: CommunityProfile = {
	nickname: "ㅇㅇ",
	branch: null,
	branchName: null,
};

const won = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "KRW",
	maximumFractionDigits: 0,
});

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

function formatGeneratedAt(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
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
	selectedBranch,
	onGlobal,
	onBranch,
	featuredOnly,
	onFeatured,
	showLeaderboard,
	onLeaderboard,
}: {
	scope: CommunityScope;
	selectedBranch: MilitaryBranch;
	onGlobal: () => void;
	onBranch: (branch: MilitaryBranch) => void;
	featuredOnly: boolean;
	onFeatured: () => void;
	showLeaderboard: boolean;
	onLeaderboard: () => void;
}) {
	return (
		<Flex
			px="3"
			py="2"
			gap="2"
			bg="army.50"
			borderTopWidth="1px"
			borderBottomWidth="1px"
			borderColor="army.200"
			overflowX="auto"
		>
			<Button
				size="sm"
				flexShrink={0}
				variant={
					scope === "global" &&
					!featuredOnly &&
					!showLeaderboard
						? "solid"
						: "ghost"
				}
				colorScheme="army"
				onClick={onGlobal}
			>
				전체
			</Button>

			{COMMUNITY_BRANCH_OPTIONS.map((item) => (
				<Button
					key={item.code}
					size="sm"
					flexShrink={0}
					variant={
						scope === "branch" &&
						selectedBranch === item.code &&
						!featuredOnly &&
						!showLeaderboard
							? "solid"
							: "ghost"
					}
					colorScheme="army"
					onClick={() => onBranch(item.code)}
				>
					{item.shortName}
				</Button>
			))}

			<Button
				size="sm"
				flexShrink={0}
				leftIcon={<StarIcon />}
				variant={featuredOnly ? "solid" : "ghost"}
				colorScheme="signal"
				onClick={onFeatured}
			>
				추천글
			</Button>

			<Button
				size="sm"
				flexShrink={0}
				variant={showLeaderboard ? "solid" : "ghost"}
				colorScheme="khaki"
				onClick={onLeaderboard}
			>
				투자 랭킹
			</Button>
		</Flex>
	);
}

function BranchWinnerCards({
	winners,
	isLoading,
}: {
	winners: CommunityBranchWinner[];
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<SimpleGrid
				columns={{ base: 1, sm: 2, xl: 5 }}
				spacing="3"
			>
				{COMMUNITY_BRANCH_OPTIONS.map((branch) => (
					<Skeleton
						key={branch.code}
						h="118px"
						borderRadius="14px"
					/>
				))}
			</SimpleGrid>
		);
	}

	return (
		<SimpleGrid
			columns={{ base: 1, sm: 2, xl: 5 }}
			spacing="3"
		>
			{COMMUNITY_BRANCH_OPTIONS.map((branch) => {
				const winner = winners.find(
					(item) => item.branch === branch.code,
				)?.winner;

				return (
					<Card
						key={branch.code}
						borderWidth="1px"
						borderColor="army.200"
						boxShadow="sm"
					>
						<CardBody p="4">
							<Flex align="center" justify="space-between">
								<Badge colorScheme="army">
									{branch.shortName}
								</Badge>
								<Text fontSize="10px" color="gray.500">
									이달의 투자왕
								</Text>
							</Flex>

							{winner ? (
								<Box mt="3">
									<Text fontSize="sm" fontWeight="900" noOfLines={1}>
										{winner.nickname}
									</Text>
									<Text
										mt="1"
										fontSize="lg"
										fontWeight="900"
										color={winner.returnRate >= 0 ? "red.500" : "blue.500"}
									>
										{winner.returnRate >= 0 ? "+" : ""}
										{winner.returnRate.toFixed(2)}%
									</Text>
									<Text fontSize="11px" color="gray.500">
										종합 {winner.totalScore.toFixed(1)}점
									</Text>
								</Box>
							) : (
								<Text mt="4" fontSize="12px" color="gray.500">
									아직 산정 대상이 없습니다.
								</Text>
							)}
						</CardBody>
					</Card>
				);
			})}
		</SimpleGrid>
	);
}

function LeaderboardPanel({
	entries,
	mode,
	onModeChange,
	branch,
	onBranchChange,
	winners,
	generatedAt,
	isLoading,
	onRefresh,
}: {
	entries: CommunityLeaderboardEntry[];
	mode: CommunityLeaderboardMode;
	onModeChange: (mode: CommunityLeaderboardMode) => void;
	branch: MilitaryBranch;
	onBranchChange: (branch: MilitaryBranch) => void;
	winners: CommunityBranchWinner[];
	generatedAt: string;
	isLoading: boolean;
	onRefresh: () => void;
}) {
	return (
		<Stack spacing="5">
			<Box>
				<Flex
					mb="3"
					align={{ base: "flex-start", md: "center" }}
					justify="space-between"
					direction={{ base: "column", md: "row" }}
					gap="2"
				>
					<Box>
						<Heading size="sm">군종별 이달의 투자왕</Heading>
						<Text mt="1" fontSize="12px" color="gray.600">
							수익률만이 아니라 최대 손실, 운용 안정성, 거래 참여를 함께 평가합니다.
						</Text>
					</Box>

					<Badge colorScheme="signal">교육형 위험조정 랭킹</Badge>
				</Flex>

				<BranchWinnerCards winners={winners} isLoading={isLoading} />
			</Box>

			<Card borderWidth="1px" borderColor="army.200" boxShadow="sm">
				<CardBody p="0">
					<Flex
						px={{ base: "3", md: "5" }}
						py="4"
						align={{ base: "stretch", md: "center" }}
						justify="space-between"
						direction={{ base: "column", md: "row" }}
						gap="3"
						bg="khaki.50"
						borderBottomWidth="1px"
						borderColor="army.200"
					>
						<Box>
							<Heading size="sm">
								{getCommunityBranchName(branch)} {mode === "live" ? "실시간 수익률" : "이달의 종합 순위"}
							</Heading>
							<Text mt="1" fontSize="11px" color="gray.600">
								{mode === "live"
									? "모의투자 계좌의 현재 평가금액을 기준으로 계산합니다."
									: "월 3회 이상 체결, 3일 이상 활동한 사용자가 투자왕 산정 대상입니다."}
							</Text>
						</Box>

						<HStack spacing="2" flexWrap="wrap">
							<Select
								size="sm"
								w="150px"
								value={branch}
								onChange={(event) =>
									onBranchChange(event.target.value as MilitaryBranch)
								}
							>
								{COMMUNITY_BRANCH_OPTIONS.map((item) => (
									<option key={item.code} value={item.code}>
										{item.name}
									</option>
								))}
							</Select>

							<Button
								size="sm"
								variant={mode === "live" ? "solid" : "outline"}
								colorScheme="army"
								onClick={() => onModeChange("live")}
							>
								실시간 수익률
							</Button>
							<Button
								size="sm"
								variant={mode === "monthly" ? "solid" : "outline"}
								colorScheme="khaki"
								onClick={() => onModeChange("monthly")}
							>
								이달의 투자왕
							</Button>
							<IconButton
								aria-label="랭킹 새로고침"
								icon={<RepeatIcon />}
								size="sm"
								variant="outline"
								isLoading={isLoading}
								onClick={onRefresh}
							/>
						</HStack>
					</Flex>

					{generatedAt && (
						<Text px="5" pt="3" fontSize="10px" color="gray.500">
							최근 계산 {formatGeneratedAt(generatedAt)} · 실제 주문이 아닌 모의투자 성과입니다.
						</Text>
					)}

					{isLoading ? (
						<Stack p="5" spacing="2">
							{Array.from({ length: 6 }).map((_, index) => (
								<Skeleton key={index} h="42px" borderRadius="8px" />
							))}
						</Stack>
					) : entries.length === 0 ? (
						<Flex minH="220px" align="center" justify="center">
							<Stack align="center" spacing="2">
								<Text fontWeight="900">랭킹 데이터가 없습니다.</Text>
								<Text fontSize="sm" color="gray.500">
									모의투자 계좌를 생성하고 거래하면 순위에 반영됩니다.
								</Text>
							</Stack>
						</Flex>
					) : (
						<TableContainer>
							<Table size="sm">
								<Thead bg="army.50">
									<Tr>
										<Th w="70px" textAlign="center">순위</Th>
										<Th>사용자</Th>
										<Th isNumeric>현재 자산</Th>
										<Th isNumeric>수익률</Th>
										{mode === "monthly" && (
											<>
												<Th isNumeric>최대 손실</Th>
												<Th isNumeric>종합 점수</Th>
												<Th textAlign="center">상태</Th>
											</>
										)}
									</Tr>
								</Thead>

								<Tbody>
									{entries.map((entry) => (
										<Tr key={entry.id} bg={entry.branchRank === 1 ? "signal.50" : "white"}>
											<Td textAlign="center" fontWeight="900">
												{entry.branchRank ?? "-"}
											</Td>
											<Td>
												<AuthorLabel nickname={entry.nickname} code={entry.authorCode} />
												<Text mt="1" fontSize="10px" color="gray.400">
													전체 {entry.overallRank ?? "-"}위 · 체결 {entry.filledTradeCount}회
												</Text>
											</Td>
											<Td isNumeric fontWeight="700">
												{won.format(entry.currentEquity)}
											</Td>
											<Td
												isNumeric
												fontWeight="900"
												color={entry.returnRate >= 0 ? "red.500" : "blue.500"}
											>
												{entry.returnRate >= 0 ? "+" : ""}
												{entry.returnRate.toFixed(2)}%
											</Td>

											{mode === "monthly" && (
												<>
													<Td isNumeric>
														-{Math.abs(entry.maxDrawdown).toFixed(2)}%
													</Td>
													<Td isNumeric fontWeight="900">
														{entry.totalScore.toFixed(1)}
													</Td>
													<Td textAlign="center">
														{entry.badge ? (
															<Badge colorScheme={entry.badge === "투자왕" ? "signal" : entry.badge === "수익왕" ? "red" : "green"}>
																{entry.badge}
															</Badge>
														) : entry.isEligible ? (
															<Badge colorScheme="army">산정 중</Badge>
														) : (
															<Badge colorScheme="gray">조건 미충족</Badge>
														)}
													</Td>
												</>
											)}
										</Tr>
									))}
								</Tbody>
							</Table>
						</TableContainer>
					)}
				</CardBody>
			</Card>
		</Stack>
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
			<Stack spacing="2" p="4">
				{Array.from({ length: 8 }).map((_, index) => (
					<Skeleton key={index} h="38px" borderRadius="8px" />
				))}
			</Stack>
		);
	}

	if (posts.length === 0) {
		return (
			<Flex minH="260px" align="center" justify="center">
				<Stack align="center" spacing="2">
					<Text fontWeight="900">등록된 게시글이 없습니다.</Text>
					<Text fontSize="sm" color="gray.500">
						첫 번째 금융 학습 글을 작성해 보세요.
					</Text>
				</Stack>
			</Flex>
		);
	}

	return (
		<TableContainer>
			<Table size="sm" sx={{ tableLayout: "fixed" }}>
				<Thead bg="army.50">
					<Tr>
						<Th w="76px" textAlign="center">구분</Th>
						<Th>제목</Th>
						<Th w="145px">글쓴이</Th>
						<Th w="76px" textAlign="center">작성일</Th>
						<Th w="58px" isNumeric>조회</Th>
						<Th w="58px" isNumeric>추천</Th>
					</Tr>
				</Thead>

				<Tbody>
					{posts.map((post) => (
						<Tr
							key={post.id}
							bg={post.isFeatured ? "signal.50" : "white"}
							_hover={{ bg: "army.50" }}
						>
							<Td textAlign="center" px="2">
								{post.isFeatured ? (
									<Badge colorScheme="signal">추천</Badge>
								) : (
									<Text fontSize="11px" color="gray.500" noOfLines={1}>
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
										fontWeight="700"
										color="gray.800"
										noOfLines={1}
										_hover={{ textDecoration: "underline", color: "army.700" }}
									>
										{post.title}
									</Text>

									{post.commentCount > 0 && (
										<Text ml="1.5" fontSize="11px" color="signal.700" fontWeight="900">
											[{post.commentCount}]
										</Text>
									)}
								</Flex>
							</Td>

							<Td px="2">
								<AuthorLabel nickname={post.authorNickname} code={post.authorCode} />
							</Td>
							<Td textAlign="center" px="2">
								<Text fontSize="11px" color="gray.500">{formatDate(post.createdAt)}</Text>
							</Td>
							<Td isNumeric px="2"><Text fontSize="11px">{post.viewCount}</Text></Td>
							<Td isNumeric px="2">
								<Text fontSize="11px" color={post.likeCount > 0 ? "signal.700" : "gray.600"}>
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

	const [profile, setProfile] = useState<CommunityProfile>(EMPTY_PROFILE);
	const [nicknameDraft, setNicknameDraft] = useState("ㅇㅇ");

	const [scope, setScope] = useState<CommunityScope>("global");
	const [selectedBranch, setSelectedBranch] = useState<MilitaryBranch>("ARMY");
	const [category, setCategory] = useState<CommunityCategory>("전체");
	const [sort, setSort] = useState<CommunitySort>("latest");
	const [search, setSearch] = useState("");
	const [searchDraft, setSearchDraft] = useState("");
	const [featuredOnly, setFeaturedOnly] = useState(false);
	const [showLeaderboard, setShowLeaderboard] = useState(false);

	const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const [leaderboardMode, setLeaderboardMode] = useState<CommunityLeaderboardMode>("live");
	const [leaderboard, setLeaderboard] = useState<CommunityLeaderboardEntry[]>([]);
	const [branchWinners, setBranchWinners] = useState<CommunityBranchWinner[]>([]);
	const [leaderboardGeneratedAt, setLeaderboardGeneratedAt] = useState("");
	const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

	const loadProfile = useCallback(async () => {
		try {
			const response = await api.get<CommunityProfile>("/community/profile");
			setProfile(response.data);
			setNicknameDraft(response.data.nickname || "ㅇㅇ");

			if (
				response.data.branch &&
				response.data.branch !== "ETC"
			) {
				setSelectedBranch(response.data.branch);
			}
		} catch (error) {
			console.warn("커뮤니티 프로필 조회 실패:", error);
		}
	}, []);

	const loadPosts = useCallback(async () => {
		if (showLeaderboard) {
			return;
		}

		try {
			setIsLoading(true);
			const response = await api.get<CommunityPostListResponse>(
				"/community/posts",
				{
					params: {
						scope,
						branch: scope === "branch" ? selectedBranch : undefined,
						category: category === "전체" ? undefined : category,
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
		scope,
		search,
		selectedBranch,
		showLeaderboard,
		sort,
		toast,
	]);

	const loadLeaderboard = useCallback(async () => {
		if (!showLeaderboard) {
			return;
		}

		try {
			setIsLeaderboardLoading(true);
			const [leaderboardResponse, winnersResponse] = await Promise.all([
				api.get<CommunityLeaderboardResponse>(
					`/community/leaderboard/${leaderboardMode}`,
					{
						params: {
							branch: selectedBranch,
							limit: 30,
							_: Date.now(),
						},
					},
				),
				api.get<{
					month: string;
					generatedAt: string;
					winners: CommunityBranchWinner[];
				}>("/community/leaderboard/branch-winners", {
					params: { _: Date.now() },
				}),
			]);

			setLeaderboard(leaderboardResponse.data.entries || []);
			setLeaderboardGeneratedAt(leaderboardResponse.data.generatedAt || "");
			setBranchWinners(winnersResponse.data.winners || []);
		} catch (error) {
			console.warn("투자 랭킹 조회 실패:", error);
			setLeaderboard([]);
		} finally {
			setIsLeaderboardLoading(false);
		}
	}, [leaderboardMode, selectedBranch, showLeaderboard]);

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
		if (!showLeaderboard) {
			return;
		}

		const timer = window.setInterval(() => {
			void loadLeaderboard();
		}, 60_000);

		return () => window.clearInterval(timer);
	}, [loadLeaderboard, showLeaderboard]);

	useEffect(() => {
		setPage(1);
	}, [scope, selectedBranch, category, sort, search, featuredOnly, showLeaderboard]);

	const currentBoardTitle = useMemo(() => {
		if (showLeaderboard) {
			return "전군 모의투자 랭킹";
		}
		if (featuredOnly) {
			return "추천글";
		}
		if (scope === "branch") {
			return `${getCommunityBranchName(selectedBranch)} 금융 라운지`;
		}
		return "전체 게시판";
	}, [featuredOnly, scope, selectedBranch, showLeaderboard]);

	const saveProfile = async () => {
		try {
			const response = await api.patch<CommunityProfile>(
				"/community/profile",
				{
					nickname: nicknameDraft.trim() || "ㅇㅇ",
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
		if (scope === "branch") {
			if (!profile.branch) {
				toast({
					title: "복무 구분 설정이 필요합니다.",
					description: "마이페이지의 군 프로필에서 복무 구분을 설정하세요.",
					status: "warning",
					duration: 3000,
				});
				return;
			}

			if (profile.branch !== selectedBranch) {
				toast({
					title: "자신의 복무 구분 게시판에만 작성할 수 있습니다.",
					description: `${profile.branchName ?? "내 군종"} 게시판에서 글쓰기를 이용하세요.`,
					status: "warning",
					duration: 3000,
				});
				return;
			}
		}

		navigate(`/community/write?scope=${scope}`);
	};

	return (
		<Box minH="calc(100vh - 72px)" bg="#F2F1E9">
			<Box maxW="1280px" mx="auto" px={{ base: "12px", md: "24px" }} py={{ base: "18px", md: "30px" }}>
				<Box
					mb="5"
					p={{ base: "5", md: "7" }}
					borderRadius="20px"
					bgGradient="linear(to-r, army.900, army.600)"
					color="white"
					boxShadow="0 16px 34px rgba(34, 43, 25, 0.18)"
				>
					<Flex
						align={{ base: "flex-start", md: "center" }}
						justify="space-between"
						direction={{ base: "column", md: "row" }}
						gap="4"
					>
						<Box>
							<HStack spacing="2" mb="2">
								<Badge colorScheme="signal">전군 금융 학습</Badge>
								<Badge colorScheme="whiteAlpha">BETA</Badge>
							</HStack>
							<Heading size="lg">전군 금융 라운지</Heading>
							<Text mt="2" maxW="720px" fontSize="sm" color="whiteAlpha.800" lineHeight="1.8">
								복무 유형별로 모의투자 경험과 금융 정보를 공유하고, 실시간 수익률과 위험관리 중심의 이달의 투자왕을 확인하세요.
							</Text>
						</Box>

						<HStack spacing="2">
							<IconButton
								aria-label="커뮤니티 설정"
								icon={<SettingsIcon />}
								variant="outline"
								color="white"
								borderColor="whiteAlpha.500"
								_hover={{ bg: "whiteAlpha.200" }}
								onClick={profileModal.onOpen}
							/>
							<Button leftIcon={<EditIcon />} colorScheme="signal" onClick={openWrite}>
								글쓰기
							</Button>
						</HStack>
					</Flex>
				</Box>

				<SimpleGrid columns={{ base: 1, md: 3 }} spacing="3" mb="4">
					<Card borderWidth="1px" borderColor="army.200">
						<CardBody>
							<Stat>
								<StatLabel>내 복무 구분</StatLabel>
								<StatNumber fontSize="lg">{profile.branchName ?? "미설정"}</StatNumber>
							</Stat>
						</CardBody>
					</Card>
					<Card borderWidth="1px" borderColor="army.200">
						<CardBody>
							<Stat>
								<StatLabel>현재 게시판</StatLabel>
								<StatNumber fontSize="lg">{currentBoardTitle}</StatNumber>
							</Stat>
						</CardBody>
					</Card>
					<Card borderWidth="1px" borderColor="army.200">
						<CardBody>
							<Stat>
								<StatLabel>랭킹 기준</StatLabel>
								<StatNumber fontSize="lg">실제 모의투자 DB</StatNumber>
							</Stat>
						</CardBody>
					</Card>
				</SimpleGrid>

				<Card borderWidth="1px" borderColor="army.200" boxShadow="sm" overflow="hidden">
					<CardBody p="0">
						<Flex
							px={{ base: "4", md: "5" }}
							py="4"
							align="center"
							justify="space-between"
							bg="#FFFEFA"
							gap="3"
						>
							<Box>
								<Text fontWeight="900">{currentBoardTitle}</Text>
								<Text mt="1" fontSize="11px" color="gray.500">
									실제 IP와 세부 부대 정보는 표시하지 않으며 게시판별 가상 식별코드를 사용합니다.
								</Text>
							</Box>
							<Text display={{ base: "none", md: "block" }} fontSize="11px" color="red.500">
								부대 위치·훈련·근무 정보 작성 금지
							</Text>
						</Flex>

						<BoardTabs
							scope={scope}
							selectedBranch={selectedBranch}
							onGlobal={() => {
								setScope("global");
								setFeaturedOnly(false);
								setShowLeaderboard(false);
							}}
							onBranch={(branch) => {
								setScope("branch");
								setSelectedBranch(branch);
								setFeaturedOnly(false);
								setShowLeaderboard(false);
							}}
							featuredOnly={featuredOnly}
							onFeatured={() => {
								setFeaturedOnly(true);
								setShowLeaderboard(false);
							}}
							showLeaderboard={showLeaderboard}
							onLeaderboard={() => {
								setFeaturedOnly(false);
								setShowLeaderboard(true);
							}}
						/>

						{showLeaderboard ? (
							<Box p={{ base: "3", md: "5" }}>
								<LeaderboardPanel
									entries={leaderboard}
									mode={leaderboardMode}
									onModeChange={setLeaderboardMode}
									branch={selectedBranch}
									onBranchChange={setSelectedBranch}
									winners={branchWinners}
									generatedAt={leaderboardGeneratedAt}
									isLoading={isLeaderboardLoading}
									onRefresh={() => void loadLeaderboard()}
								/>
							</Box>
						) : (
							<>
								<Flex
									px="3"
									py="3"
									align={{ base: "stretch", md: "center" }}
									justify="space-between"
									direction={{ base: "column", md: "row" }}
									gap="2"
									borderBottomWidth="1px"
									borderColor="army.200"
									bg="white"
								>
									<HStack spacing="1" overflowX="auto">
										{COMMUNITY_CATEGORIES.map((item) => (
											<Button
												key={item}
												size="xs"
												flexShrink={0}
												variant={category === item ? "solid" : "ghost"}
												colorScheme="army"
												onClick={() => setCategory(item)}
											>
												{item}
											</Button>
										))}
									</HStack>

									<Select
										w={{ base: "100%", md: "130px" }}
										size="sm"
										value={sort}
										onChange={(event) => setSort(event.target.value as CommunitySort)}
									>
										<option value="latest">최신순</option>
										<option value="popular">추천순</option>
										<option value="comments">댓글순</option>
									</Select>
								</Flex>

								<CommunityBoardTable posts={posts} isLoading={isLoading} />

								<Flex
									px="4"
									py="3"
									align="center"
									justify="space-between"
									bg="white"
									borderTopWidth="1px"
									borderColor="army.200"
								>
									<HStack spacing="1">
										<Button size="xs" isDisabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
											이전
										</Button>
										<Text px="2" fontSize="12px" color="gray.600">
											{page} / {totalPages}
										</Text>
										<Button size="xs" isDisabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
											다음
										</Button>
									</HStack>

									<Button leftIcon={<EditIcon />} size="xs" colorScheme="army" onClick={openWrite}>
										글쓰기
									</Button>
								</Flex>
							</>
						)}
					</CardBody>
				</Card>

				{!showLeaderboard && (
					<Flex mt="4" justify="center">
						<InputGroup maxW="520px" size="sm">
							<InputLeftElement pointerEvents="none">
								<SearchIcon color="army.400" />
							</InputLeftElement>
							<Input
								value={searchDraft}
								bg="white"
								placeholder="제목·내용·태그 검색"
								onChange={(event) => setSearchDraft(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										setSearch(searchDraft.trim());
									}
								}}
							/>
							<Button ml="2" colorScheme="army" onClick={() => setSearch(searchDraft.trim())}>
								검색
							</Button>
						</InputGroup>
					</Flex>
				)}
			</Box>

			<Modal isOpen={profileModal.isOpen} onClose={profileModal.onClose} isCentered>
				<ModalOverlay />
				<ModalContent borderRadius="16px">
					<ModalHeader>커뮤니티 설정</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<Stack spacing="5">
							<FormControl>
								<FormLabel fontWeight="800">닉네임</FormLabel>
								<Input
									value={nicknameDraft}
									maxLength={12}
									placeholder="미설정 시 ㅇㅇ"
									onChange={(event) => setNicknameDraft(event.target.value)}
								/>
								<Text mt="1.5" fontSize="12px" color="gray.500">
									닉네임은 중복될 수 있으며 가상 식별코드로 구분됩니다.
								</Text>
							</FormControl>

							<FormControl>
								<FormLabel fontWeight="800">복무 구분</FormLabel>
								<Box p="3" bg="army.50" borderWidth="1px" borderColor="army.200" borderRadius="10px">
									<Text fontWeight="900">{profile.branchName ?? "미설정"}</Text>
									<Text mt="1" fontSize="11px" color="gray.500">
										복무 구분은 마이페이지의 군 프로필 정보와 자동으로 동기화됩니다.
									</Text>
								</Box>
							</FormControl>

							<Divider />
							<Box p="3" bg="khaki.50" borderWidth="1px" borderColor="khaki.200" borderRadius="10px">
								<Text fontSize="12px" lineHeight="1.7">
									화면 표시 예시: <strong>{nicknameDraft.trim() || "ㅇㅇ"}(182.21)</strong>
								</Text>
							</Box>
						</Stack>
					</ModalBody>
					<ModalFooter>
						<Button mr="2" variant="ghost" onClick={profileModal.onClose}>취소</Button>
						<Button colorScheme="army" onClick={saveProfile}>저장</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Box>
	);
}
