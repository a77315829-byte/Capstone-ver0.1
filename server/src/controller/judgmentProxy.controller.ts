import { Request, Response } from "express";
import axios from "axios";
import { fetchStockData } from "../utils/requests";
import { aiMode, serviceHeaders, timeoutMs, withDeadline } from "../utils/runtime";
import { judgmentFallback } from "../services/exhibitionFallback.service";
const baseURL = process.env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8003";
const validSymbol = (value: unknown): value is string => typeof value === "string" && /^(\d[A-Z0-9]{5}|[A-Za-z][A-Za-z0-9.-]{0,11})$/.test(value);
let retryAfter = 0;
async function proxy(method: string, path: string, data?: unknown, params?: unknown) {
 if (aiMode() === "rules" || Date.now() < retryAfter) throw new Error("RULES_MODE");
 try {
  return (await axios.request({ baseURL, url: path, method, data, params,
   headers: serviceHeaders(), timeout: timeoutMs("AI_SERVICE_TIMEOUT_MS", 20000) })).data;
 } catch (error: any) {
  if (!error.response || error.response.status >= 500) retryAfter = Date.now() + 15000;
  throw error;
 }
}
const canFallback = (error: any) => !error.response || error.response.status >= 500 || error.response.status === 404;
async function fallback(symbol: string) {
 const quote = /^\d[A-Z0-9]{5}$/.test(symbol) ? await withDeadline(fetchStockData(symbol), 3000).catch(() => null) : null;
 return judgmentFallback(symbol.toUpperCase(), quote);
}
function badSymbol(res: Response) { return res.status(400).json({ message: "올바른 종목 코드를 입력해주세요." }); }
export const getJudgment = async (req: Request, res: Response) => {
 if (!validSymbol(req.params.symbol)) return badSymbol(res);
 try { return res.json(await proxy("GET", "/judgment/" + req.params.symbol)); }
 catch (error) {
  if (!canFallback(error)) return res.status(502).json({ message: "판단 서비스 설정을 확인해주세요." });
  return res.json(await fallback(req.params.symbol));
 }
};
export const compareJudgment = async (req: Request, res: Response) => {
 const { symbol, user_judge } = req.body;
 if (!validSymbol(symbol)) return badSymbol(res);
 if (!["매수", "매도", "관망"].includes(user_judge)) return res.status(400).json({ message: "판단은 매수·매도·관망 중에서 선택해주세요." });
 try { return res.json(await proxy("POST", "/judgment/compare", { symbol, user_judge })); }
 catch (error) {
  if (!canFallback(error)) return res.status(502).json({ message: "판단 서비스 설정을 확인해주세요." });
  const result = await fallback(symbol);
  return res.json({ user_judge, ai_judge: result.judge, ai_probabilities: result.probabilities,
   explanation: result.summary + (result.data_available ? (user_judge === result.judge ? " 선택한 판단과 같은 방향입니다." : " 선택한 판단과 달라 근거를 비교해보세요.") : ""),
   highlighted_factors: result.factors.map(x => x.factor), source: "rule-based", fallback_used: true });
 }
};
export const judgmentHistory = async (req: Request, res: Response) => {
 if (!validSymbol(req.params.symbol)) return badSymbol(res);
 const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
 try { return res.json(await proxy("GET", "/judgment/" + req.params.symbol + "/history", undefined, { limit })); }
 catch (error) {
  if (!canFallback(error)) return res.status(502).json({ message: "판단 이력을 조회하지 못했습니다." });
  // Never invent persisted history when the service/database is unavailable.
  res.setHeader("X-Analysis-Source", "rule-based");
  return res.json([]);
 }
};
export const watchJudgment = async (req: Request, res: Response) => {
 if (!validSymbol(req.params.symbol)) return badSymbol(res);
 try { return res.json(await proxy(req.method, "/judgment/" + req.params.symbol + "/watch")); }
 catch (error) {
  if (!canFallback(error)) return res.status(502).json({ message: "판단 서비스 설정을 확인해주세요." });
  return res.json({ status: "fallback", watching: false, source: "rule-based" });
 }
};
export const judgmentHealth = async (_req: Request, res: Response) => {
 try { return res.json(await proxy("GET", "/health")); }
 catch { return res.json({ status: "degraded", fallback_available: true }); }
};
