import { ScenarioDecisionAction, ScenarioStep } from "../models/scenario.model";

export type ScenarioSeed = {
	chapterId: number;
	chapterSlug: string;
	chapterTitle: string;
	chapterDescription: string;
	coreAttitude: string;
	learningGoal: string;
	chapterOrder: number;
	scenarioNo: string;
	scenarioSlug: string;
	title: string;
	eventPeriod: string;
	summary: string;
	background: string;
	difficulty: "쉬움" | "보통" | "어려움";
	estimatedMinutes: number;
	keywords: string[];
	learningPoints: string[];
	decisionOptions: ScenarioDecisionAction[];
	aiEvaluationPoints: string[];
	expectedFeedback: string;
	steps: ScenarioStep[];
	isPublished: boolean;
};

export const scenarioSeeds: ScenarioSeed[] = [
	{
		chapterId: 1,
		chapterSlug: "falling-market-attitude",
		chapterTitle: "떨어질 때의 태도",
		chapterDescription:
			"시장이 급락할 때 공포에 휩쓸리지 않고 하락 원인과 리스크를 분석하는 법을 학습합니다.",
		coreAttitude: "공포 조절",
		learningGoal:
			"급락장에서 감정적인 전량 매도나 무리한 저가 매수를 피하는 기준을 세웁니다.",
		chapterOrder: 1,
		scenarioNo: "1-1",
		scenarioSlug: "covid-crash",
		title: "코로나 팬데믹 초기 폭락",
		eventPeriod: "2020.02 ~ 2020.03",
		summary: "코로나19 확산으로 글로벌 증시가 급락하고 공포 심리가 확산된 상황",
		background:
			"코로나19가 전 세계로 확산되면서 주식시장은 짧은 기간에 큰 폭으로 하락했습니다.",
		difficulty: "쉬움",
		estimatedMinutes: 20,
		keywords: ["급락", "공포", "변동성", "정책 대응"],
		learningPoints: ["공포장 대응", "변동성 판단", "장기 관점"],
		decisionOptions: ["BUY", "SELL", "HOLD"],
		aiEvaluationPoints: [
			"하락 원인을 파악했는지",
			"변동성과 회복 가능성을 함께 고려했는지",
			"전량 매도 또는 무리한 저가 매수를 피했는지",
		],
		expectedFeedback:
			"공포 상황을 인식한 것은 적절하지만, 전량 매도는 회복 가능성을 고려하지 못한 판단일 수 있습니다.",
		steps: [
			{
				stepNumber: 1,
				title: "상황 발생",
				dateLabel: "2020.02",
				marketInfo: {
					indexFlow: "코스피가 글로벌 증시와 함께 빠르게 하락하며 투자심리가 위축됩니다.",
					sectorFlow: "반도체와 성장주가 동시에 약세를 보이고, 일부 방어주는 상대적으로 버팁니다.",
					volatility: "급등",
					volume: "평균 대비 증가",
				},
				stockInfo: {
					symbol: "005930",
					name: "삼성전자",
					price: 42500,
					changeRate: -8.3,
					volume: 29500000,
				},
				marketStocks: [
					{
						symbol: "005930",
						name: "삼성전자",
						price: 42500,
						changeRate: -8.3,
						volume: 29500000,
						sector: "반도체",
						reason: "시장 대표 대형주",
					},
					{
						symbol: "035420",
						name: "NAVER",
						price: 178000,
						changeRate: -6.1,
						volume: 3800000,
						sector: "성장주",
						reason: "급락장 성장주 변동성 확인",
					},
					{
						symbol: "068270",
						name: "셀트리온",
						price: 172500,
						changeRate: -2.4,
						volume: 2100000,
						sector: "바이오",
						reason: "방어적 성격 비교",
					},
				],
				newsCards: [
					{
						title: "코로나19 확산 공포로 글로벌 증시 급락",
						summary:
							"감염 확산과 경기 둔화 우려가 겹치며 위험자산 회피 심리가 강해지고 있습니다.",
						publishedAt: "2020.02",
						source: "Antitude 시나리오 DB",
					},
				],
				eventInfo:
					"초기 충격 구간에서는 뉴스의 공포감과 실제 기업 가치 훼손 여부를 구분해야 합니다.",
				hint: "뉴스 제목만 보지 말고 가격 변화, 거래량, 리스크 요인을 함께 확인하세요.",
				referenceDecision: "HOLD",
				referenceReason:
					"초기 상황에서는 정보가 충분하지 않으므로 성급한 매수·매도보다 관망하며 추가 정보를 확인하는 판단이 적절합니다.",
			},
			{
				stepNumber: 2,
				title: "시장 반응 확대",
				dateLabel: "2020.03",
				marketInfo: {
					indexFlow: "투자자들의 공포 매도가 커지며 지수 낙폭이 확대됩니다.",
					sectorFlow: "대형주도 흔들리지만 유동성 높은 종목부터 거래가 집중됩니다.",
					volatility: "매우 높음",
					volume: "급증",
				},
				stockInfo: {
					symbol: "005930",
					name: "삼성전자",
					price: 40200,
					changeRate: -5.4,
					volume: 36200000,
				},
				marketStocks: [
					{
						symbol: "005930",
						name: "삼성전자",
						price: 40200,
						changeRate: -5.4,
						volume: 36200000,
						sector: "반도체",
						reason: "공포장 내 대형주 수급 확인",
					},
					{
						symbol: "000660",
						name: "SK하이닉스",
						price: 70500,
						changeRate: -7.2,
						volume: 9800000,
						sector: "반도체",
						reason: "동일 업종 낙폭 비교",
					},
					{
						symbol: "105560",
						name: "KB금융",
						price: 32000,
						changeRate: -4.8,
						volume: 5100000,
						sector: "금융",
						reason: "경기 둔화 우려 민감주",
					},
				],
				newsCards: [
					{
						title: "시장 변동성 확대, 저가 매수와 리스크 회피 판단 엇갈림",
						summary:
							"일부 투자자는 낙폭 과대를 보고 매수를 고려하지만, 경기 충격 지속 가능성도 제기됩니다.",
						publishedAt: "2020.03",
						source: "Antitude 시나리오 DB",
					},
				],
				eventInfo:
					"이 단계에서는 단기 가격 변화보다 변화의 원인과 지속 가능성을 판단해야 합니다.",
				hint: "추격매수, 공포매도, 무리한 물타기 중 어떤 심리가 작동하는지 점검하세요.",
				referenceDecision: "HOLD",
				referenceReason:
					"변동성이 확대된 구간에서는 리스크 관리와 정보 확인이 우선입니다.",
			},
			{
				stepNumber: 3,
				title: "판단 시점",
				dateLabel: "2020.03 말",
				marketInfo: {
					indexFlow: "정책 대응 기대가 생기며 급락세가 일부 진정됩니다.",
					sectorFlow: "낙폭이 컸던 대형주와 성장주의 반등 여부가 갈리기 시작합니다.",
					volatility: "완화 중",
					volume: "평균 대비 높음",
				},
				stockInfo: {
					symbol: "005930",
					name: "삼성전자",
					price: 45500,
					changeRate: 3.1,
					volume: 24800000,
				},
				marketStocks: [
					{
						symbol: "005930",
						name: "삼성전자",
						price: 45500,
						changeRate: 3.1,
						volume: 24800000,
						sector: "반도체",
						reason: "정책 기대 반등 대표 종목",
					},
					{
						symbol: "035420",
						name: "NAVER",
						price: 190000,
						changeRate: 4.7,
						volume: 4200000,
						sector: "성장주",
						reason: "비대면 기대와 회복 탄력 비교",
					},
					{
						symbol: "005380",
						name: "현대차",
						price: 73500,
						changeRate: 1.2,
						volume: 3700000,
						sector: "자동차",
						reason: "경기 민감주 회복 속도 비교",
					},
				],
				newsCards: [
					{
						title: "정책 대응 기대 속 시장은 다음 방향을 탐색",
						summary:
							"유동성 공급과 경기 지원책이 논의되면서 투자자들은 반등 지속 가능성을 따져보고 있습니다.",
						publishedAt: "2020.03 말",
						source: "Antitude 시나리오 DB",
					},
				],
				eventInfo:
					"이제 사용자는 매수, 매도, 관망 중 하나를 선택하고 자신의 판단 근거를 설명해야 합니다.",
				hint: "판단 이유에는 뉴스, 가격, 거래량, 리스크, 대안 전략 중 최소 2개 이상을 포함해보세요.",
				referenceDecision: "HOLD",
				referenceReason:
					"초보자 관점에서는 명확한 근거 없이 방향성을 확정하기보다 관망 또는 제한적 접근이 적절합니다.",
			},
		],
		isPublished: true,
	},
];
