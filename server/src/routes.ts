import express from "express";
import mongoose from "mongoose";

import authController from "./controller/auth.controller";
import marketReactionController from "./controller/marketReaction.controller";
import marketSessionController from "./controller/marketSession.controller";
import newsController from "./controller/news.controller";
import stocksController from "./controller/stocks.controller";
import tradingController from "./controller/trading.controller";
import userController from "./controller/user.controller";
import usStocksController from "./controller/usStocks.controller";
import usTradingController from "./controller/usTrading.controller";
import { authJwt, verifySignUp } from "./middleware";
import aiJudgmentProxyRoutes from "./routes/aiJudgmentProxy.routes";
import scenarioProxyRoutes from "./routes/scenarioProxy.routes";

const router = express.Router();

router.get("/api/health", (_req, res) => {
	res.json({
		status: "ok",
		service: "antitude-api",
		database: mongoose.connection.readyState === 1 ? "connected" : "unavailable",
	});
});

router.post(
	"/api/auth/signup",
	[verifySignUp.checkDuplicateUsername],
	authController.signup,
);
router.post("/api/auth/login", authController.login);

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

router.get("/api/markets/KRX/status", marketSessionController.getKrxStatus);

router.use(scenarioProxyRoutes);
router.use(aiJudgmentProxyRoutes);

router.get("/api/stocks/search/:query", stocksController.search);
router.get("/api/stocks/:symbol/info", stocksController.getInfo);
router.get("/api/stocks/:symbol/historical", stocksController.getHistorical);
router.get("/api/stocks/:symbol/detail", stocksController.getDetail);
router.get("/api/stocks/:symbol/orderbook", stocksController.getOrderBook);
router.get("/api/stocks/:symbol/executions", stocksController.getExecutions);
router.get("/api/stocks/:symbol/investors", stocksController.getInvestors);
router.post(
	"/api/stocks/:symbol/buy",
	[authJwt.verifyToken],
	stocksController.buyStock,
);
router.post(
	"/api/stocks/:symbol/sell",
	[authJwt.verifyToken],
	stocksController.sellStock,
);

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
	[authJwt.verifyToken, marketSessionController.validateKrxOrderSession],
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

router.post("/api/market-reaction/simulate", marketReactionController.simulate);

router.get("/api/us-stocks/search/:query", usStocksController.search);
router.get(
	"/api/us-stocks/:exchange/:symbol/info",
	usStocksController.getInfo,
);
router.get(
	"/api/us-stocks/:exchange/:symbol/historical",
	usStocksController.getHistorical,
);
router.get(
	"/api/us-stocks/:exchange/:symbol/orderbook",
	usStocksController.getOrderBook,
);
router.get(
	"/api/us-stocks/:exchange/:symbol/executions",
	usStocksController.getExecutions,
);
router.get("/api/markets/US/status", usStocksController.getMarketStatus);

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

router.get("/api/news", newsController.getNews);
router.get("/api/news/:symbol", newsController.getNews);

export default router;
