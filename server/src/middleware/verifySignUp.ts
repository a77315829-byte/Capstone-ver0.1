import { NextFunction, Request, Response } from "express";
import User from "../models/user.model";

const checkDuplicateUsername = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	// Username
	User.findOne({
		username: req.body.username,
	})
		.then((user) => {
			if (user) {
				res.status(400).send({ message: "Username is already in use" });
				return;
			}
			next();
		})
		.catch((err) => {
			res.status(503).send({ message: "회원정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." });
		});
};

const verifySignUp = {
	checkDuplicateUsername,
};

export default verifySignUp;
