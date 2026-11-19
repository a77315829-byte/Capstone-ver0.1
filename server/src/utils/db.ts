import "./runtime";
import mongoose from "mongoose";
export function mongoUri(): string {
 if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
 const { STOTRA_MONGODB_USERNAME: username, STOTRA_MONGODB_PASSWORD: password,
  STOTRA_MONGODB_CLUSTER: cluster } = process.env;
 if (!username || !password || !cluster) throw new Error("MONGODB_URI 또는 STOTRA_MONGODB_* 설정이 필요합니다.");
 return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/?retryWrites=true&w=majority`;
}
export async function connectDatabase() {
 if (!process.env.MONGO_DB_NAME) throw new Error("MONGO_DB_NAME 설정이 필요합니다.");
 await mongoose.connect(mongoUri(), { dbName: process.env.MONGO_DB_NAME,
  serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
 // Never silently merge/delete existing duplicate users.
 await mongoose.connection.collection("users").createIndex({ username: 1 }, { unique: true });
 return mongoose.connection;
}
