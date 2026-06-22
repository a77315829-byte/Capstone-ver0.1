import {
	NextFunction,
	Request,
	Response,
} from "express";
import dotenv from "dotenv";
import jwt, {
	JwtPayload,
} from "jsonwebtoken";

dotenv.config();

const jwtSecret =
	process.env.STOTRA_JWT_SECRET;

export function verifyToken(
	req: Request,
	res: Response,
	next: NextFunction,
): Response | void {
	const authorization =
		req.headers.authorization;

	if (!jwtSecret) {
		console.error(
			"STOTRA_JWT_SECRET 환경변수가 없습니다.",
		);

		return res.status(500).json({
			message:
				"서버 인증 설정이 올바르지 않습니다.",
		});
	}

	if (!authorization) {
		return res.status(401).json({
			message: "로그인이 필요합니다.",
		});
	}

	const [scheme, token] =
		authorization.split(" ");

	if (
		scheme !== "Bearer" ||
		!token
	) {
		return res.status(401).json({
			message:
				"잘못된 인증 헤더 형식입니다.",
		});
	}

	try {
		const decoded = jwt.verify(
			token,
			jwtSecret,
		) as JwtPayload;

		if (!decoded.id) {
			return res.status(401).json({
				message: "토큰에 사용자 ID가 없습니다.",
			});
		}

		const userId = String(
			(decoded as JwtPayload).id,
		);

		(req as any).userId = userId;

		req.body ??= {};
		req.body.userId = userId;

		next();
	} catch (error) {
		return res.status(401).json({
			message: "인증되지 않은 사용자입니다.",
		});
	}
}

export default {
	verifyToken,
};