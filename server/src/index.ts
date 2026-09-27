import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import app from "./app";
import "./utils/db";
import { swaggerDocs } from "./utils/swagger";

const PORT = Number(process.env.PORT) || 3010;
const HOST = process.env.STOTRA_SERVER_HOST?.trim() || "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
	console.log(`ANTITUDE API listening at http://${HOST}:${PORT}`);
	void swaggerDocs(app, PORT);
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals): void => {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`${signal} received; stopping ANTITUDE API.`);

	server.close(() => {
		void mongoose.disconnect().finally(() => process.exit(0));
	});

	setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
