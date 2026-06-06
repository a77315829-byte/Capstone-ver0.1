import { scenarioSeeds } from "../data/scenarios";
import Scenario from "../models/scenario.model";
import ScenarioDecision from "../models/scenarioDecision.model";

const DEFAULT_USER_ID = "demo-user";

const getUserId = (userId?: string) => userId?.trim() || DEFAULT_USER_ID;

const createServiceError = (statusCode: number, message: string) => {
	const error = new Error(message) as Error & { statusCode?: number };
	error.statusCode = statusCode;
	return error;
};

const getSeedChapters = () => {
	const chapterMap = new Map<number, any>();

	for (const scenario of scenarioSeeds) {
		if (chapterMap.has(scenario.chapterId)) continue;

		chapterMap.set(scenario.chapterId, {
			chapterId: scenario.chapterId,
			chapterSlug: scenario.chapterSlug,
			chapterTitle: scenario.chapterTitle,
			chapterDescription: scenario.chapterDescription,
			coreAttitude: scenario.coreAttitude,
			learningGoal: scenario.learningGoal,
			chapterOrder: scenario.chapterOrder,
		});
	}

	return [...chapterMap.values()].sort(
		(a, b) => a.chapterOrder - b.chapterOrder,
	);
};

export const getScenarioChapters = async (userIdInput?: string) => {
	const userId = getUserId(userIdInput);

	const scenarios = await Scenario.find({ isPublished: true })
		.sort({ chapterOrder: 1, scenarioNo: 1 })
		.lean();

	const decisions = await ScenarioDecision.find({ userId }).lean();

	const completedScenarioIds = new Set(
		decisions.map((decision) => String(decision.scenarioId)),
	);

	const chapterMap = new Map<number, any>();

	for (const scenario of scenarios) {
		if (chapterMap.has(scenario.chapterId)) continue;

		chapterMap.set(scenario.chapterId, {
			chapterId: scenario.chapterId,
			chapterSlug: scenario.chapterSlug,
			chapterTitle: scenario.chapterTitle,
			chapterDescription: scenario.chapterDescription,
			coreAttitude: scenario.coreAttitude,
			learningGoal: scenario.learningGoal,
			chapterOrder: scenario.chapterOrder,
		});
	}

	const chapters = chapterMap.size > 0 ? [...chapterMap.values()] : getSeedChapters();

	return chapters
		.sort((a, b) => a.chapterOrder - b.chapterOrder)
		.map((chapter) => {
			const chapterScenarios = scenarios.filter(
				(scenario) => scenario.chapterId === chapter.chapterId,
			);

			const completedCount = chapterScenarios.filter((scenario) =>
				completedScenarioIds.has(String(scenario._id)),
			).length;

			return {
				...chapter,
				scenarioCount: chapterScenarios.length,
				completedCount,
				progressRate:
					chapterScenarios.length > 0
						? Math.round((completedCount / chapterScenarios.length) * 100)
						: 0,
				isLocked: false,
			};
		});
};

export const getRecommendedScenarios = async () => {
	return Scenario.find({ isPublished: true })
		.sort({ chapterOrder: 1, scenarioNo: 1 })
		.limit(3)
		.select(
			"chapterId chapterTitle scenarioNo scenarioSlug title eventPeriod summary difficulty estimatedMinutes keywords",
		)
		.lean();
};

export const getScenariosByChapter = async (
	chapterIdOrSlug: string,
	userIdInput?: string,
) => {
	const userId = getUserId(userIdInput);
	const chapterIdNumber = Number(chapterIdOrSlug);

	const query = Number.isFinite(chapterIdNumber)
		? { chapterId: chapterIdNumber, isPublished: true }
		: { chapterSlug: chapterIdOrSlug, isPublished: true };

	const scenarios = await Scenario.find(query)
		.sort({ scenarioNo: 1 })
		.select(
			"chapterId chapterSlug chapterTitle chapterDescription coreAttitude learningGoal scenarioNo scenarioSlug title eventPeriod summary difficulty estimatedMinutes keywords learningPoints",
		)
		.lean();

	const decisions = await ScenarioDecision.find({ userId }).lean();

	return scenarios.map((scenario) => {
		const scenarioDecisions = decisions.filter(
			(decision) => String(decision.scenarioId) === String(scenario._id),
		);

		const maxStep = Math.max(
			0,
			...scenarioDecisions.map((decision) => decision.stepNumber),
		);

		return {
			...scenario,
			status:
				scenarioDecisions.length === 0
					? "NOT_STARTED"
					: maxStep >= 3
						? "COMPLETED"
						: "IN_PROGRESS",
			completedStepCount: scenarioDecisions.length,
		};
	});
};

export const getScenarioDetail = async (
	scenarioIdOrSlug: string,
	userIdInput?: string,
) => {
	const userId = getUserId(userIdInput);

	const query =
		scenarioIdOrSlug.match(/^[0-9a-fA-F]{24}$/)
			? { _id: scenarioIdOrSlug }
			: {
					$or: [
						{ scenarioSlug: scenarioIdOrSlug },
						{ scenarioNo: scenarioIdOrSlug },
					],
				};

	const scenario = await Scenario.findOne({
		...query,
		isPublished: true,
	}).lean();

	if (!scenario) {
		throw createServiceError(404, "시나리오를 찾을 수 없습니다.");
	}

	const decisions = await ScenarioDecision.find({
		userId,
		scenarioId: scenario._id,
	}).sort({ stepNumber: 1 }).lean();

	return {
		scenario,
		decisions,
		progress: {
			completedStepCount: decisions.length,
			totalStepCount: scenario.steps.length,
			isCompleted: decisions.length >= scenario.steps.length,
		},
	};
};

export const submitScenarioDecision = async (params: {
	userId?: string;
	scenarioIdOrSlug: string;
	stepNumber: number;
	action: "BUY" | "SELL" | "HOLD";
	quantity?: number;
	ratio?: number;
	tags?: string[];
	reason?: string;
}) => {
	const userId = getUserId(params.userId);

	const detail = await getScenarioDetail(params.scenarioIdOrSlug, userId);
	const scenario = detail.scenario;

	const step = scenario.steps.find(
		(item: any) => Number(item.stepNumber) === Number(params.stepNumber),
	);

	if (!step) {
		throw createServiceError(404, "해당 단계가 존재하지 않습니다.");
	}

	if (!["BUY", "SELL", "HOLD"].includes(params.action)) {
		throw createServiceError(400, "판단은 BUY, SELL, HOLD 중 하나여야 합니다.");
	}

	const decision = await ScenarioDecision.findOneAndUpdate(
		{
			userId,
			scenarioId: scenario._id,
			stepNumber: params.stepNumber,
		},
		{
			$set: {
				userId,
				scenarioId: scenario._id,
				scenarioNo: scenario.scenarioNo,
				stepNumber: params.stepNumber,
				action: params.action,
				quantity: Number(params.quantity || 0),
				ratio: Number(params.ratio || 0),
				tags: params.tags || [],
				reason: params.reason || "",
				aiFeedback: {
					summary:
						"현재는 판단 저장 단계입니다. 이후 사건-영향 구조와 AI 평가 엔진을 연결하여 상세 피드백을 제공합니다.",
					strengths: [],
					weaknesses: [],
					missedFactors: [],
					alternative: step.referenceReason,
				},
			},
		},
		{
			upsert: true,
			new: true,
			setDefaultsOnInsert: true,
		},
	).lean();

	return {
		decision,
		reference: {
			referenceDecision: step.referenceDecision,
			referenceReason: step.referenceReason,
			expectedFeedback: scenario.expectedFeedback,
			aiEvaluationPoints: scenario.aiEvaluationPoints,
		},
	};
};
