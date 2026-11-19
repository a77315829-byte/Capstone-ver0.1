import { Request, Response } from "express";

import {
	getRecommendedScenarios,
	getScenarioChapters,
	getScenarioDetail,
	getScenariosByChapter,
	submitScenarioDecision,
} from "../services/scenario.service";

const getErrorMessage = (error: any): string => {
	return error?.message || String(error);
};

const getStatusCode = (error: any): number => {
	const statusCode = Number(error?.statusCode || error?.response?.status || 500);
	return statusCode >= 400 && statusCode < 600 ? statusCode : 500;
};

const sendError = (res: Response, error: any, fallbackMessage: string) => {
	return res.status(getStatusCode(error)).json({
		success: false,
		error: fallbackMessage,
		message: getErrorMessage(error),
	});
};

const getChapters = async (req: Request, res: Response) => {
	try {
		const userId = (req as any).userId;

		const chapters = await getScenarioChapters(userId);

		return res.status(200).json({
			success: true,
			data: chapters,
		});
	} catch (error) {
		console.error("getChapters error:", error);
		return sendError(res, error, "시나리오 챕터를 불러오지 못했습니다.");
	}
};

const getRecommended = async (_req: Request, res: Response) => {
	try {
		const scenarios = await getRecommendedScenarios();

		return res.status(200).json({
			success: true,
			data: scenarios,
		});
	} catch (error) {
		console.error("getRecommended error:", error);
		return sendError(res, error, "추천 시나리오를 불러오지 못했습니다.");
	}
};

const getChapterScenarios = async (req: Request, res: Response) => {
	try {
		const userId = (req as any).userId;
		const chapterIdOrSlug = req.params.chapterId;

		const scenarios = await getScenariosByChapter(chapterIdOrSlug, userId);

		return res.status(200).json({
			success: true,
			data: scenarios,
		});
	} catch (error) {
		console.error("getChapterScenarios error:", error);
		return sendError(res, error, "챕터 시나리오 목록을 불러오지 못했습니다.");
	}
};

const getScenario = async (req: Request, res: Response) => {
	try {
		const userId = (req as any).userId;
		const scenarioIdOrSlug = req.params.scenarioId;

		const detail = await getScenarioDetail(scenarioIdOrSlug, userId);

		return res.status(200).json({
			success: true,
			data: detail,
		});
	} catch (error) {
		console.error("getScenario error:", error);
		return sendError(res, error, "시나리오 상세 정보를 불러오지 못했습니다.");
	}
};

const postDecision = async (req: Request, res: Response) => {
	try {
		const result = await submitScenarioDecision({
			userId: (req as any).userId,
			scenarioIdOrSlug: req.params.scenarioId,
			stepNumber: Number(req.body.stepNumber),
			action: req.body.action,
			quantity: req.body.quantity,
			ratio: req.body.ratio,
			tags: req.body.tags,
			reason: req.body.reason,
		});

		return res.status(201).json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("postDecision error:", error);
		return sendError(res, error, "시나리오 판단 저장에 실패했습니다.");
	}
};

export default {
	getChapters,
	getRecommended,
	getChapterScenarios,
	getScenario,
	postDecision,
};