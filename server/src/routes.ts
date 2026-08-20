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
import assetAdviceController from "./controller/assetAdvice.controller";
import communityController from "./controller/community.controller";
import militaryProfileController from "./controller/militaryProfile.controller";
import marketSessionController from "./controller/marketSession.controller";
import usStocksController from "./controller/usStocks.controller";
import usTradingController from "./controller/usTrading.controller";
import salaryAiController from "./controller/salaryAi.controller";
import onboardingController from "./controller/onboarding.controller";
import axios from "axios";

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
router.get(
	"/api/user/military-profile",
	[authJwt.verifyToken],
	militaryProfileController.getMilitaryProfile,
);

router.put(
	"/api/user/military-profile",
	[authJwt.verifyToken],
	militaryProfileController.saveMilitaryProfile,
);

router.get(
	"/api/user/onboarding-status",
	[authJwt.verifyToken],
	onboardingController.getOnboardingStatus,
);

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

router.get(
	"/api/markets/KRX/status",
	marketSessionController.getKrxStatus,
);
// ================================
// Scenario Service
// ================================

router.get("/api/scenario-service/scenarios", async (req, res) => {
	try {
		const baseUrl =
			process.env.SCENARIO_SERVICE_URL || "http://127.0.0.1:8001";

		const response = await axios.get(`${baseUrl}/api/scenarios`);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"Scenario Service request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "Scenario Service 연결 실패",
			},
		);
	}
});

const SCENARIO_SERVICE_URL =
	process.env.SCENARIO_SERVICE_URL || "http://127.0.0.1:8001";

const handleScenarioError = (res: any, error: any) => {
	console.error(
		"Scenario Service request failed:",
		error.response?.data || error.message,
	);

	return res.status(error.response?.status || 502).json(
		error.response?.data || {
			error: "Scenario Service 연결 실패",
		},
	);
};

// 시나리오 서버 상태 확인
router.get("/api/scenario-service/health", async (req, res) => {
	try {
		const response = await axios.get(`${SCENARIO_SERVICE_URL}/`);
		return res.json(response.data);
	} catch (error: any) {
		return handleScenarioError(res, error);
	}
});

// 시나리오 목록
router.get("/api/scenario-service/scenarios", async (req, res) => {
	try {
		const response = await axios.get(
			`${SCENARIO_SERVICE_URL}/api/scenarios`,
		);

		return res.json(response.data);
	} catch (error: any) {
		return handleScenarioError(res, error);
	}
});

// 시나리오 플레이 세션 생성
router.post(
	"/api/scenario-service/scenarios/:scenarioId/sessions",
	async (req, res) => {
		try {
			const response = await axios.post(
				`${SCENARIO_SERVICE_URL}/api/scenarios/${req.params.scenarioId}/sessions`,
				req.body,
			);

			return res.status(response.status).json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 현재 턴 조회
router.get(
	"/api/scenario-service/sessions/:sessionId/turn",
	async (req, res) => {
		try {
			const response = await axios.get(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/turn`,
			);

			return res.json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 종목 차트 조회
router.get(
	"/api/scenario-service/sessions/:sessionId/chart/:assetId",
	async (req, res) => {
		try {
			const response = await axios.get(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/chart/${req.params.assetId}`,
				{
					params: req.query,
				},
			);

			return res.json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 매수 / 매도
router.post(
	"/api/scenario-service/sessions/:sessionId/orders",
	async (req, res) => {
		try {
			const response = await axios.post(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/orders`,
				req.body,
			);

			return res.status(response.status).json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 턴 판단 제출
router.post(
	"/api/scenario-service/sessions/:sessionId/turn/submit",
	async (req, res) => {
		try {
			const response = await axios.post(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/turn/submit`,
				req.body,
			);

			return res.json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 최종 결과 조회
router.get(
	"/api/scenario-service/sessions/:sessionId/result",
	async (req, res) => {
		try {
			const response = await axios.get(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/result`,
			);

			return res.json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);

// 세션 최종 완료
router.post(
	"/api/scenario-service/sessions/:sessionId/finalize",
	async (req, res) => {
		try {
			const response = await axios.post(
				`${SCENARIO_SERVICE_URL}/api/sessions/${req.params.sessionId}/finalize`,
			);

			return res.json(response.data);
		} catch (error: any) {
			return handleScenarioError(res, error);
		}
	},
);
// 사용자별 시나리오 진행도
router.get(
    "/api/scenario-service/users/:userId/scenario-progress",
    async (req, res) => {
        try {
            const response = await axios.get(
                `${SCENARIO_SERVICE_URL}/api/users/${encodeURIComponent(
                    req.params.userId,
                )}/scenario-progress`,
            );

            return res.json(response.data);
        } catch (error: any) {
            return handleScenarioError(res, error);
        }
    },
);

// 사용자별 퀴즈 진행도 조회
router.get(
    "/api/scenario-service/users/:userId/quiz-progress",
    async (req, res) => {
        try {
            const response = await axios.get(
                `${SCENARIO_SERVICE_URL}/api/users/${encodeURIComponent(
                    req.params.userId,
                )}/quiz-progress`,
                {
                    params: req.query,
                },
            );

            return res.json(response.data);
        } catch (error: any) {
            return handleScenarioError(res, error);
        }
    },
);

// 퀴즈 풀이/세션 완료 이벤트 저장
router.post(
    "/api/scenario-service/users/:userId/quiz-progress/events",
    async (req, res) => {
        try {
            const response = await axios.post(
                `${SCENARIO_SERVICE_URL}/api/users/${encodeURIComponent(
                    req.params.userId,
                )}/quiz-progress/events`,
                req.body,
            );

            return res.status(response.status).json(response.data);
        } catch (error: any) {
            return handleScenarioError(res, error);
        }
    },
);
// ================================
// AI Judgment Service
// ================================

router.get("/api/ai-judgment/health", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.get(`${baseUrl}/health`);

		return res.json(response.data);
	} catch (error) {
		console.error("AI Judgment health check failed:", error);

		return res.status(502).json({
			error: "AI Judgment Service 연결 실패",
		});
	}
});
router.get("/api/ai-judgment/:symbol", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.get(
			`${baseUrl}/judgment/${req.params.symbol}`,
		);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"AI Judgment request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "AI Judgment Service 연결 실패",
			},
		);
	}
});
router.post("/api/ai-judgment/:symbol/watch", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.post(
			`${baseUrl}/judgment/${req.params.symbol}/watch`,
		);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"AI Judgment watch request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "AI Judgment Service 연결 실패",
			},
		);
	}
});
router.delete("/api/ai-judgment/:symbol/watch", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.delete(
			`${baseUrl}/judgment/${req.params.symbol}/watch`,
		);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"AI Judgment unwatch request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "AI Judgment Service 연결 실패",
			},
		);
	}
});
router.get("/api/ai-judgment/:symbol/history", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.get(
			`${baseUrl}/judgment/${req.params.symbol}/history`,
			{ params: req.query },
		);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"AI Judgment history request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "AI Judgment Service 연결 실패",
			},
		);
	}
});
router.post("/api/ai-judgment/compare", async (req, res) => {
	try {
		const baseUrl =
			process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8002";

		const response = await axios.post(`${baseUrl}/judgment/compare`, req.body);

		return res.json(response.data);
	} catch (error: any) {
		console.error(
			"AI Judgment compare request failed:",
			error.response?.data || error.message,
		);

		return res.status(error.response?.status || 502).json(
			error.response?.data || {
				error: "AI Judgment Service 연결 실패",
			},
		);
	}
});

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

// 로그인 사용자별 모의투자 계좌
router.get(
	"/api/trading/account",
	[authJwt.verifyToken],
	tradingController.getAccount,
);

router.get(
	"/api/trading/portfolio",
	[authJwt.verifyToken],
	tradingController.getUserPortfolio,
);

router.get(
	"/api/trading/orders",
	[authJwt.verifyToken],
	tradingController.getOrders,
);

router.post(
	"/api/trading/orders",
	[
		authJwt.verifyToken,
		marketSessionController.validateKrxOrderSession,
	],
	tradingController.postOrder,
);

router.post(
	"/api/trading/orders/:orderId/cancel",
	[authJwt.verifyToken],
	tradingController.cancelOrder,
);

router.post(
	"/api/trading/orders/check-pending",
	[authJwt.verifyToken],
	tradingController.checkPending,
);

router.post(
	"/api/trading/reset",
	[authJwt.verifyToken],
	tradingController.resetDemo,
);

router.post(
	"/api/trading/top-up",
	[authJwt.verifyToken],
	tradingController.topUp,
);

router.post(
	"/api/trading/salary-plan-funding/enable",
	[authJwt.verifyToken],
	tradingController.enableSalaryFunding,
);

router.post("/api/ai/stock-assistant", aiController.stockAssistant);
router.post(
	"/api/ai/asset-advice",
	assetAdviceController.generateAdvice,
);
router.get(
	"/api/salary-ai/latest",
	[authJwt.verifyToken],
	salaryAiController.getLatest,
);
router.post(
  "/api/salary-ai/analyze",
  [authJwt.verifyToken],
  salaryAiController.analyze,
);


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
router.get(
	"/api/community/profile",
	[authJwt.verifyToken],
	communityController.getProfile,
);

router.patch(
	"/api/community/profile",
	[authJwt.verifyToken],
	communityController.updateProfile,
);

// 게시글
router.get(
	"/api/community/posts",
	communityController.listPosts,
);

router.post(
	"/api/community/posts",
	[authJwt.verifyToken],
	communityController.createPost,
);

router.get(
	"/api/community/posts/:postId",
	communityController.getPost,
);

router.delete(
	"/api/community/posts/:postId",
	[authJwt.verifyToken],
	communityController.deletePost,
);

router.post(
	"/api/community/posts/:postId/like",
	[authJwt.verifyToken],
	communityController.togglePostLike,
);

// 댓글
router.get(
	"/api/community/posts/:postId/comments",
	communityController.listComments,
);

router.post(
	"/api/community/posts/:postId/comments",
	[authJwt.verifyToken],
	communityController.createComment,
);

// 군종별 모의투자 순위
router.get(
	"/api/community/leaderboard/live",
	communityController.getLiveLeaderboard,
);

router.get(
	"/api/community/leaderboard/monthly",
	communityController.getMonthlyLeaderboard,
);

router.get(
	"/api/community/leaderboard/branch-winners",
	communityController.getBranchWinners,
);

router.get(
	"/api/community/leaderboard/me",
	[authJwt.verifyToken],
	communityController.getMyLeaderboard,
);

// 기존 경로 호환
router.get(
	"/api/community/leaderboard",
	communityController.getLeaderboard,
);
// 미국 주식관련 
// ================================
// 미국 종목 검색·시세·차트
// ================================

router.get(
	"/api/us-stocks/search/:query",
	usStocksController.search,
);

router.get(
	"/api/us-stocks/:exchange/:symbol/info",
	usStocksController.getInfo,
);

router.get(
	"/api/us-stocks/:exchange/:symbol/historical",
	usStocksController.getHistorical,
);

// ================================
// 미국 시장 운영 상태
// ================================

router.get(
	"/api/markets/US/status",
	usStocksController.getMarketStatus,
);

// ================================
// 미국 모의투자 계좌
// ================================

router.get(
	"/api/us-trading/account",
	[authJwt.verifyToken],
	usTradingController.getAccount,
);

router.get(
	"/api/us-trading/portfolio",
	[authJwt.verifyToken],
	usTradingController.getPortfolio,
);

// ================================
// 미국 주식 주문
// ================================

router.get(
	"/api/us-trading/orders",
	[authJwt.verifyToken],
	usTradingController.getOrders,
);

router.post(
	"/api/us-trading/orders",
	[authJwt.verifyToken],
	usTradingController.postOrder,
);

router.post(
	"/api/us-trading/orders/check-pending",
	[authJwt.verifyToken],
	usTradingController.checkPending,
);

router.post(
	"/api/us-trading/orders/:orderId/cancel",
	[authJwt.verifyToken],
	usTradingController.cancelOrder,
);

// ================================
// 미국 모의계좌 초기화
// ================================

router.post(
	"/api/us-trading/top-up",
	[authJwt.verifyToken],
	usTradingController.topUp,
);

router.post(
	"/api/us-trading/reset",
	[authJwt.verifyToken],
	usTradingController.reset,
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
