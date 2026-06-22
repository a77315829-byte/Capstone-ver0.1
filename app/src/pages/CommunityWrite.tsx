import React, {
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Card,
	CardBody,
	FormControl,
	FormLabel,
	Heading,
	HStack,
	Input,
	Select,
	Stack,
	Text,
	Textarea,
	useToast,
} from "@chakra-ui/react";
import {
	useNavigate,
	useSearchParams,
} from "react-router-dom";

import api from "../services/api.service";
import {
	COMMUNITY_CATEGORIES,
} from "../data/community.constants";
import type {
	CommunityCategory,
	CommunityPostDetail,
	CommunityProfile,
	CommunityScope,
} from "../types/community.types";

export default function CommunityWrite() {
	const toast = useToast();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const initialScope: CommunityScope =
		searchParams.get("scope") === "division"
			? "division"
			: "global";

	const [profile, setProfile] =
		useState<CommunityProfile | null>(null);
	const [scope, setScope] =
		useState<CommunityScope>(initialScope);
	const [category, setCategory] =
		useState<Exclude<CommunityCategory, "전체">>(
			"주식·ETF",
		);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [tagsText, setTagsText] = useState("");
	const [isSubmitting, setIsSubmitting] =
		useState(false);

	useEffect(() => {
		const loadProfile = async () => {
			try {
				const response =
					await api.get<CommunityProfile>(
						"/community/profile",
					);
				setProfile(response.data);
			} catch (error) {
				console.error("프로필 조회 실패:", error);
			}
		};

		void loadProfile();
	}, []);

	const tags = useMemo(
		() =>
			tagsText
				.split(",")
				.map((tag) => tag.trim().replace(/^#/, ""))
				.filter(Boolean)
				.slice(0, 5),
		[tagsText],
	);

	const submit = async () => {
		if (title.trim().length < 2) {
			toast({
				title: "제목을 2자 이상 입력하세요.",
				status: "warning",
				duration: 2500,
			});
			return;
		}

		if (content.trim().length < 5) {
			toast({
				title: "내용을 5자 이상 입력하세요.",
				status: "warning",
				duration: 2500,
			});
			return;
		}

		if (scope === "division" && !profile?.divisionCode) {
			toast({
				title: "사단 설정이 필요합니다.",
				description:
					"커뮤니티 메인에서 사단을 먼저 설정하세요.",
				status: "warning",
				duration: 3000,
			});
			return;
		}

		try {
			setIsSubmitting(true);

			const response =
				await api.post<CommunityPostDetail>(
					"/community/posts",
					{
						scope,
						category,
						title: title.trim(),
						content: content.trim(),
						tags,
					},
				);

			toast({
				title: "게시글을 등록했습니다.",
				status: "success",
				duration: 2000,
			});

			navigate(`/community/${response.data.id}`);
		} catch (error: any) {
			toast({
				title: "게시글 등록 실패",
				description:
					error?.response?.data?.message ||
					"로그인 상태와 입력값을 확인하세요.",
				status: "error",
				duration: 3500,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Box minH="calc(100vh - 72px)" bg="#F4F5F7">
			<Box
				maxW="960px"
				mx="auto"
				px={{ base: "12px", md: "20px" }}
				py={{ base: "18px", md: "28px" }}
			>
				<Card
					borderRadius="0"
					borderWidth="1px"
					borderColor="gray.300"
					boxShadow="none"
				>
					<CardBody p={{ base: "18px", md: "26px" }}>
						<Stack spacing="5">
							<Box>
								<Heading size="md">
									게시글 작성
								</Heading>
								<Text
									mt="1"
									fontSize="13px"
									color="gray.500"
								>
									작성자는{" "}
									<strong>
										{profile?.nickname || "ㅇㅇ"}
									</strong>
									와 가상 식별코드로 표시됩니다.
								</Text>
							</Box>

							<Alert
								status="warning"
								borderRadius="0"
								alignItems="flex-start"
							>
								<AlertIcon mt="2px" />
								<AlertDescription
									fontSize="13px"
									lineHeight="1.7"
								>
									부대 위치, 중대·소대, 인원, 훈련일정,
									근무시간, 이동계획, 실명, 군번 등 군 관련
									민감정보를 작성하지 마세요.
								</AlertDescription>
							</Alert>

							<HStack
								align="flex-end"
								spacing="4"
								flexWrap="wrap"
							>
								<FormControl
									w={{ base: "100%", md: "220px" }}
								>
									<FormLabel fontWeight="800">
										게시판
									</FormLabel>
									<Select
										value={scope}
										borderRadius="0"
										onChange={(event) =>
											setScope(
												event.target
													.value as CommunityScope,
											)
										}
									>
										<option value="global">
											전체 게시판
										</option>
										<option
											value="division"
											disabled={
												!profile?.divisionCode
											}
										>
											{profile?.divisionName
												? `${profile.divisionName} 라운지`
												: "사단 미설정"}
										</option>
									</Select>
								</FormControl>

								<FormControl
									w={{ base: "100%", md: "220px" }}
								>
									<FormLabel fontWeight="800">
										카테고리
									</FormLabel>
									<Select
										value={category}
										borderRadius="0"
										onChange={(event) =>
											setCategory(
												event.target
													.value as Exclude<
													CommunityCategory,
													"전체"
												>,
											)
										}
									>
										{COMMUNITY_CATEGORIES.filter(
											(item) => item !== "전체",
										).map((item) => (
											<option
												key={item}
												value={item}
											>
												{item}
											</option>
										))}
									</Select>
								</FormControl>
							</HStack>

							<FormControl>
								<FormLabel fontWeight="800">
									제목
								</FormLabel>
								<Input
									value={title}
									maxLength={80}
									borderRadius="0"
									placeholder="제목을 입력하세요."
									onChange={(event) =>
										setTitle(event.target.value)
									}
								/>
								<Text
									mt="1"
									textAlign="right"
									fontSize="11px"
									color="gray.500"
								>
									{title.length}/80
								</Text>
							</FormControl>

							<FormControl>
								<FormLabel fontWeight="800">
									내용
								</FormLabel>
								<Textarea
									value={content}
									minH="320px"
									maxLength={5000}
									resize="vertical"
									borderRadius="0"
									placeholder="금융 질문이나 경험을 작성하세요."
									onChange={(event) =>
										setContent(event.target.value)
									}
								/>
								<Text
									mt="1"
									textAlign="right"
									fontSize="11px"
									color="gray.500"
								>
									{content.length}/5000
								</Text>
							</FormControl>

							<FormControl>
								<FormLabel fontWeight="800">
									태그
								</FormLabel>
								<Input
									value={tagsText}
									borderRadius="0"
									placeholder="ETF, 전역자금, 비상금처럼 쉼표로 구분"
									onChange={(event) =>
										setTagsText(
											event.target.value,
										)
									}
								/>

								{tags.length > 0 && (
									<HStack
										mt="2"
										spacing="2"
										wrap="wrap"
									>
										{tags.map((tag) => (
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
							</FormControl>

							<HStack justify="flex-end">
								<Button
									borderRadius="0"
									variant="outline"
									onClick={() => navigate(-1)}
								>
									취소
								</Button>

								<Button
									borderRadius="0"
									colorScheme="pink"
									isLoading={isSubmitting}
									loadingText="등록 중"
									onClick={submit}
								>
									게시하기
								</Button>
							</HStack>
						</Stack>
					</CardBody>
				</Card>
			</Box>
		</Box>
	);
}
