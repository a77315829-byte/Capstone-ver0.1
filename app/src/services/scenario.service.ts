import api from "./api.service";

export type ScenarioAnswer = {
	question_id: string;
	selected: string[];
	text: string;
};

export type ScenarioSession = {
	session_id: string;
	user_id: string;
	scenario_id: string;
	scenario_version?: number;
	status?: string;
	current_turn?: number;
	started_at?: string;
	completed_at?: string | null;
	final_evaluation_id?: string | null;
};

export type ScenarioProgressItem = {
	scenario_id: string;
	title: string;
	status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
	session_id: string | null;
	current_turn: number;
	total_turns: number;
	completed_turns: number;
	progress_percent: number;
	updated_at: string | null;
};

export type ScenarioUserProgress = {
	active: ScenarioProgressItem | null;
	completed_count: number;
	total_count: number;
	overall_progress_percent: number;
	items: ScenarioProgressItem[];
};

export type LearningPatternChange = {
	pattern_code: string;
	label: string;
	previous_occurrence_count: number;
	current_occurrence_count: number;
	previous_evidence_turns: number[];
	current_evidence_turns: number[];
	recommendation: string;
};

export type ScenarioLearningProgress = {
	attempt_no: number;
	status: "FIRST_ATTEMPT" | "COMPARABLE" | "VERSION_MISMATCH" | "INSUFFICIENT_DATA";
	previous_evaluation_id: string | null;
	previous_completed_at: string | null;
	score_delta: number | null;
	score_delta_pct_points: number | null;
	repeated_patterns: LearningPatternChange[];
	improved_patterns: LearningPatternChange[];
	new_patterns: LearningPatternChange[];
	metric_changes: Array<{ metric: string; previous_score: number; current_score: number; delta: number }>;
	summary: string;
};

export type ScenarioEvaluationSummary = {
	evaluation_id: string;
	session_id: string;
	scenario_id: string;
	scenario_version: number;
	completed_at: string;
	evaluator_version?: string;
	overall_score: number | null;
	metric_averages?: Record<string, number>;
	summary: string;
	repeated_patterns: string[];
	learning_progress?: ScenarioLearningProgress;
};

const unwrap = <T>(payload: any): T => payload?.data ?? payload;

const scenarioService = {
	async getScenarios() {
		const response = await api.get("/scenario-service/scenarios");
		return unwrap(response.data);
	},

	async createSession(
		scenarioId: string,
		userId: string,
	): Promise<ScenarioSession> {
		const response = await api.post(
			`/scenario-service/scenarios/${scenarioId}/sessions`,
			{
				user_id: userId,
			},
		);

		return unwrap<ScenarioSession>(response.data);
	},

	async getUserProgress(userId: string): Promise<ScenarioUserProgress> {
		const response = await api.get(
			`/scenario-service/users/${encodeURIComponent(userId)}/scenario-progress`,
		);

		return unwrap<ScenarioUserProgress>(response.data);
	},

	async getEvaluations(userId: string): Promise<ScenarioEvaluationSummary[]> {
		const response = await api.get(`/scenario-service/users/${encodeURIComponent(userId)}/evaluations`);
		return unwrap<ScenarioEvaluationSummary[]>(response.data);
	},

	async getEvaluation(userId: string, evaluationId: string) {
		const response = await api.get(`/scenario-service/users/${encodeURIComponent(userId)}/evaluations/${encodeURIComponent(evaluationId)}`);
		return unwrap(response.data);
	},

	async getCurrentTurn(sessionId: string) {
		const response = await api.get(
			`/scenario-service/sessions/${sessionId}/turn`,
		);

		return unwrap(response.data);
	},

	async getChart(
		sessionId: string,
		assetId: string,
		startDate?: string,
	) {
		const response = await api.get(
			`/scenario-service/sessions/${sessionId}/chart/${assetId}`,
			{
				params: startDate
					? {
							start_date: startDate,
						}
					: undefined,
			},
		);

		return unwrap(response.data);
	},

	async placeOrder(
		sessionId: string,
		assetId: string,
		side: "BUY" | "SELL",
		quantity: number,
	) {
		const response = await api.post(
			`/scenario-service/sessions/${sessionId}/orders`,
			{
				asset_id: assetId,
				side,
				quantity,
			},
		);

		return unwrap(response.data);
	},

	async submitTurn(
		sessionId: string,
		answers: ScenarioAnswer[],
	) {
		const response = await api.post(
			`/scenario-service/sessions/${sessionId}/turn/submit`,
			{
				answers,
			},
		);

		return unwrap(response.data);
	},

	async getResult(sessionId: string) {
		const response = await api.get(
			`/scenario-service/sessions/${sessionId}/result`,
		);

		return unwrap(response.data);
	},

	async finalize(sessionId: string) {
		const response = await api.post(
			`/scenario-service/sessions/${sessionId}/finalize`,
		);

		return unwrap(response.data);
	},
};

export default scenarioService;
