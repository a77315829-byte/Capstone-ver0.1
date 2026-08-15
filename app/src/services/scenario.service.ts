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
                    ? { start_date: startDate }
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