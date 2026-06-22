export type FinanceDifficulty = "초급" | "중급";

export type FinanceQuizType =
	| "definition"
	| "concept"
	| "scenario"
	| "comparison"
	| "calculation";

export interface FinanceTerm {
	id: string;
	term: string;
	category: string;
	difficulty: FinanceDifficulty;
	shortDefinition: string;
	description: string;
	example: string;
	keyPoints: string[];
	caution: string;
	relatedTerms: string[];
}

export interface FinanceQuiz {
	id: string;
	category: string;
	difficulty: FinanceDifficulty;
	type: FinanceQuizType;
	question: string;
	options: string[];
	answerIndex: number;
	explanation: string;
	relatedTermId: string;
}
