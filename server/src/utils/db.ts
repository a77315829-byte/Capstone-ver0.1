import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const username = process.env.STOTRA_MONGODB_USERNAME;
const password = process.env.STOTRA_MONGODB_PASSWORD;
const cluster = process.env.STOTRA_MONGODB_CLUSTER;
const databaseName = process.env.MONGO_DB_NAME;

if (!username) {
	throw new Error("STOTRA_MONGODB_USERNAME이 .env에 없습니다.");
}

if (!password) {
	throw new Error("STOTRA_MONGODB_PASSWORD가 .env에 없습니다.");
}

if (!cluster) {
	throw new Error("STOTRA_MONGODB_CLUSTER가 .env에 없습니다.");
}

if (!databaseName) {
	throw new Error("MONGO_DB_NAME이 .env에 없습니다.");
}

const uri =
	`mongodb+srv://${encodeURIComponent(username)}` +
	`:${encodeURIComponent(password)}` +
	`@${cluster}` +
	`/?authMechanism=DEFAULT&retryWrites=true&w=majority`;

mongoose
	.connect(uri, {
		dbName: databaseName,
	})
	.catch((error) => {
		console.error("MongoDB connection failed:", error);
	});

const db = mongoose.connection;

db.on("error", (error) => {
	console.error("MongoDB connection error:", error);
});

db.once("open", () => {
	console.log(`Connected to MongoDB database: ${databaseName}`);
});

module.exports = db;