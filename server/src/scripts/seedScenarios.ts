import dotenv from "dotenv";
import mongoose from "mongoose";

import { scenarioSeeds } from "../data/scenarios";
import Scenario from "../models/scenario.model";

dotenv.config();

const seedScenarios = async () => {
	const mongoUri = process.env.MONGO_URI;

	if (!mongoUri) {
		throw new Error("MONGO_URI가 없습니다. server/.env에 MONGO_URI를 설정하세요.");
	}

	await mongoose.connect(mongoUri);

	await Scenario.deleteMany({});
	await Scenario.insertMany(scenarioSeeds);

	console.log(`Seeded ${scenarioSeeds.length} scenario(s).`);
};

seedScenarios()
	.catch((error) => {
		console.error("Scenario seed failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await mongoose.disconnect();
	});
