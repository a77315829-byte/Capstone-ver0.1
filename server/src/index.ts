import "./utils/runtime";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { connectDatabase } from "./utils/db";
import { attachStockStream } from "./services/stockStream.service";
import { startPendingOrderScheduler, stopPendingOrderScheduler, pendingOrderSchedulerStatus } from "./services/pendingOrderScheduler.service";
import { startUsPendingOrderScheduler, stopUsPendingOrderScheduler, usPendingOrderSchedulerStatus } from "./services/usPendingOrderScheduler.service";
import { networkBoundary, inexpensiveAiRequest } from "./utils/networkAccess";
const cors = require("cors");
const rateLimit = require("express-rate-limit").rateLimit;
const app = express();
app.disable("x-powered-by");
app.use(networkBoundary);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((value) => value.trim());
app.use(cors({ origin: (origin: string | undefined, callback: Function) => callback(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json({ limit: "256kb" }));
app.use((_req, res, next) => {
 res.setHeader("X-Content-Type-Options", "nosniff");
 res.setHeader("Referrer-Policy", "same-origin");
 res.setHeader("X-Frame-Options", "SAMEORIGIN");
 next();
});
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
// Polling screens share a school NAT: separate expensive writes from reads.
app.use("/api", rateLimit({ windowMs: 60000, max: 600, standardHeaders: true, legacyHeaders: false,
 message: { message: "요청이 많습니다. 잠시 후 다시 시도해주세요." } }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60000, max: 30, skipSuccessfulRequests: true,
 standardHeaders: true, legacyHeaders: false, message: { message: "로그인 시도가 많습니다. 15분 후 다시 시도해주세요." } }));
app.use("/api/auth/signup", rateLimit({ windowMs: 3600000, max: 120, standardHeaders: true, legacyHeaders: false,
 message: { message: "회원가입 요청이 많습니다. 잠시 후 다시 시도해주세요." } }));
app.use(["/api/ai", "/api/ai-judgment", "/api/salary-ai/analyze", "/api/market-reaction", "/api/simulator"], rateLimit({ windowMs: 60000, max: 20, skip: inexpensiveAiRequest,
 standardHeaders: true, legacyHeaders: false, message: { message: "분석 요청이 많습니다. 잠시 후 다시 시도해주세요." } }));
app.get("/api/health", (_req, res) => {
 const ready = mongoose.connection.readyState === 1;
 res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "degraded", database: ready ? "connected" : "unavailable",
  orderSchedulers: { KR: pendingOrderSchedulerStatus(), US: usPendingOrderSchedulerStatus() } });
});
app.get("/api/auth/config", (_req, res) => res.json({
 captchaEnabled: process.env.AUTH_CAPTCHA_MODE !== "disabled", captchaSiteKey: process.env.TURNSTILE_SITE_KEY || "",
}));
app.use(require("./routes"));
app.use("/api", (_req, res) => res.status(404).json({ message: "API 주소를 찾을 수 없습니다." }));
// One origin for React, REST and WebSocket; Vite is unnecessary at the exhibition.
const frontend = path.resolve(__dirname, "../../app/dist");
if (fs.existsSync(path.join(frontend, "index.html"))) {
 app.use(express.static(frontend, { index: false }));
 app.get("*", (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(frontend, "index.html")); });
}
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
 res.status(error?.status === 413 ? 413 : 400).json({ message: "요청 형식 또는 크기를 확인해주세요." });
});
const httpServer = createServer(app);
attachStockStream(httpServer);
async function start() {
 if (!process.env.STOTRA_JWT_SECRET || process.env.STOTRA_JWT_SECRET.length < 32) throw new Error("STOTRA_JWT_SECRET은 32자 이상으로 설정해주세요.");
 if (process.env.AUTH_CAPTCHA_MODE !== "disabled" && (!process.env.STOTRA_TURNSTILE_SECRET || !process.env.TURNSTILE_SITE_KEY)) {
  throw new Error("Turnstile 키를 설정하거나 로컬 전시용 AUTH_CAPTCHA_MODE=disabled를 명시해주세요.");
 }
 await connectDatabase();
 const port = Number(process.env.PORT || 3010);
 const host = process.env.HOST || "127.0.0.1";
 httpServer.listen(port, host, () => {
  startPendingOrderScheduler();
  startUsPendingOrderScheduler();
  console.log(`ANTITUDE: http://${host}:${port}`);
 });
}
start().catch((error) => {
 console.error("서버 시작 실패:", error?.code === 11000 ? "중복 아이디가 있습니다. DB의 users를 확인해주세요." : (/^(STOTRA_JWT_SECRET|Turnstile|MONGODB_URI|MONGO_DB_NAME)/.test(error.message || "") ? error.message : error.name + ": 설정 또는 DB 연결을 확인해주세요."));
 process.exit(1);
});
let shuttingDown = false;
async function shutdown() {
 if (shuttingDown) return;
 shuttingDown = true;
 httpServer.close();
 await Promise.all([stopPendingOrderScheduler(), stopUsPendingOrderScheduler()]);
 await mongoose.disconnect();
 process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
