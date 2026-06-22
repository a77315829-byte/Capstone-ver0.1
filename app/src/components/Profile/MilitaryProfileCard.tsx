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
	getPublicUnitOptions,
	getUnitTypeOptions,
	isUnitTypeAllowed,
	MILITARY_BRANCH_OPTIONS,
	MILITARY_RANK_MODE_OPTIONS,
	MILITARY_RANK_OPTIONS,
	RANK_LABEL,
	RANK_MODE_LABEL,
	UNIT_TYPE_LABEL,
} from "../../data/military.constants";
import type {
	MilitaryBranch,
	MilitaryProfile,
	MilitaryProfileResponse,
	MilitaryRank,
	MilitaryRankMode,
	MilitaryUnitType,
	SaveMilitaryProfileRequest,
} from "../../types/militaryProfile.types";

interface MilitaryProfileFormState {
	branch: MilitaryBranch;

	unitType: MilitaryUnitType | "";
	unitCode: string;
	unitName: string;

	enlistmentDate: string;
	dischargeDate: string;

	selectedRank: MilitaryRank;
	rankMode: MilitaryRankMode;
}

const DEFAULT_FORM: MilitaryProfileFormState = {
	branch: "ARMY",

	unitType: "",
	unitCode: "",
	unitName: "",

	enlistmentDate: "",
	dischargeDate: "",

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

function makeForm(
	profile: MilitaryProfile | null,
): MilitaryProfileFormState {
	if (!profile) {
		return DEFAULT_FORM;
	}

	return {
		branch: profile.branch,

		unitType:
			profile.unitType ?? "",
		unitCode:
			profile.unitCode ?? "",
		unitName:
			profile.unitName ?? "",

		enlistmentDate:
			profile.enlistmentDate,
		dischargeDate:
			profile.dischargeDate,

		selectedRank:
			profile.selectedRank,
		rankMode:
			profile.rankMode,
	};
}

function getUnitDisplayName(
	profile: MilitaryProfile,
): string {
	const typeLabel = profile.unitType
		? UNIT_TYPE_LABEL[profile.unitType]
		: null;

	if (profile.unitName && typeLabel) {
		return `${typeLabel} · ${profile.unitName}`;
	}

	if (profile.unitName) {
		return profile.unitName;
	}

	if (typeLabel) {
		return typeLabel;
	}

	return "상위 부대 미설정";
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

	const loadProfile = useCallback(async () => {
		try {
			setIsLoading(true);

			const response =
				await api.get<MilitaryProfileResponse>(
					"/user/military-profile",
				);

			const loadedProfile =
				response.data.profile ?? null;

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

	const unitTypeOptions = useMemo(
		() =>
			getUnitTypeOptions(
				form.branch,
			),
		[form.branch],
	);

	const publicUnitOptions = useMemo(
		() =>
			getPublicUnitOptions(
				form.branch,
				form.unitType || null,
			),
		[
			form.branch,
			form.unitType,
		],
	);

	const openEditor = () => {
		setForm(makeForm(profile));
		modal.onOpen();
	};

	const handleBranchChange = (
		branch: MilitaryBranch,
	) => {
		setForm((previous) => {
			const nextUnitType =
				isUnitTypeAllowed(
					branch,
					previous.unitType || null,
				)
					? previous.unitType
					: "";

			return {
				...previous,
				branch,
				unitType: nextUnitType,
				unitCode: "",
				unitName: "",
			};
		});
	};

	const handleUnitTypeChange = (
		unitType: MilitaryUnitType | "",
	) => {
		setForm((previous) => ({
			...previous,
			unitType,
			unitCode: "",
			unitName: "",
		}));
	};

	const handlePublicUnitChange = (
		unitCode: string,
	) => {
		const selected =
			publicUnitOptions.find(
				(option) =>
					option.code === unitCode,
			);

		setForm((previous) => ({
			...previous,
			unitCode:
				selected?.code ?? "",
			unitName:
				selected?.name ?? "",
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

		if (
			form.unitType &&
			!isUnitTypeAllowed(
				form.branch,
				form.unitType,
			)
		) {
			toast({
				title:
					"해당 군종에 맞는 부대 유형을 선택하세요.",
				status: "warning",
				duration: 2600,
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

			unitType:
				form.unitType || null,
			unitCode:
				form.unitCode.trim() || null,
			unitName:
				form.unitName.trim() || null,

			enlistmentDate:
				form.enlistmentDate,
			dischargeDate:
				form.dischargeDate,

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
					"군종과 상위 부대 정보가 사용자 계정에 저장되었습니다.",
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
								군종, 상위 부대 유형,
								입대일과 전역일을
								저장하면 예상 계급과 전역
								D-Day를 표시합니다.
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
					unitTypeOptions={
						unitTypeOptions
					}
					publicUnitOptions={
						publicUnitOptions
					}
					onBranchChange={
						handleBranchChange
					}
					onUnitTypeChange={
						handleUnitTypeChange
					}
					onPublicUnitChange={
						handlePublicUnitChange
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
								{" · "}
								{getUnitDisplayName(
									profile,
								)}
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
				unitTypeOptions={
					unitTypeOptions
				}
				publicUnitOptions={
					publicUnitOptions
				}
				onBranchChange={
					handleBranchChange
				}
				onUnitTypeChange={
					handleUnitTypeChange
				}
				onPublicUnitChange={
					handlePublicUnitChange
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
	unitTypeOptions,
	publicUnitOptions,
	onBranchChange,
	onUnitTypeChange,
	onPublicUnitChange,
	isSaving,
	onSave,
}: {
	isOpen: boolean;
	onClose: () => void;
	form: MilitaryProfileFormState;
	setForm: React.Dispatch<
		React.SetStateAction<MilitaryProfileFormState>
	>;
	unitTypeOptions: Array<{
		value: MilitaryUnitType;
		label: string;
	}>;
	publicUnitOptions: Array<{
		code: string;
		name: string;
	}>;
	onBranchChange: (
		branch: MilitaryBranch,
	) => void;
	onUnitTypeChange: (
		unitType: MilitaryUnitType | "",
	) => void;
	onPublicUnitChange: (
		unitCode: string,
	) => void;
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
								<FormControl>
									<FormLabel>
										상위 부대 유형
									</FormLabel>
									<Select
										value={
											form.unitType
										}
										onChange={(event) =>
											onUnitTypeChange(
												event
													.target
													.value as
													| MilitaryUnitType
													| "",
											)
										}
									>
										<option value="">
											미설정
										</option>

										{unitTypeOptions.map(
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

									<FormHelperText>
										군종을 바꾸면 사용
										가능한 부대 유형이
										자동으로 바뀝니다.
									</FormHelperText>
								</FormControl>
							</GridItem>

							<GridItem
								colSpan={{
									base: 1,
									md: 2,
								}}
							>
								<FormControl>
									<FormLabel>
										공개 상위 부대
									</FormLabel>

									{publicUnitOptions.length >
									0 ? (
										<Select
											value={
												form.unitCode
											}
											onChange={(
												event,
											) =>
												onPublicUnitChange(
													event
														.target
														.value,
												)
											}
										>
											<option value="">
												미설정
											</option>

											{publicUnitOptions.map(
												(
													option,
												) => (
													<option
														key={
															option.code
														}
														value={
															option.code
														}
													>
														{
															option.name
														}
													</option>
												),
											)}
										</Select>
									) : (
										<Input
											value={
												form.unitName
											}
											maxLength={30}
											placeholder="예: 공개된 상위 부대명만 입력"
											onChange={(event) =>
												setForm(
													(previous) => ({
														...previous,
														unitCode:
															"",
														unitName:
															event
																.target
																.value,
													}),
												)
											}
										/>
									)}

									<FormHelperText color="orange.700">
										대대·중대·소대,
										생활관, 근무 위치,
										작전 관련 정보는
										입력하지 마세요.
									</FormHelperText>
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
											setForm(
												(previous) => ({
													...previous,
													enlistmentDate:
														event
															.target
															.value,
												}),
											)
										}
									/>
								</FormControl>
							</GridItem>

							<GridItem>
								<FormControl isRequired>
									<FormLabel>
										전역일
									</FormLabel>
									<Input
										type="date"
										value={
											form.dischargeDate
										}
										onChange={(event) =>
											setForm(
												(previous) => ({
													...previous,
													dischargeDate:
														event
															.target
															.value,
												}),
											)
										}
									/>
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
