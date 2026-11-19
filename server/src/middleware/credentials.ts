import { Request, Response, NextFunction } from "express";
// Validate before MongoDB queries: objects such as {$ne: null} are never usernames.
export function validateCredentials(req: Request, res: Response, next: NextFunction) {
 const { username, password } = req.body ?? {};
 if (typeof username !== "string" || typeof password !== "string" ||
  !username.trim() || username.trim().length > 40 || /[\x00-\x1f\x7f]/.test(username) ||
  !password || Buffer.byteLength(password, "utf8") > 72) {
  return res.status(400).json({ message: "아이디와 비밀번호 형식을 확인해주세요. 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다." });
 }
 req.body.username = username.trim();
 if (req.path.endsWith("/signup") && (username.trim().length < 3 || password.length < 8)) {
  return res.status(400).json({ message: "아이디는 3~40자, 비밀번호는 8자 이상으로 입력해주세요." });
 }
 next();
}
