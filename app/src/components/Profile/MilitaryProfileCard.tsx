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
	CardHeader,
	Flex,
	FormControl,
	FormHelperText,
	FormLabel,
	Grid,
	GridItem,
	Heading,
	HStack,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	Select,
	SimpleGrid,
	Skeleton,
	Stack,
	Stat,
	StatLabel,
	StatNumber,
	Text,
	useDisclosure,
	useToast,
} from "@chakra-ui/react";
import {
	CalendarIcon,
	EditIcon,
} from "@chakra-ui/icons";

import api from "../../services/api.service";
import {
	BRANCH_LABEL,
	MILITARY_BRANCH_OPTIONS,
	MILITARY_RANK_MODE_OPTIONS,
	MILITARY_RANK_OPTIONS,
	RANK_LABEL,
	RANK_MODE_LABEL,
} from "../../data/military.constants";
import type {
	DischargeDateSource,
	MilitaryBranch,
	MilitaryProfile,
	MilitaryProfileResponse,
	MilitaryRank,
	MilitaryRankMode,
	SaveMilitaryProfileRequest,
} from "../../types/militaryProfile.types";

interface MilitaryProfileFormState {
	branch: MilitaryBranch;

	enlistmentDate: string;
	dischargeDate: string;
	dischargeDateSource: DischargeDateSource;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;
}

const DEFAULT_FORM: MilitaryProfileFormState = {
	branch: "ARMY",

	enlistmentDate: "",
	dischargeDate: "",
	dischargeDateSource: "AUTO",

	selectedRank: "PRIVATE",
	rankMode: "AUTO",
};

function formatDate(value: string | null): string {
	if (!value) {
		return "-";
	}

	const date = new Date(`${value}T00:00:00`);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function calculateDischargeDate(
	enlistmentDate: string,
	serviceMonths: number | undefined,
): string {
	if (
		!serviceMonths ||
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(
			enlistmentDate,
		)
	) {
		return "";
	}

	const result = new Date(
		`${enlistmentDate}T00:00:00.000Z`,
	);

	if (Number.isNaN(result.getTime())) {
		return "";
	}

	const originalDay = result.getUTCDate();

	result.setUTCDate(1);
	result.setUTCMonth(
		result.getUTCMonth() + serviceMonths,
	);

	const lastDayOfTargetMonth =
		new Date(
			Date.UTC(
				result.getUTCFullYear(),
				result.getUTCMonth() + 1,
				0,
			),
		).getUTCDate();

	result.setUTCDate(
		Math.min(
			originalDay,
			lastDayOfTargetMonth,
		),
	);

	result.setUTCDate(result.getUTCDate() - 1);

	return result.toISOString().slice(0, 10);
}

function makeForm(
	profile: MilitaryProfile | null,
): MilitaryProfileFormState {
	if (!profile) {
		return DEFAULT_FORM;
	}

	return {
		branch: profile.branch,

		enlistmentDate:
			profile.enlistmentDate,
		dischargeDate:
			profile.dischargeDate,
		dischargeDateSource:
			profile.dischargeDateSource ??
			"MANUAL",

		selectedRank:
			profile.selectedRank,
		rankMode:
			profile.rankMode,
	};
}

export default function MilitaryProfileCard() {
	const toast = useToast();
	const modal = useDisclosure();

	const [profile, setProfile] =
		useState<MilitaryProfile | null>(null);
	const [isLoading, setIsLoading] =
		useState(true);
	const [isSaving, setIsSaving] =
		useState(false);
	const [form, setForm] =
		useState<MilitaryProfileFormState>(
			DEFAULT_FORM,
		);
	const [
		serviceMonthsByBranch,
		setServiceMonthsByBranch,
	] = useState<
		Partial<Record<MilitaryBranch, number>>
	>({});

	const loadProfile = useCallback(async () => {
		try {
			setIsLoading(true);

			const response =
				await api.get<MilitaryProfileResponse>(
					"/user/military-profile",
				);

			const loadedProfile =
				response.data.profile ?? null;

			setServiceMonthsByBranch(
				response.data.serviceMonthsByBranch ??
					{},
			);
			setProfile(loadedProfile);
			setForm(makeForm(loadedProfile));
		} catch (error: any) {
			console.error(
				"군 프로필 조회 실패:",
				error,
			);

			if (error?.response?.status !== 401) {
				toast({
					title:
						"군 프로필을 불러오지 못했습니다.",
					description:
						error?.response?.data?.message ??
						"서버 연결 상태를 확인하세요.",
					status: "error",
					duration: 3000,
					isClosable: true,
				});
			}
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		void loadProfile();
	}, [loadProfile]);

	const openEditor = () => {
		setForm(makeForm(profile));
		modal.onOpen();
	};

	const handleBranchChange = (
		branch: MilitaryBranch,
	) => {
		setForm((previous) => {
			const serviceMonths =
				serviceMonthsByBranch[branch];

			const shouldKeepManualDate =
				previous.dischargeDateSource ===
				"MANUAL";

			return {
				...previous,
				branch,
				dischargeDate:
					shouldKeepManualDate
						? previous.dischargeDate
						: calculateDischargeDate(
								previous.enlistmentDate,
								serviceMonths,
							),
				dischargeDateSource:
					shouldKeepManualDate ||
					!serviceMonths
						? "MANUAL"
						: "AUTO",
			};
		});
	};

	const handleEnlistmentDateChange = (
		enlistmentDate: string,
	) => {
		setForm((previous) => {
			if (
				previous.dischargeDateSource ===
				"MANUAL"
			) {
				return {
					...previous,
					enlistmentDate,
				};
			}

			const serviceMonths =
				serviceMonthsByBranch[
					previous.branch
				];

			return {
				...previous,
				enlistmentDate,
				dischargeDate:
					calculateDischargeDate(
						enlistmentDate,
						serviceMonths,
					),
				dischargeDateSource:
					serviceMonths
						? "AUTO"
						: "MANUAL",
			};
		});
	};

	const enableManualDischargeDate = () => {
		setForm((previous) => ({
			...previous,
			dischargeDateSource: "MANUAL",
		}));
	};

	const enableAutomaticDischargeDate = () => {
		const serviceMonths =
			serviceMonthsByBranch[form.branch];

		if (!serviceMonths) {
			toast({
				title:
					"이 군종은 자동 계산을 지원하지 않습니다.",
				description:
					"전역 예정일을 직접 입력하세요.",
				status: "warning",
				duration: 2600,
			});
			return;
		}

		if (!form.enlistmentDate) {
			toast({
				title: "입대일을 먼저 선택하세요.",
				status: "warning",
				duration: 2200,
			});
			return;
		}

		setForm((previous) => ({
			...previous,
			dischargeDate:
				calculateDischargeDate(
					previous.enlistmentDate,
					serviceMonths,
				),
			dischargeDateSource: "AUTO",
		}));
	};

	const saveProfile = async () => {
		if (!form.enlistmentDate) {
			toast({
				title: "입대일을 선택하세요.",
				status: "warning",
				duration: 2200,
			});
			return;
		}

		if (!form.dischargeDate) {
			toast({
				title: "전역일을 선택하세요.",
				status: "warning",
				duration: 2200,
			});
			return;
		}

		const enlistment =
			new Date(`${form.enlistmentDate}T00:00:00`);
		const discharge =
			new Date(`${form.dischargeDate}T00:00:00`);

		if (
			Number.isNaN(enlistment.getTime()) ||
			Number.isNaN(discharge.getTime()) ||
			discharge <= enlistment
		) {
			toast({
				title:
					"전역일은 입대일보다 뒤여야 합니다.",
				status: "warning",
				duration: 2500,
			});
			return;
		}

		const body: SaveMilitaryProfileRequest = {
			branch: form.branch,

			enlistmentDate:
				form.enlistmentDate,
			dischargeDate:
				form.dischargeDate,
			dischargeDateSource:
				form.dischargeDateSource,

			selectedRank:
				form.selectedRank,
			rankMode:
				form.rankMode,
		};

		try {
			setIsSaving(true);

			const response =
				await api.put<MilitaryProfile>(
					"/user/military-profile",
					body,
				);

			setProfile(response.data);
			setForm(makeForm(response.data));
			modal.onClose();

			toast({
				title: "군 프로필을 저장했습니다.",
				description:
					"군종과 복무 정보가 사용자 계정에 저장되었습니다.",
				status: "success",
				duration: 2600,
				isClosable: true,
			});
		} catch (error: any) {
			toast({
				title: "군 프로필 저장 실패",
				description:
					error?.response?.data?.message ??
					"입력값과 로그인 상태를 확인하세요.",
				status: "error",
				duration: 3200,
				isClosable: true,
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<Skeleton
				h="238px"
				borderRadius="12px"
				mb="5"
			/>
		);
	}

	if (!profile) {
		return (
			<>
				<Card mb="5">
					<CardBody py="9">
						<Stack
							align="center"
							spacing="3"
						>
							<CalendarIcon
								boxSize="24px"
								color="purple.500"
							/>

							<Heading size="sm">
								군 프로필 설정이 필요합니다.
							</Heading>

							<Text
								maxW="620px"
								textAlign="center"
								fontSize="sm"
								color="gray.500"
							>
								군종과 입대일을 저장하면
								복무기간 기준 전역 예정일과
								예상 계급, 전역 D-Day를
								표시합니다.
							</Text>

							<Button
								colorScheme="purple"
								leftIcon={<EditIcon />}
								onClick={openEditor}
							>
								군 프로필 설정
							</Button>
						</Stack>
					</CardBody>
				</Card>

				<MilitaryProfileModal
					isOpen={modal.isOpen}
					onClose={modal.onClose}
					form={form}
					setForm={setForm}
					onBranchChange={
						handleBranchChange
					}
					onEnlistmentDateChange={
						handleEnlistmentDateChange
					}
					onEnableManualDischargeDate={
						enableManualDischargeDate
					}
					onEnableAutomaticDischargeDate={
						enableAutomaticDischargeDate
					}
					serviceMonths={
						serviceMonthsByBranch[
							form.branch
						]
					}
					isSaving={isSaving}
					onSave={saveProfile}
				/>
			</>
		);
	}

	return (
		<>
			<Card mb="5">
				<CardHeader pb="2">
					<Flex
						align={{
							base: "flex-start",
							md: "center",
						}}
						direction={{
							base: "column",
							md: "row",
						}}
						gap="3"
					>
						<Box>
							<HStack
								spacing="2"
								wrap="wrap"
							>
								<Heading size="md">
									군 프로필
								</Heading>

								<Badge colorScheme="purple">
									{RANK_MODE_LABEL[
										profile.rankMode
									]}
								</Badge>

								{profile.isDischarged && (
									<Badge colorScheme="green">
										전역 완료
									</Badge>
								)}
							</HStack>

							<Text
								mt="1"
								fontSize="sm"
								color="gray.500"
							>
								{BRANCH_LABEL[
									profile.branch
								]}
							</Text>
						</Box>

						<Box flex="1" />

						<Button
							size="sm"
							variant="outline"
							leftIcon={<EditIcon />}
							onClick={openEditor}
						>
							수정
						</Button>
					</Flex>
				</CardHeader>

				<CardBody pt="3">
					<SimpleGrid
						columns={{
							base: 1,
							sm: 2,
							lg: 4,
						}}
						spacing="4"
					>
						<Stat>
							<StatLabel>
								현재 표시 계급
							</StatLabel>
							<StatNumber>
								{RANK_LABEL[
									profile.displayRank
								]}
							</StatNumber>
							<Text
								mt="1"
								fontSize="xs"
								color="gray.500"
							>
								{profile.rankMode ===
								"AUTO"
									? "입대일 기준 예상 계급"
									: "사용자 직접 설정"}
							</Text>
						</Stat>

						<Stat>
							<StatLabel>
								전역일까지
							</StatLabel>
							<StatNumber>
								{profile.isDischarged
									? "전역 완료"
									: `D-${profile.daysUntilDischarge}`}
							</StatNumber>
							<Text
								mt="1"
								fontSize="xs"
								color="gray.500"
							>
								{formatDate(
									profile.dischargeDate,
								)}
							</Text>
							<Text
								mt="1"
								fontSize="xs"
								color="gray.500"
							>
								{profile.dischargeDateSource ===
								"AUTO"
									? "군종·입대일 기준 자동 계산"
									: "사용자 직접 입력"}
							</Text>
						</Stat>

						<Stat>
							<StatLabel>
								다음 예상 진급
							</StatLabel>
							<StatNumber fontSize="xl">
								{profile.nextPromotionRank
									? RANK_LABEL[
											profile
												.nextPromotionRank
										]
									: "-"}
							</StatNumber>
							<Text
								mt="1"
								fontSize="xs"
								color="gray.500"
							>
								{formatDate(
									profile.nextPromotionDate,
								)}
							</Text>
						</Stat>

						<Stat>
							<StatLabel>
								복무 진행률
							</StatLabel>
							<StatNumber>
								{profile.serviceProgress.toFixed(
									1,
								)}
								%
							</StatNumber>
							<Text
								mt="1"
								fontSize="xs"
								color="gray.500"
							>
								입대{" "}
								{formatDate(
									profile.enlistmentDate,
								)}
							</Text>
						</Stat>
					</SimpleGrid>

					<Box mt="5">
						<Flex
							mb="2"
							justify="space-between"
						>
							<Text
								fontSize="xs"
								color="gray.500"
							>
								복무 시작
							</Text>
							<Text
								fontSize="xs"
								color="gray.500"
							>
								전역
							</Text>
						</Flex>

						<Progress
							value={
								profile.serviceProgress
							}
							colorScheme="purple"
							borderRadius="full"
							size="sm"
						/>
					</Box>

					{profile.rankMode === "AUTO" &&
						profile.selectedRank !==
							profile.calculatedRank && (
							<Box
								mt="4"
								p="3"
								borderWidth="1px"
								borderColor="orange.200"
								bg="orange.50"
							>
								<Text
									fontSize="sm"
									color="orange.800"
								>
									저장된 선택 계급은{" "}
									<strong>
										{RANK_LABEL[
											profile
												.selectedRank
										]}
									</strong>
									이고 날짜 기준 예상
									계급은{" "}
									<strong>
										{RANK_LABEL[
											profile
												.calculatedRank
										]}
									</strong>
									입니다. 실제 계급과
									다르면 직접 설정
									모드로 변경하세요.
								</Text>
							</Box>
						)}
				</CardBody>
			</Card>

			<MilitaryProfileModal
				isOpen={modal.isOpen}
				onClose={modal.onClose}
				form={form}
				setForm={setForm}
				onBranchChange={
					handleBranchChange
				}
				onEnlistmentDateChange={
					handleEnlistmentDateChange
				}
				onEnableManualDischargeDate={
					enableManualDischargeDate
				}
				onEnableAutomaticDischargeDate={
					enableAutomaticDischargeDate
				}
				serviceMonths={
					serviceMonthsByBranch[
						form.branch
					]
				}
				isSaving={isSaving}
				onSave={saveProfile}
			/>
		</>
	);
}

function MilitaryProfileModal({
	isOpen,
	onClose,
	form,
	setForm,
	onBranchChange,
	onEnlistmentDateChange,
	onEnableManualDischargeDate,
	onEnableAutomaticDischargeDate,
	serviceMonths,
	isSaving,
	onSave,
}: {
	isOpen: boolean;
	onClose: () => void;
	form: MilitaryProfileFormState;
	setForm: React.Dispatch<
		React.SetStateAction<MilitaryProfileFormState>
	>;
	onBranchChange: (
		branch: MilitaryBranch,
	) => void;
	onEnlistmentDateChange: (
		enlistmentDate: string,
	) => void;
	onEnableManualDischargeDate: () => void;
	onEnableAutomaticDischargeDate: () => void;
	serviceMonths: number | undefined;
	isSaving: boolean;
	onSave: () => void;
}) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			size="xl"
			isCentered
		>
			<ModalOverlay />

			<ModalContent>
				<ModalHeader>
					군 프로필 설정
				</ModalHeader>
				<ModalCloseButton />

				<ModalBody>
					<Stack spacing="5">
						<Grid
							templateColumns={{
								base: "1fr",
								md: "1fr 1fr",
							}}
							gap="4"
						>
							<GridItem>
								<FormControl isRequired>
									<FormLabel>
										군종
									</FormLabel>
									<Select
										value={form.branch}
										onChange={(event) =>
											onBranchChange(
												event
													.target
													.value as MilitaryBranch,
											)
										}
									>
										{MILITARY_BRANCH_OPTIONS.map(
											(option) => (
												<option
													key={
														option.value
													}
													value={
														option.value
													}
												>
													{
														option.label
													}
												</option>
											),
										)}
									</Select>
								</FormControl>
							</GridItem>

							<GridItem>
								<FormControl isRequired>
									<FormLabel>
										입대일
									</FormLabel>
									<Input
										type="date"
										value={
											form.enlistmentDate
										}
										onChange={(event) =>
											onEnlistmentDateChange(
												event.target.value,
											)
										}
									/>
									<FormHelperText>
										자동 계산 상태에서는
										입대일을 바꾸면 전역
										예정일도 다시 계산됩니다.
									</FormHelperText>
								</FormControl>
							</GridItem>

							<GridItem>
								<FormControl isRequired>
									<Flex
										align="center"
										justify="space-between"
										mb="2"
									>
										<FormLabel mb="0">
											전역 예정일
										</FormLabel>
										<Badge
											colorScheme={
												form.dischargeDateSource ===
												"AUTO"
													? "purple"
													: "orange"
											}
										>
											{form.dischargeDateSource ===
											"AUTO"
												? "자동 계산"
												: "직접 입력"}
										</Badge>
									</Flex>

									<Input
										type="date"
										value={
											form.dischargeDate
										}
										isReadOnly={
											form.dischargeDateSource ===
											"AUTO"
										}
										bg={
											form.dischargeDateSource ===
											"AUTO"
												? "gray.50"
												: undefined
										}
										onChange={(event) =>
											setForm(
												(previous) => ({
													...previous,
													dischargeDate:
														event.target.value,
													dischargeDateSource:
														"MANUAL",
												}),
											)
										}
									/>

									<Button
										mt="2"
										size="xs"
										variant="outline"
										onClick={
											form.dischargeDateSource ===
											"AUTO"
												? onEnableManualDischargeDate
												: onEnableAutomaticDischargeDate
										}
									>
										{form.dischargeDateSource ===
										"AUTO"
											? "전역일 직접 수정"
											: "자동 계산으로 전환"}
									</Button>

									<FormHelperText>
										{form.dischargeDateSource ===
										"AUTO"
											? serviceMonths
												? `${serviceMonths}개월 복무기간을 기준으로 자동 계산합니다.`
												: "이 군종은 자동 계산을 지원하지 않습니다."
											: "직접 수정한 날짜는 입대일을 바꿔도 자동으로 덮어쓰지 않습니다."}
									</FormHelperText>
								</FormControl>
							</GridItem>

							<GridItem>
								<FormControl isRequired>
									<FormLabel>
										현재 선택 계급
									</FormLabel>
									<Select
										value={
											form.selectedRank
										}
										onChange={(event) =>
											setForm(
												(previous) => ({
													...previous,
													selectedRank:
														event
															.target
															.value as MilitaryRank,
												}),
											)
										}
									>
										{MILITARY_RANK_OPTIONS.map(
											(option) => (
												<option
													key={
														option.value
													}
													value={
														option.value
													}
												>
													{
														option.label
													}
												</option>
											),
										)}
									</Select>
								</FormControl>
							</GridItem>

							<GridItem>
								<FormControl isRequired>
									<FormLabel>
										계급 표시 방식
									</FormLabel>
									<Select
										value={form.rankMode}
										onChange={(event) =>
											setForm(
												(previous) => ({
													...previous,
													rankMode:
														event
															.target
															.value as MilitaryRankMode,
												}),
											)
										}
									>
										{MILITARY_RANK_MODE_OPTIONS.map(
											(option) => (
												<option
													key={
														option.value
													}
													value={
														option.value
													}
												>
													{
														option.label
													}
												</option>
											),
										)}
									</Select>
								</FormControl>
							</GridItem>
						</Grid>

						<Box
							p="4"
							bg="gray.50"
							borderWidth="1px"
							borderColor="gray.200"
						>
							<Text
								fontSize="sm"
								fontWeight="800"
							>
								{
									MILITARY_RANK_MODE_OPTIONS.find(
										(option) =>
											option.value ===
											form.rankMode,
									)?.label
								}
							</Text>
							<Text
								mt="1"
								fontSize="sm"
								color="gray.600"
							>
								{
									MILITARY_RANK_MODE_OPTIONS.find(
										(option) =>
											option.value ===
											form.rankMode,
									)?.description
								}
							</Text>
						</Box>

						<Text
							fontSize="xs"
							color="gray.500"
							lineHeight="1.7"
						>
							자동 계급은 앱이 계산한
							예상값입니다. 실제 진급일과
							다를 수 있으므로 필요한 경우
							직접 설정 모드를 사용하세요.
						</Text>
					</Stack>
				</ModalBody>

				<ModalFooter>
					<Button
						mr="2"
						variant="ghost"
						onClick={onClose}
					>
						취소
					</Button>
					<Button
						colorScheme="purple"
						isLoading={isSaving}
						loadingText="저장 중"
						onClick={onSave}
					>
						저장
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}
