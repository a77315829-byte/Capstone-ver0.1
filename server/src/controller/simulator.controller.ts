import { Request, Response } from "express";
import axios from "axios";

const PYTHON_SIMULATOR_URL =
	process.env.STOTRA_SIMULATOR_URL || "http://127.0.0.1:8000";

const runVisualSimulation = async (req: Request, res: Response) => {
	try {
		const {
			symbol,
			stockName,
			currentPrice,
			changeRate,
			volume,
			newsText,
			steps,
		} = req.body;

		if (!symbol) {
			return res.status(400).json({
				success: false,
				message: "symbol이 필요합니다.",
			});
		}

		const pythonRes = await axios.post(
			`${PYTHON_SIMULATOR_URL}/sim/run-visual`,
			{
				symbol,
				stock_name: stockName || symbol,
				current_price: Number(currentPrice || 100),
				change_rate: Number(changeRate || 0),
				volume: Number(volume || 0),
				news_text: newsText || "",
				steps: Number(steps || 60),
				use_llm: true,
				llm_model: "llama3.1:8b",
				llm_base_url: "http://127.0.0.1:11434",
				llm_every_n_steps: 10,
				n_retail: 400,
				n_institution: 20,
			},
			{
				timeout: 180000,
			},
		);

		return res.status(200).json(pythonRes.data);
	} catch (error: any) {
		console.error("runVisualSimulation error:", {
			message: error.message,
			status: error.response?.status,
			data: error.response?.data,
		});

		return res.status(500).json({
			success: false,
			message: "시장 시뮬레이션 실행 중 오류가 발생했습니다.",
			error: error.response?.data || error.message,
		});
	}
};

export default {
	runVisualSimulation,
};