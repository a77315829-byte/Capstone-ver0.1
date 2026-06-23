import mongoose from "mongoose";
import dotenv from "dotenv";

import MilitaryProfile from "../models/militaryProfile.model";
import CommunityProfile from "../models/communityProfile.model";
import CommunityPost from "../models/communityPost.model";
import CommunityMonthlyRank from "../models/communityMonthlyRank.model";

const BRANCH_LABELS: Record<string, string> = {
	ARMY: "육군",
	NAVY: "해군",
	AIR_FORCE: "공군",
	MARINE: "해병대",
	SOCIAL_SERVICE: "사회복무요원",
	ETC: "기타",
};

async function run() {
	dotenv.config();

	const uri =
		process.env.MONGODB_URI ??
		process.env.MONGO_URI;

	if (!uri) {
		throw new Error(
			"MONGODB_URI 또는 MONGO_URI가 필요합니다.",
		);
	}

	await mongoose.connect(uri);

	const militaryProfiles =
		await MilitaryProfile.find({})
			.select("userId branch")
			.lean();

	let profileCount = 0;
	let postCount = 0;
	let rankCount = 0;

	for (const military of militaryProfiles) {
		const branch = String(
			military.branch || "ETC",
		);
		const branchName =
			BRANCH_LABELS[branch] ?? "기타";

		await CommunityProfile.updateOne(
			{
				userId: military.userId,
			},
			{
				$set: {
					branch,
				},
				$setOnInsert: {
					userId: military.userId,
					nickname: "ㅇㅇ",
				},
			},
			{
				upsert: true,
			},
		);
		profileCount += 1;

		const postResult =
			await CommunityPost.updateMany(
				{
					authorId: military.userId,
					scope: "division",
				},
				{
					$set: {
						scope: "branch",
						branch,
						branchName,
					},
				},
			);
		postCount +=
			postResult.modifiedCount ?? 0;

		const rankResult =
			await CommunityMonthlyRank.updateMany(
				{
					userId: String(
						military.userId,
					),
					branch: {
						$exists: false,
					},
				},
				{
					$set: {
						branch,
						branchName,
					},
				},
			);
		rankCount +=
			rankResult.modifiedCount ?? 0;
	}

	console.log({
		profileCount,
		postCount,
		rankCount,
	});

	await mongoose.disconnect();
}

run().catch(async (error) => {
	console.error(error);
	await mongoose.disconnect();
	process.exit(1);
});
