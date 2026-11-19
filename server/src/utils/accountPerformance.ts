// Funding (including FX) moves capital; it is not a trading gain or loss.
export function accountPerformance(cash: number, evaluation: number, cost: number,
  initialCash: number, netDeposits: number, capital: number) {
  const totalAsset = cash + evaluation;
  const investedCapital = Math.max(0, capital);
  const totalProfitLoss = totalAsset - initialCash - netDeposits;
  return {
    totalAsset, investedCapital, totalProfitLoss,
    totalProfitLossRate: investedCapital > 0 ? totalProfitLoss / investedCapital * 100 : 0,
    unrealizedProfitLoss: evaluation - cost,
    unrealizedProfitLossRate: cost > 0 ? (evaluation - cost) / cost * 100 : 0,
    adjustedProfit: totalProfitLoss,
    adjustedReturnRate: investedCapital > 0 ? totalProfitLoss / investedCapital * 100 : 0,
  };
}

// Peak net funded principal preserves the return after withdrawal without counting
// the same money again on every KRW -> USD -> KRW round trip. Records are chronological.
export function fundedCapital(initialCash: number, netDeposits: number,
  records: { type: string; amount: number }[]) {
  const flow = (r: { type: string; amount: number }) => r.type === 'FX_OUT' ? -r.amount : r.amount;
  let principal = initialCash + netDeposits - records.reduce((sum, r) => sum + flow(r), 0);
  let peak = Math.max(0, principal);
  for (const record of records) { principal += flow(record); peak = Math.max(peak, principal); }
  return peak;
}

// Combined KR/US performance counts only external funding, not transfers between wallets.
export function externalCapital(initialCash: number, netDeposits: number,
  records: { type: string; amount: number }[]) {
  const knownNet = records.reduce((sum, r) => sum + (r.type === 'FX_OUT' ? -r.amount : r.amount), 0);
  const legacy = initialCash + netDeposits - knownNet;
  return Math.max(0, legacy + records.filter(r => r.type !== 'FX_IN' && r.type !== 'FX_OUT')
    .reduce((sum, r) => sum + r.amount, 0));
}
// Weighted return of positions still held. Cash and realized P/L are excluded.
export function combinedHoldingPerformance(krCost: number, krValue: number, usCost: number, usValue: number, usdKrw: number) {
 const buyAmount = krCost + usCost * usdKrw;
 const evaluationAmount = krValue + usValue * usdKrw;
 const profit = evaluationAmount - buyAmount;
 return { buyAmount, evaluationAmount, profit, rate: buyAmount > 0 ? profit / buyAmount * 100 : null };
}
