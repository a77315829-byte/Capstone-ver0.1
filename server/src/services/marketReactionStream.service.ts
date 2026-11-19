import type { Request, Response } from "express";
import axios from "axios";
import type { Readable } from "node:stream";

type StreamOptions = {
	url: string;
	loadStockData: (code: string | undefined) => Promise<unknown>;
	deadlineMs?: number;
};

/** Forward incremental analysis without buffering it into a final JSON response. */
export async function streamMarketReaction(
	req: Request,
	res: Response,
	{ url, loadStockData, deadlineMs = 120000 }: StreamOptions,
) {
	const { user_id, selected_stock, input_text, input_type_hint } = req.body;
	if (!input_text || !String(input_text).trim()) {
		res.status(400).json({ status: "error", message: "input_text가 필요합니다." });
		return;
	}

	const controller = new AbortController();
	let upstream: Readable | undefined;
	const sendError = (message: string) => {
		if (!res.destroyed && !res.writableEnded) {
			// The leading separator also terminates a truncated upstream SSE frame.
			res.end(`\n\nevent: error\ndata: ${JSON.stringify({ status: "error", message })}\n\n`);
		}
	};
	const abort = () => {
		controller.abort();
		upstream?.destroy();
	};
	const timer = setTimeout(() => {
		sendError("분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
		abort();
	}, deadlineMs);
	req.once("aborted", abort);
	res.once("close", abort);

	res.status(200).set({
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		"X-Accel-Buffering": "no",
	});
	res.flushHeaders();
	res.write('event: progress\ndata: {"stage":"quote"}\n\n');

	try {
		const stock_data = await loadStockData(selected_stock?.code);
		if (controller.signal.aborted) return;
		const response = await axios.post<Readable>(
			url,
			{
				user_id: user_id || "test_user_001",
				selected_stock,
				input_text,
				input_type_hint: input_type_hint ?? null,
				stock_data,
			},
			{
				responseType: "stream",
				signal: controller.signal,
				timeout: deadlineMs,
				validateStatus: () => true,
				headers: { Accept: "text/event-stream" },
			},
		);
		upstream = response.data;
		if (controller.signal.aborted) { upstream.destroy(); return; }
		if (response.status !== 200 || !String(response.headers["content-type"]).includes("text/event-stream")) {
			upstream.destroy();
			sendError(response.status === 422
				? "분석 입력을 확인해 주세요. 종목과 뉴스 내용을 올바르게 입력해야 합니다."
				: "시장 반응 분석 서비스에 연결하지 못했습니다.");
			return;
		}
		// pipe provides backpressure and forwards every chunk as it arrives.
		await new Promise<void>((resolve, reject) => {
			const onAbort = () => { upstream?.unpipe(res); resolve(); };
			controller.signal.addEventListener("abort", onAbort, { once: true });
			upstream!.once("error", reject);
			upstream!.once("end", () => {
				controller.signal.removeEventListener("abort", onAbort);
				resolve();
			});
			upstream!.pipe(res);
		});
	} catch {
		if (!controller.signal.aborted) {
			sendError("분석 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.");
		}
	} finally {
		clearTimeout(timer);
		req.removeListener("aborted", abort);
		res.removeListener("close", abort);
		upstream?.destroy();
	}
}
