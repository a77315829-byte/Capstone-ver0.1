import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

import routes from "./routes";

export const createApp = (): express.Express => {
	const app = express();

	app.use(cors());
	app.use(morgan("tiny"));
	app.use(express.json());

	app.use(
		"/api/",
		rateLimit({
			windowMs: 15 * 60 * 1000,
			max: 250,
			standardHeaders: true,
			legacyHeaders: false,
		}),
	);

	app.use(
		"/api/auth/signup",
		rateLimit({
			windowMs: 60 * 60 * 1000,
			max: 5,
			message:
				"Too many accounts created from this IP, please try again after an hour",
			standardHeaders: true,
			legacyHeaders: false,
		}),
	);

	app.use(routes);

	return app;
};

export default createApp();
