import crypto from "crypto";

interface CreateCommunityAuthorCodeInput {
	userId: string;
	boardKey: string;
	date?: Date;
}

/*
 * 실제 접속 IP를 저장하거나 공개하지 않습니다.
 * 사용자 ID + 게시판 범위 + 월 + 서버 비밀키로
 * IP처럼 보이는 가상 식별코드를 생성합니다.
 */
export function createCommunityAuthorCode({
	userId,
	boardKey,
	date = new Date(),
}: CreateCommunityAuthorCodeInput): string {
	const secret =
		process.env.COMMUNITY_CODE_SECRET ||
		"change-this-community-secret";

	const monthlyKey = [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
	].join("-");

	const source = [
		userId,
		boardKey,
		monthlyKey,
	].join(":");

	const hash = crypto
		.createHmac("sha256", secret)
		.update(source)
		.digest();

	/*
	 * 0.0처럼 지나치게 단순한 값은 피하고
	 * 1~254 범위의 두 숫자를 사용합니다.
	 */
	const first = ((hash[0] ?? 0) % 254) + 1;
	const second = ((hash[1] ?? 0) % 254) + 1;

	return `${first}.${second}`;
}
