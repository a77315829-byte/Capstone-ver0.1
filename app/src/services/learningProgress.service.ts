import api from "./api.service";

export type QuizProgressSnapshot = {
	answeredQuizIds: string[];
	attemptCount: number;
	correctAttemptCount: number;
	completedSessions: number;
	updatedAt: string | null;
};

export type QuizProgressSummary = QuizProgressSnapshot & {
	answeredCount: number;
	totalQuizCount: number;
	progressPercent: number;
	accuracyPercent: number;
};

const STORAGE_PREFIX = "antitude:quiz-progress";

function makeStorageKey(userId: string): string {
	return `${STORAGE_PREFIX}:${userId || "guest"}`;
}

function emptySnapshot(): QuizProgressSnapshot {
	return {
		answeredQuizIds: [],
		attemptCount: 0,
		correctAttemptCount: 0,
		completedSessions: 0,
		updatedAt: null,
	};
}

function unwrap<T>(payload: any): T {
	return (payload?.data ?? payload) as T;
}

function readLocalSnapshot(userId: string): QuizProgressSnapshot {
	if (typeof window === "undefined") {
		return emptySnapshot();
	}

	try {
		const raw = window.localStorage.getItem(makeStorageKey(userId));
		if (!raw) return emptySnapshot();

		const parsed = JSON.parse(raw) as Partial<QuizProgressSnapshot>;
		return {
			answeredQuizIds: Array.isArray(parsed.answeredQuizIds)
				? Array.from(new Set(parsed.answeredQuizIds.filter(Boolean)))
				: [],
			attemptCount: Math.max(0, Number(parsed.attemptCount ?? 0)),
			correctAttemptCount: Math.max(
				0,
				Number(parsed.correctAttemptCount ?? 0),
			),
			completedSessions: Math.max(
				0,
				Number(parsed.completedSessions ?? 0),
			),
			updatedAt: parsed.updatedAt ?? null,
		};
	} catch {
		return emptySnapshot();
	}
}

function writeLocalSnapshot(userId: string, value: QuizProgressSnapshot): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(makeStorageKey(userId), JSON.stringify(value));
		window.dispatchEvent(
			new CustomEvent("antitude:quiz-progress-updated", {
				detail: { userId, value },
			}),
		);
	} catch {
		// 로컬 캐시는 보조 수단이므로 저장 실패가 퀴즈 자체를 막지 않습니다.
	}
}

function toSummary(
	snapshot: QuizProgressSnapshot,
	totalQuizCount: number,
): QuizProgressSummary {
	const answeredCount = snapshot.answeredQuizIds.length;
	const safeTotal = Math.max(0, Number(totalQuizCount || 0));

	return {
		...snapshot,
		answeredCount,
		totalQuizCount: safeTotal,
		progressPercent:
			safeTotal > 0
				? Math.min(100, Math.round((answeredCount / safeTotal) * 100))
				: 0,
		accuracyPercent:
			snapshot.attemptCount > 0
				? Math.round(
						(snapshot.correctAttemptCount / snapshot.attemptCount) * 100,
					)
				: 0,
	};
}

function snapshotFromServer(raw: any): QuizProgressSnapshot {
	return {
		answeredQuizIds: Array.isArray(raw?.answered_quiz_ids)
			? raw.answered_quiz_ids
			: Array.isArray(raw?.answeredQuizIds)
				? raw.answeredQuizIds
				: [],
		attemptCount: Number(raw?.attempt_count ?? raw?.attemptCount ?? 0),
		correctAttemptCount: Number(
			raw?.correct_attempt_count ?? raw?.correctAttemptCount ?? 0,
		),
		completedSessions: Number(
			raw?.completed_sessions ?? raw?.completedSessions ?? 0,
		),
		updatedAt: raw?.updated_at ?? raw?.updatedAt ?? null,
	};
}

export function getCachedQuizProgress(
	userId: string,
	totalQuizCount: number,
): QuizProgressSummary {
	return toSummary(readLocalSnapshot(userId), totalQuizCount);
}

export async function fetchQuizProgress(
	userId: string,
	totalQuizCount: number,
): Promise<QuizProgressSummary> {
	try {
		const response = await api.get(
			`/scenario-service/users/${encodeURIComponent(userId)}/quiz-progress`,
			{
				params: {
					total_quiz_count: totalQuizCount,
				},
			},
		);
		const raw = unwrap<any>(response.data);
		const snapshot = snapshotFromServer(raw);
		writeLocalSnapshot(userId, snapshot);

		return {
			...toSummary(snapshot, totalQuizCount),
			answeredCount: Number(
				raw?.answered_count ?? snapshot.answeredQuizIds.length,
			),
			progressPercent: Number(
				raw?.progress_percent ??
					toSummary(snapshot, totalQuizCount).progressPercent,
			),
			accuracyPercent: Number(
				raw?.accuracy_percent ??
					toSummary(snapshot, totalQuizCount).accuracyPercent,
			),
		};
	} catch (error) {
		console.warn("퀴즈 진행도 서버 조회 실패, 로컬 캐시 사용:", error);
		return getCachedQuizProgress(userId, totalQuizCount);
	}
}

export async function recordQuizResult(
	userId: string,
	quizId: string,
	isCorrect: boolean,
): Promise<void> {
	const current = readLocalSnapshot(userId);
	const answered = new Set(current.answeredQuizIds);
	answered.add(quizId);

	const optimistic: QuizProgressSnapshot = {
		answeredQuizIds: Array.from(answered),
		attemptCount: current.attemptCount + 1,
		correctAttemptCount:
			current.correctAttemptCount + (isCorrect ? 1 : 0),
		completedSessions: current.completedSessions,
		updatedAt: new Date().toISOString(),
	};
	writeLocalSnapshot(userId, optimistic);

	try {
		const response = await api.post(
			`/scenario-service/users/${encodeURIComponent(userId)}/quiz-progress/events`,
			{
				quiz_id: quizId,
				is_correct: isCorrect,
				session_completed: false,
			},
		);
		const snapshot = snapshotFromServer(unwrap<any>(response.data));
		writeLocalSnapshot(userId, snapshot);
	} catch (error) {
		console.warn("퀴즈 결과 DB 저장 실패, 로컬 캐시 유지:", error);
	}
}

export async function recordQuizSessionCompleted(
	userId: string,
): Promise<void> {
	const current = readLocalSnapshot(userId);
	const optimistic: QuizProgressSnapshot = {
		...current,
		completedSessions: current.completedSessions + 1,
		updatedAt: new Date().toISOString(),
	};
	writeLocalSnapshot(userId, optimistic);

	try {
		const response = await api.post(
			`/scenario-service/users/${encodeURIComponent(userId)}/quiz-progress/events`,
			{
				quiz_id: null,
				is_correct: null,
				session_completed: true,
			},
		);
		const snapshot = snapshotFromServer(unwrap<any>(response.data));
		writeLocalSnapshot(userId, snapshot);
	} catch (error) {
		console.warn("퀴즈 세션 완료 DB 저장 실패, 로컬 캐시 유지:", error);
	}
}