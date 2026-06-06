import express from "express";
const router = express.Router();
import { verifySignUp, authJwt } from "./middleware";
import authController from "./controller/auth.controller";
import userController from "./controller/user.controller";
import stocksController from "./controller/stocks.controller";
import newsController from "./controller/news.controller";
import leaderboardController from "./controller/leaderboard.controller";
import aiController from "./controller/ai.controller";
import simulatorController from "./controller/simulator.controller";
import tradingController from "./controller/trading.controller";
import scenarioController from "./controller/scenario.controller";
import marketReactionController from "./controller/marketReaction.controller";

// Auth routes
router.post(
	"/api/auth/signup",
	[verifySignUp.checkDuplicateUsername],
	authController.signup,
);
router.post("/api/auth/login", authController.login);


// User data routes
router.get("/api/user/ledger", [authJwt.verifyToken], userController.getLedger);
router.get(
	"/api/user/holdings",
	[authJwt.verifyToken],
	userController.getHoldings,
);
router.get(
	"/api/user/portfolio",
	[authJwt.verifyToken],
	userController.getPortfolio,
);
router.get("/api/user/leaderboard", leaderboardController.getLeaderboard);

// User watchlist routes
router.get(
	"/api/user/watchlist",
	[authJwt.verifyToken],
	userController.getWatchlist,
);
router.post(
	"/api/user/watchlist/add/:symbol",
	[authJwt.verifyToken],
	userController.addToWatchlist,
);
router.post(
	"/api/user/watchlist/remove/:symbol",
	[authJwt.verifyToken],
	userController.removeFromWatchlist,
);


// Stocks routes
router.get("/api/stocks/search/:query", stocksController.search);
router.get("/api/stocks/:symbol/info", stocksController.getInfo);
router.get("/api/stocks/:symbol/historical", stocksController.getHistorical);
router.get("/api/stocks/:symbol/detail", stocksController.getDetail);
router.get("/api/stocks/:symbol/orderbook", stocksController.getOrderBook);
router.get("/api/scenarios/chapters", scenarioController.getChapters);
router.get("/api/scenarios/recommended", scenarioController.getRecommended);
router.get(
	"/api/scenarios/chapters/:chapterId",
	scenarioController.getChapterScenarios,
);
router.get("/api/scenarios/:scenarioId", scenarioController.getScenario);
router.post(
	"/api/scenarios/:scenarioId/decisions",
	scenarioController.postDecision,
);

router.get("/api/trading/account", tradingController.getAccount);
router.get("/api/trading/portfolio", tradingController.getUserPortfolio);
router.get("/api/trading/orders", tradingController.getOrders);

router.post("/api/trading/orders", tradingController.postOrder);
router.post("/api/trading/orders/:orderId/cancel", tradingController.cancelOrder);
router.post("/api/trading/orders/check-pending", tradingController.checkPending);
router.post("/api/trading/reset", tradingController.resetDemo);

router.post("/api/ai/stock-assistant", aiController.stockAssistant);


router.post(
	"/api/stocks/:symbol/buy",
	[authJwt.verifyToken],
	stocksController.buyStock,
);
router.post(
	"/api/simulator/run-visual",
	simulatorController.runVisualSimulation,
);

router.post(
	"/api/market-reaction/simulate",
	marketReactionController.simulate,
);

router.post(
	"/api/stocks/:symbol/sell",
	[authJwt.verifyToken],
	stocksController.sellStock,
);

// News routes
router.get("/api/news", newsController.getNews);
router.get("/api/news/:symbol", newsController.getNews);

// History explanation AI route
router.post("/api/ai/history-explanation", async (req, res) => {
	console.log("=== /api/ai/history-explanation HIT ===");
	console.log("body:", req.body);

	const { scenarioText, marketDataText, userAnswerText } = req.body;

	const prompt = `
너는 금융 교육용 시뮬레이션 해설 모델이다.

입력은 3가지다.

[시나리오 설명]
${scenarioText}

[시장 데이터 / 실시간 데이터]
${marketDataText}

[사용자 답변]
${userAnswerText}

위 3개를 종합해서 사용자의 판단을 교육적으로 해설하라.

반드시 아래 JSON 형식으로만 한국어로 답하라.

{
  "tag_explanations": [
    {
      "tag": "시장 이해",
      "explanation": ""
    },
    {
      "tag": "리스크 판단",
      "explanation": ""
    },
    {
      "tag": "근거 적절성",
      "explanation": ""
    },
    {
      "tag": "전략 평가",
      "explanation": ""
    }
  ],
  "overall_commentary": ""
}
`;

	try {
		const response = await fetch("http://localhost:11434/api/generate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "qwen2.5:7b",
				prompt,
				stream: false,
				format: "json",
			}),
		});

		const data = await response.json();
		console.log("Ollama raw response:", data);

		if (!response.ok) {
			return res.status(500).json({
				error: "Ollama 응답 실패",
				detail: data,
			});
		}

		let parsed;
		try {
			parsed = JSON.parse(data.response);
		} catch (parseError) {
			console.error("JSON parse error:", parseError);
			console.error("raw response:", data.response);

			return res.status(500).json({
				error: "AI 응답 JSON 파싱 실패",
				raw: data.response,
			});
		}

		return res.json({
			result: parsed,
		});
	} catch (error) {
		console.error("AI route error:", error);
		return res.status(500).json({
			error: "Ollama 호출 실패",
			detail: String(error),
		});
	}
});

module.exports = router;