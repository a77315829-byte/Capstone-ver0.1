import { Router } from "express";
import axios from "axios";
import User from "../models/user.model";
import { verifyToken } from "../middleware/authJwt";
import { serviceHeaders, timeoutMs } from "../utils/runtime";
const router = Router();
const upstream = axios.create({ baseURL: process.env.SCENARIO_SERVICE_URL || "http://127.0.0.1:8000",
 timeout: timeoutMs("SCENARIO_TIMEOUT_MS", 90000) });
router.get("/health", async (_req, res) => {
 try { return res.json((await upstream.get("/", { timeout: 3000 })).data); }
 catch { return res.status(503).json({ message: "시나리오 서비스에 연결하지 못했습니다." }); }
});
router.use(verifyToken);
router.use(async (req, res, next) => {
 try {
  const user = await User.findById((req as any).userId).select("username").lean();
  if (!user) return res.status(401).json({ message: "계정을 찾을 수 없습니다." });
  // Existing scenario documents use usernames. Keep those IDs to preserve progress.
  res.locals.scenarioUser = user.username;
  next();
 } catch { return res.status(503).json({ message: "계정을 확인하지 못했습니다." }); }
});
const routes: [string, string][] = [
 ["get", "/scenarios"], ["post", "/scenarios/:scenarioId/sessions"],
 ["get", "/sessions/:sessionId/turn"], ["get", "/sessions/:sessionId/chart/:assetId"],
 ["get", "/sessions/:sessionId/orderbook/:assetId"], ["post", "/sessions/:sessionId/orders"],
 ["post", "/sessions/:sessionId/turn/submit"], ["get", "/sessions/:sessionId/result"],
 ["post", "/sessions/:sessionId/finalize"], ["get", "/users/:userId/scenario-progress"],
 ["get", "/users/:userId/quiz-progress"], ["post", "/users/:userId/quiz-progress/events"],
];
for (const [method, route] of routes) {
 (router as any)[method](route, async (req: any, res: any) => {
  const username = res.locals.scenarioUser;
  if (req.params.userId && req.params.userId !== username) return res.status(403).json({ message: "본인의 기록만 조회할 수 있습니다." });
  const pathname = route.replace(/:([A-Za-z]+)/g, (_, name) => encodeURIComponent(req.params[name]));
  try {
   const body = { ...req.body };
   delete body.userId;
   if (route === "/scenarios/:scenarioId/sessions") body.user_id = username;
   const response = await upstream.request({ method, url: "/api" + pathname,
    data: method === "post" ? body : undefined, params: req.query,
    headers: { ...serviceHeaders(), "X-User-Id": encodeURIComponent(username) } });
   return res.status(response.status).json(response.data);
  } catch (error: any) {
   const status = error.response?.status;
   if (status >= 400 && status < 500) return res.status(status).json(error.response.data);
   return res.status(503).json({ message: "시나리오 서비스 응답을 받지 못했습니다. 진행 결과를 확인한 후 다시 시도해주세요." });
  }
 });
}
export default router;
