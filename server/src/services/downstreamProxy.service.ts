import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Response } from "express";

import { DownstreamService } from "../config/downstream";

export const createDownstreamClient = (
	service: DownstreamService,
): AxiosInstance =>
	axios.create({
		baseURL: service.baseUrl,
		timeout: service.timeoutMs,
		validateStatus: () => true,
	});

export const forwardDownstream = async (
	res: Response,
	service: DownstreamService,
	request: () => Promise<AxiosResponse>,
): Promise<Response> => {
	try {
		const response = await request();
		return res.status(response.status).send(response.data);
	} catch (error: unknown) {
		const isAxiosError = axios.isAxiosError(error);
		const code = isAxiosError ? error.code : undefined;
		const message = error instanceof Error ? error.message : String(error);
		const timedOut = code === "ECONNABORTED" || code === "ETIMEDOUT";

		console.error(`${service.name} downstream request failed`, {
			code: code || "UNKNOWN",
			message,
		});

		return res.status(timedOut ? 504 : 502).json({
			error: timedOut
				? `${service.unavailableMessage}: 응답 시간 초과`
				: service.unavailableMessage,
			code: timedOut ? "DOWNSTREAM_TIMEOUT" : "DOWNSTREAM_UNAVAILABLE",
		});
	}
};
