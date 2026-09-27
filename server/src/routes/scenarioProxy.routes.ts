import express from "express";

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
