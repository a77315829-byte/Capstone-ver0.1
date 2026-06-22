import React, {
	useCallback,
	useEffect,
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
	Heading,
	HStack,
	Skeleton,
	Stack,
	Text,
	Textarea,
	useToast,
} from "@chakra-ui/react";
import {
	ArrowBackIcon,
	StarIcon,
} from "@chakra-ui/icons";
import {
	Link as RouterLink,
	useParams,
} from "react-router-dom";

import api from "../services/api.service";
import type {
	CommunityComment,
	CommunityPostDetail as CommunityPostDetailType,
} from "../types/community.types";

function formatDateTime(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function Author({
	nickname,
	code,
	isPostAuthor = false,
}: {
	nickname: string;
	code: string;
	isPostAuthor?: boolean;
}) {
	return (
		<HStack spacing="1">
			<Text fontSize="12px" fontWeight="700">
				{nickname}
				<Text as="span" ml="1" color="gray.400" fontWeight="500">
					({code})
				</Text>
			</Text>

			{isPostAuthor && (
				<Badge colorScheme="pink" fontSize="9px">
					글쓴이
				</Badge>
			)}
		</HStack>
	);
}

export default function CommunityPostDetail() {
	const { postId } = useParams();
	const toast = useToast();

	const [post, setPost] =
		useState<CommunityPostDetailType | null>(null);
	const [comments, setComments] =
		useState<CommunityComment[]>([]);
	const [commentText, setCommentText] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmittingComment, setIsSubmittingComment] =
		useState(false);
	const [isLiking, setIsLiking] = useState(false);

	const loadPost = useCallback(async () => {
		if (!postId) {
			return;
		}

		try {
			setIsLoading(true);

			const [postResponse, commentResponse] =
				await Promise.all([
					api.get<CommunityPostDetailType>(
						`/community/posts/${postId}`,
					),
					api.get<CommunityComment[]>(
						`/community/posts/${postId}/comments`,
					),
				]);

			setPost(postResponse.data);
			setComments(commentResponse.data);
		} catch (error) {
			console.error("게시글 조회 실패:", error);

			toast({
				title: "게시글을 불러오지 못했습니다.",
				status: "error",
				duration: 3000,
			});
		} finally {
			setIsLoading(false);
		}
	}, [postId, toast]);

	useEffect(() => {
		void loadPost();
	}, [loadPost]);

	const toggleLike = async () => {
		if (!postId || !post) {
			return;
		}

		try {
			setIsLiking(true);

			const response = await api.post<{
				liked: boolean;
				likeCount: number;
				isFeatured: boolean;
			}>(`/community/posts/${postId}/like`);

			setPost((previous) =>
				previous
					? {
							...previous,
							likeCount:
								response.data.likeCount,
							isFeatured:
								response.data.isFeatured,
						}
					: previous,
			);

			toast({
				title: response.data.liked
					? "추천했습니다."
					: "추천을 취소했습니다.",
				status: "success",
				duration: 1500,
			});
		} catch (error: any) {
			toast({
				title: "추천 처리 실패",
				description:
					error?.response?.data?.message ||
					"로그인이 필요할 수 있습니다.",
				status: "error",
				duration: 2500,
			});
		} finally {
			setIsLiking(false);
		}
	};

	const submitComment = async () => {
		if (!postId || commentText.trim().length < 2) {
			toast({
				title: "댓글을 2자 이상 입력하세요.",
				status: "warning",
				duration: 2000,
			});
			return;
		}

		try {
			setIsSubmittingComment(true);

			const response =
				await api.post<CommunityComment>(
					`/community/posts/${postId}/comments`,
					{
						content: commentText.trim(),
					},
				);

			setComments((previous) => [
				...previous,
				response.data,
			]);
			setCommentText("");

			setPost((previous) =>
				previous
					? {
							...previous,
							commentCount:
								previous.commentCount + 1,
						}
					: previous,
			);
		} catch (error: any) {
			toast({
				title: "댓글 등록 실패",
				description:
					error?.response?.data?.message ||
					"로그인 상태를 확인하세요.",
				status: "error",
				duration: 2500,
			});
		} finally {
			setIsSubmittingComment(false);
		}
	};

	if (isLoading) {
		return (
			<Box
				maxW="1080px"
				mx="auto"
				px="20px"
				py="30px"
			>
				<Stack spacing="3">
					<Skeleton h="46px" />
					<Skeleton h="320px" />
					<Skeleton h="160px" />
				</Stack>
			</Box>
		);
	}

	if (!post) {
		return (
			<Flex
				minH="60vh"
				align="center"
				justify="center"
			>
				<Stack align="center">
					<Text fontWeight="900">
						게시글을 찾을 수 없습니다.
					</Text>
					<Button
						as={RouterLink}
						to="/community"
						leftIcon={<ArrowBackIcon />}
					>
						목록으로
					</Button>
				</Stack>
			</Flex>
		);
	}

	return (
		<Box minH="calc(100vh - 72px)" bg="#F4F5F7">
			<Box
				maxW="1080px"
				mx="auto"
				px={{ base: "10px", md: "20px" }}
				py={{ base: "18px", md: "28px" }}
			>
				<Card
					borderRadius="0"
					borderWidth="1px"
					borderColor="gray.300"
					boxShadow="none"
				>
					<CardBody p="0">
						<Flex
							px="14px"
							py="10px"
							align="center"
							justify="space-between"
							bg="gray.50"
							borderBottomWidth="1px"
							borderColor="gray.300"
						>
							<Button
								as={RouterLink}
								to="/community"
								size="xs"
								borderRadius="0"
								leftIcon={<ArrowBackIcon />}
							>
								목록
							</Button>

							<HStack spacing="2">
								<Badge colorScheme="gray">
									{post.scope === "division"
										? post.divisionName
										: "전체"}
								</Badge>
								<Badge colorScheme="pink">
									{post.category}
								</Badge>
								{post.isFeatured && (
									<Badge colorScheme="purple">
										추천글
									</Badge>
								)}
							</HStack>
						</Flex>

						<Box px={{ base: "14px", md: "22px" }} py="18px">
							<Heading
								size="md"
								lineHeight="1.5"
								wordBreak="break-word"
							>
								{post.title}
							</Heading>

							<Flex
								mt="10px"
								align={{ base: "flex-start", md: "center" }}
								justify="space-between"
								direction={{ base: "column", md: "row" }}
								gap="2"
							>
								<Author
									nickname={post.authorNickname}
									code={post.authorCode}
								/>

								<HStack
									spacing="3"
									fontSize="11px"
									color="gray.500"
								>
									<Text>
										{formatDateTime(post.createdAt)}
									</Text>
									<Text>조회 {post.viewCount}</Text>
									<Text>추천 {post.likeCount}</Text>
									<Text>댓글 {post.commentCount}</Text>
								</HStack>
							</Flex>

							<Divider my="16px" />

							<Text
								minH="280px"
								whiteSpace="pre-wrap"
								wordBreak="break-word"
								fontSize="14px"
								lineHeight="1.9"
								color="gray.800"
							>
								{post.content}
							</Text>

							{post.tags.length > 0 && (
								<HStack
									mt="20px"
									spacing="2"
									wrap="wrap"
								>
									{post.tags.map((tag) => (
										<Text
											key={tag}
											fontSize="12px"
											color="blue.600"
										>
											#{tag}
										</Text>
									))}
								</HStack>
							)}

							<Flex mt="26px" justify="center">
								<Button
									leftIcon={<StarIcon />}
									borderRadius="0"
									colorScheme="pink"
									variant="outline"
									isLoading={isLiking}
									onClick={toggleLike}
								>
									추천 {post.likeCount}
								</Button>
							</Flex>
						</Box>
					</CardBody>
				</Card>

				<Card
					mt="12px"
					borderRadius="0"
					borderWidth="1px"
					borderColor="gray.300"
					boxShadow="none"
				>
					<CardBody p="0">
						<Box
							px="14px"
							py="10px"
							bg="gray.50"
							borderBottomWidth="1px"
							borderColor="gray.300"
						>
							<Text fontSize="13px" fontWeight="900">
								댓글 {comments.length}
							</Text>
						</Box>

						{comments.length === 0 ? (
							<Flex
								minH="100px"
								align="center"
								justify="center"
							>
								<Text fontSize="13px" color="gray.500">
									첫 댓글을 작성해 보세요.
								</Text>
							</Flex>
						) : (
							<Stack spacing="0">
								{comments.map((comment) => (
									<Box
										key={comment.id}
										px={{ base: "12px", md: "16px" }}
										py="12px"
										borderBottomWidth="1px"
										borderColor="gray.200"
									>
										<Flex
											align="center"
											justify="space-between"
										>
											<Author
												nickname={
													comment.authorNickname
												}
												code={comment.authorCode}
												isPostAuthor={
													comment.isPostAuthor
												}
											/>

											<Text
												fontSize="10px"
												color="gray.400"
											>
												{formatDateTime(
													comment.createdAt,
												)}
											</Text>
										</Flex>

										<Text
											mt="7px"
											fontSize="13px"
											lineHeight="1.7"
											whiteSpace="pre-wrap"
										>
											{comment.content}
										</Text>
									</Box>
								))}
							</Stack>
						)}

						<Box p="12px" bg="gray.50">
							<Textarea
								value={commentText}
								minH="90px"
								maxLength={1000}
								borderRadius="0"
								bg="white"
								placeholder="댓글을 입력하세요."
								onChange={(event) =>
									setCommentText(event.target.value)
								}
							/>

							<Flex mt="8px" justify="flex-end">
								<Button
									size="sm"
									borderRadius="0"
									colorScheme="pink"
									isLoading={isSubmittingComment}
									onClick={submitComment}
								>
									댓글 등록
								</Button>
							</Flex>
						</Box>
					</CardBody>
				</Card>
			</Box>
		</Box>
	);
}
