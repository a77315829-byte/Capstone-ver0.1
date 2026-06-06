import { Request, Response } from "express";
import axios from "axios";

// Python market-reaction FastAPI 서비스 주소. 기본값은 로컬 8002 포트.
const MARKET_REACTION_URL =
	process.env.MARKET_REACTION_URL || "http://127.0.0.1:8002";

const simulate = async (req: Request, res: Response) => {
	const { user_id, selected_stock, input_text, input_type_hint } = req.body;

	if (!input_text || !String(input_text).trim()) {
		return res.status(400).json({
			status: "error",
			message: "input_text가 필요합니다.",
		});
	}

	try {
		// Python 응답을 그대로 전달하기 위해 모든 상태코드를 허용한다.
		// (422 rejected, fallback 200 등 Python 이 정한 상태코드를 보존)
		const pythonRes = await axios.post(
			`${MARKET_REACTION_URL}/simulate`,
			{
				user_id: user_id || "test_user_001",
				selected_stock,
				input_text,
				input_type_hint: input_type_hint ?? null,
			},
			{
				timeout: 120000,
				validateStatus: () => true,
			},
		);

		return res.status(pythonRes.status).json(pythonRes.data);
	} catch (error: any) {
		// validateStatus 로 HTTP 에러는 위에서 통과되므로, 여기 도달하면 연결/타임아웃 등 네트워크 오류.
		console.error("marketReaction.simulate error:", {
			message: error.message,
			code: error.code,
		});

		return res.status(503).json({
			status: "error",
			message:
				"시장 반응 분석 서비스(Python)에 연결하지 못했습니다. 서비스 실행 상태를 확인하세요.",
			error: error.message,
		});
	}
};

export default {
	simulate,
};
