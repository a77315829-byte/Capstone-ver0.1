import { randomUUID } from "crypto";
type Quote = { price?: number; changeRate?: number; fetchedAt?: string; [key: string]: unknown } | null;
const POSITIVE = ["실적 개선", "실적 증가", "이익 증가", "공급 확대", "수요 증가", "호실적", "흑자", "수주", "업황 회복"];
const NEGATIVE = ["실적 감소", "이익 감소", "수요 감소", "적자", "리콜", "파산", "공급 차질", "매출 감소", "규제 강화"];
export function marketFallback(stock: { code: string; name: string; market?: string; currency?: string; exchange?: string }, text: string, hint: string | null, quote: Quote) {
 const positive = POSITIVE.filter(word => text.includes(word));
 const negative = NEGATIVE.filter(word => text.includes(word));
 const ambiguous = /않|아니|부인|취소|불확실/.test(text);
 const score = ambiguous ? 0 : positive.length - negative.length;
 const direction = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
 const label = score > 0 ? "긍정" : score < 0 ? "부정" : "중립";
 const risk = "단순 키워드 규칙은 사실 확인·문맥·공시 검색을 수행하지 않습니다. 실제 가격 예측이 아닙니다.";
 const roles = [
  ["individual_investor", "개인 투자자", 1, 1], ["institutional_investor", "기관 투자자", 1.5, 2],
  ["foreign_investor", "외국인 투자자", 1.5, 2], ["short_term_investor", "단기 투자자", 1, 1],
  ["long_term_investor", "장기 투자자", 1, 2],
 ] as const;
 const agents = roles.map(([type, name, weight, threshold]) => {
  const reaction = score >= threshold ? "buy" : score <= -threshold ? "sell" : "hold";
  return { agent_type: type, agent_name_ko: name, reaction_direction: reaction,
   reaction_direction_ko: { buy: "매수", sell: "매도", hold: "관망" }[reaction],
   reaction_strength: "low", reaction_strength_ko: "낮음", base_weight: weight, input_relevance: "low",
   key_reasons: [...positive.map(x => "긍정 키워드: " + x), ...negative.map(x => "부정 키워드: " + x),
    ...(ambiguous ? ["부정·불확실 표현이 있어 방향 판단을 보류합니다."] : [])],
   comment: name + " 관점의 규칙 기반 학습 예시입니다. 추가 근거를 확인하세요.", risk_factors: [risk] };
 });
 const total = roles.reduce((sum, role) => sum + role[2], 0);
 const pressureFor = (action: string) => Math.round(agents.filter(x => x.reaction_direction === action).reduce((sum, x) => sum + x.base_weight, 0) / total * 100);
 const buy = pressureFor("buy"), sell = pressureFor("sell"), hold = 100 - buy - sell;
 const dominant = hold >= buy && hold >= sell ? "hold" : buy >= sell ? "buy" : "sell";
 const hasQuote = typeof quote?.price === "number" && quote.price > 0;
 const explanation = "규칙 기반 대체 분석: AI 서비스 연결 없이 입력의 긍정·부정 키워드를 비교했습니다. " + risk;
 return {
  status: "ok", simulation_id: randomUUID(), selected_stock: stock, input_text: text,
  input_type: hint || "unknown",
  impact_analysis: { impact_direction: direction, impact_direction_ko: label, impact_strength: "low",
   impact_strength_ko: "낮음", related_industries: [], time_horizon: "short_term", time_horizon_ko: "단기",
   key_keywords: [...positive, ...negative] },
  current_stock_context: { ...stock, market: stock.market || "KR", currency: stock.currency || "KRW", industry: "확인되지 않음", current_price: hasQuote ? quote!.price : null,
   daily_change_rate: hasQuote ? quote!.changeRate ?? null : null, volume_trend: "stable",
   market_cap_trillion: null, data_source: hasQuote ? "external_api" : "unknown", is_realtime: false,
   observed_at: hasQuote ? quote!.fetchedAt ?? null : null },
  market_pressure: { buy, sell, hold, dominant, headline: "규칙별 반응 비중 · 실제 시장 예측 아님" },
  market_sentiment: { code: direction, label_ko: label, one_liner: "입력 키워드에 한정한 반응입니다." },
  analysis_confidence: { score: 0, grade: "low", grade_ko: "낮음", explanation: "예측 정확도를 검증한 신뢰도 점수가 없습니다." },
  uncertainty_factors: [risk, ...(hasQuote ? [] : ["현재 시세를 확보하지 못했습니다."])],
  agent_reactions: agents, overall_explanation: explanation,
  meta: { llm_model: "rule-based", llm_status: "fallback", fallback_used: true,
   fallback_modules: ["node_rules"], stock_data_source: hasQuote ? "external_api" : "unknown",
   db_save_status: "not_used", rag_sources: [] }, created_at: new Date().toISOString()
 };
}
export function judgmentFallback(symbol: string, quote: Quote) {
 const hasQuote = typeof quote?.price === "number" && quote.price > 0 && Number.isFinite(quote.changeRate);
 const change = hasQuote ? Number(quote!.changeRate) : 0;
 const judge = hasQuote && change >= 1 && change < 3 ? "매수" : hasQuote && change <= -1 ? "매도" : "관망";
 const probabilities = judge === "매수" ? { 매수: 50, 매도: 10, 관망: 40 } :
  judge === "매도" ? { 매수: 10, 매도: 50, 관망: 40 } : { 매수: 0, 매도: 0, 관망: 100 };
 return { symbol, judge, confidence: 0, probabilities,
  summary: hasQuote ? `규칙 기반 대체 분석: 관측 등락률 ${change.toFixed(2)}%를 단순 구간으로 분류했습니다. 비중은 규칙 점수이며 수익 확률이 아닙니다. 공시·뉴스를 추가 확인하세요.` :
   "규칙 기반 대체 분석: 시세 자료가 없어 판단을 보류합니다. 관망 100%는 데이터 부족 표시이며 예측 확률이 아닙니다.",
  factors: hasQuote ? [{ factor: "관측 등락률", direction: change >= 0 ? "긍정" : "부정", weight: 1 }] : [],
  computed_at: new Date().toISOString(), source: "rule-based", fallback_used: true,
  data_available: hasQuote, observed_at: hasQuote ? quote!.fetchedAt ?? null : null };
}
