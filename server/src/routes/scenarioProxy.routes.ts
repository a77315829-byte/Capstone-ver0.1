import express from "express";
import { verifyToken } from "../middleware/authJwt";
import User from "../models/user.model";

import {
	DOWNSTREAM_HEALTH_TIMEOUT_MS,
	downstreamServices,
} from "../config/downstream";
import {
	createDownstreamClient,
	forwardDownstream,
} from "../services/downstreamProxy.service";

const router = express.Router();
const service = downstreamServices.scenario;
const client = createDownstreamClient(service);
const part = (value: string): string => encodeURIComponent(value);
const requireOwnHistory: express.RequestHandler = async (req, res, next) => {
	try {
		const identity = req as express.Request & { userId?: string };
		const user = identity.userId
			? await User.findById(identity.userId).select("username").lean().exec()
			: null;
		if (!user || user.username !== req.params.userId) {
			res.status(403).json({ message: "본인의 학습 이력만 조회할 수 있습니다." });
			return;
		}
		next();
	} catch (error) {
		next(error);
	}
};

router.get("/api/scenario-service/health", async (_req, res) =>
	forwardDownstream(res, service, () =>
		client.get("/", { timeout: DOWNSTREAM_HEALTH_TIMEOUT_MS }),
	),
);

router.get("/api/scenario-service/scenarios", async (_req, res) =>
	forwardDownstream(res, service, () => client.get("/api/scenarios")),
);

router.post(
	"/api/scenario-service/scenarios/:scenarioId/sessions",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.post(
				`/api/scenarios/${part(req.params.scenarioId)}/sessions`,
				req.body,
			),
		),
);

router.get(
	"/api/scenario-service/sessions/:sessionId/turn",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(`/api/sessions/${part(req.params.sessionId)}/turn`),
		),
);

router.get(
	"/api/scenario-service/sessions/:sessionId/chart/:assetId",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(
				`/api/sessions/${part(req.params.sessionId)}/chart/${part(req.params.assetId)}`,
				{ params: req.query },
			),
		),
);

router.get(
	"/api/scenario-service/sessions/:sessionId/orderbook/:assetId",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(
				`/api/sessions/${part(req.params.sessionId)}/orderbook/${part(req.params.assetId)}`,
			),
		),
);

router.post(
	"/api/scenario-service/sessions/:sessionId/orders",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.post(
				`/api/sessions/${part(req.params.sessionId)}/orders`,
				req.body,
			),
		),
);

router.post(
	"/api/scenario-service/sessions/:sessionId/turn/submit",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.post(
				`/api/sessions/${part(req.params.sessionId)}/turn/submit`,
				req.body,
			),
		),
);

router.get(
	"/api/scenario-service/sessions/:sessionId/result",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(`/api/sessions/${part(req.params.sessionId)}/result`),
		),
);

router.post(
	"/api/scenario-service/sessions/:sessionId/finalize",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.post(`/api/sessions/${part(req.params.sessionId)}/finalize`),
		),
);

router.get(
	"/api/scenario-service/users/:userId/scenario-progress",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(
				`/api/users/${part(req.params.userId)}/scenario-progress`,
			),
		),
);

router.get(
	"/api/scenario-service/users/:userId/evaluations",
	verifyToken,
	requireOwnHistory,
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(`/api/users/${part(req.params.userId)}/evaluations`),
		),
);

router.get(
	"/api/scenario-service/users/:userId/evaluations/:evaluationId",
	verifyToken,
	requireOwnHistory,
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(
				`/api/users/${part(req.params.userId)}/evaluations/${part(req.params.evaluationId)}`,
			),
		),
);

router.get(
	"/api/scenario-service/users/:userId/quiz-progress",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.get(`/api/users/${part(req.params.userId)}/quiz-progress`, {
				params: req.query,
			}),
		),
);

router.post(
	"/api/scenario-service/users/:userId/quiz-progress/events",
	async (req, res) =>
		forwardDownstream(res, service, () =>
			client.post(
				`/api/users/${part(req.params.userId)}/quiz-progress/events`,
				req.body,
			),
		),
);

export default router;
