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
const service = downstreamServices.aiJudgment;
const client = createDownstreamClient(service);
const part = (value: string): string => encodeURIComponent(value);

router.get("/api/ai-judgment/health", async (_req, res) =>
	forwardDownstream(res, service, () =>
		client.get("/health", { timeout: DOWNSTREAM_HEALTH_TIMEOUT_MS }),
	),
);

router.get("/api/ai-judgment/:symbol", async (req, res) =>
	forwardDownstream(res, service, () =>
		client.get(`/judgment/${part(req.params.symbol)}`),
	),
);

router.post("/api/ai-judgment/:symbol/watch", async (req, res) =>
	forwardDownstream(res, service, () =>
		client.post(`/judgment/${part(req.params.symbol)}/watch`),
	),
);

router.delete("/api/ai-judgment/:symbol/watch", async (req, res) =>
	forwardDownstream(res, service, () =>
		client.delete(`/judgment/${part(req.params.symbol)}/watch`),
	),
);

router.get("/api/ai-judgment/:symbol/history", async (req, res) =>
	forwardDownstream(res, service, () =>
		client.get(`/judgment/${part(req.params.symbol)}/history`, {
			params: req.query,
		}),
	),
);

router.post("/api/ai-judgment/compare", async (req, res) =>
	forwardDownstream(res, service, () =>
		client.post("/judgment/compare", req.body),
	),
);

export default router;
