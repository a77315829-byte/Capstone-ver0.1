import "../utils/runtime";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import axios from "axios";
import User from "../models/user.model";
async function validateTurnstile(token: unknown) {
 if (process.env.AUTH_CAPTCHA_MODE === "disabled") return;
 const secret = process.env.STOTRA_TURNSTILE_SECRET;
 if (!secret || typeof token !== "string" || !token) throw new Error("CAPTCHA_REQUIRED");
 const response = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
  { secret, response: token }, { timeout: 10000 });
 if (!response.data.success) throw new Error("CAPTCHA_INVALID");
}
const signup = async (req: Request, res: Response) => {
 try { await validateTurnstile(req.body["cf-turnstile-response"]); }
 catch { return res.status(400).json({ message: "자동입력 방지 확인을 다시 진행해주세요." }); }
 try {
  await User.create({ username: req.body.username, password: await bcrypt.hash(req.body.password, 12),
   watchlist: [], ledger: [], positions: [], cash: 10_000_000 });
  return res.status(201).json({ message: "회원가입이 완료되었습니다." });
 } catch (error: any) {
  if (error?.code === 11000) return res.status(409).json({ message: "이미 사용 중인 아이디입니다." });
  return res.status(503).json({ message: "회원정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." });
 }
};
const login = async (req: Request, res: Response) => {
 try { await validateTurnstile(req.body["cf-turnstile-response"]); }
 catch { return res.status(400).json({ message: "자동입력 방지 확인을 다시 진행해주세요." }); }
 try {
  const user = await User.findOne({ username: req.body.username });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
   return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }
  const secret = process.env.STOTRA_JWT_SECRET;
  if (!secret) return res.status(503).json({ message: "서버 인증 설정을 확인해주세요." });
  const token = jwt.sign({ id: user.id }, secret, { algorithm: "HS256", expiresIn: "8h" });
  return res.json({ id: user._id, username: user.username, accessToken: token });
 } catch { return res.status(503).json({ message: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해주세요." }); }
};
export default { signup, login };
