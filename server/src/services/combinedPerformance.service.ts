import { getPortfolio } from './trading.service';
import { getUsPortfolio } from './usTrading.service';
import { getExchangeRate } from './fxRate.service';
import Order from '../models/tradeOrder.model';
import UsOrder from '../models/usTradeOrder.model';
import Funding from '../models/fundingTransaction.model';
import { externalCapital, combinedHoldingPerformance } from '../utils/accountPerformance';
import HoldingPerformance from '../models/holdingPerformance.model';

export async function getCombinedPerformance(userId: string) {
 const domestic = await getPortfolio(userId, { evaluate: true, performance: true });
 try {
  const [us, funding, krFirst, usRows] = await Promise.all([
   getUsPortfolio(userId, { evaluate: true }),
   Funding.find({ userId }).sort({ createdAt: 1 }).select('market type amount createdAt').lean(),
   Order.findOne({ userId, status: 'FILLED' }).sort({ executedAt: 1, createdAt: 1 }).select('createdAt executedAt').lean(),
   UsOrder.aggregate([{ $match: { userId, status: 'FILLED' } }, { $group: {
    _id: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$executedAt', '$createdAt'] }, timezone: 'Asia/Seoul' } },
    profit: { $sum: { $cond: [{ $eq: ['$side', 'SELL'] }, '$realizedProfit', 0] } }, count: { $sum: 1 },
   } }, { $sort: { _id: 1 } }]),
  ]);
  const hasUs = usRows.length > 0 || us.account.totalAsset !== 0 || us.account.totalProfitLoss !== 0 || us.account.totalDeposits !== 0;
  const exchangeRate = hasUs ? await getExchangeRate() : null;
  const rate = exchangeRate?.rate ?? 0; // No invented rate: zero USD exposure needs no conversion.
  const krCapital = externalCapital(domestic.account.initialCash, domestic.account.totalDeposits, funding.filter(f => f.market === 'KR'));
  const usCapital = externalCapital(us.account.initialCash, us.account.totalDeposits, funding.filter(f => f.market === 'US'));
  const investedCapital = krCapital + usCapital * rate;
  const totalProfitLoss = domestic.account.totalProfitLoss + us.account.totalProfitLoss * rate;
  const held = combinedHoldingPerformance(domestic.account.totalBuyAmount, domestic.account.totalEvaluationAmount,
   us.account.totalBuyAmount, us.account.totalEvaluationAmount, rate);
  const isEvaluated = domestic.account.isEvaluated && us.holdings.every(h => h.isEvaluated);
  const observedAt = new Date();
  const date = observedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  let holdingsHistory: { date: string; profit: number; rate: number | null; buyAmount: number; observedAt: Date }[] = [];
  let historyWarning: string | null = null;
  try {
   if (isEvaluated && !exchangeRate?.stale) {
    await HoldingPerformance.updateOne({ userId, date }, { $set: { ...held, observedAt } }, { upsert: true });
   }
   holdingsHistory = await HoldingPerformance.find({ userId }).sort({ date: 1 }).select('date profit rate buyAmount observedAt -_id').lean();
  } catch {
   historyWarning = '보유 수익률 기록을 저장·조회하지 못했습니다. 현재 평가금액은 아래에 표시됩니다.';
  }
  const days = new Map<string, number>();
  for (const day of domestic.performance?.history ?? []) days.set(day.date, (days.get(day.date) ?? 0) + day.profit);
  for (const day of usRows) days.set(day._id, (days.get(day._id) ?? 0) + day.profit * rate);
  const firstDates = [funding[0]?.createdAt, krFirst?.executedAt || krFirst?.createdAt, usRows[0]?._id]
   .filter(Boolean).map(value => new Date(value as any).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })).sort();
  return { domestic, combined: {
   currency: 'KRW', totalAsset: domestic.account.totalAsset + us.account.totalAsset * rate,
   totalProfitLoss, totalProfitLossRate: investedCapital > 0 ? totalProfitLoss / investedCapital * 100 : 0,
   totalCash: domestic.account.cash + us.account.cash * rate,
   holdingBuyAmount: held.buyAmount, holdingEvaluationAmount: held.evaluationAmount,
   holdingProfitLoss: held.profit, holdingReturnRate: isEvaluated ? held.rate : null,
   realizedProfitLoss: (domestic.performance?.realizedProfit ?? 0) + usRows.reduce((sum, day) => sum + day.profit, 0) * rate,
   holdingsHistory, historyWarning,
   investedCapital, filledTradeCount: (domestic.performance?.filledTradeCount ?? 0) + usRows.reduce((sum, day) => sum + day.count, 0),
   holdingCount: domestic.holdings.length + us.holdings.length,
   isEvaluated,
   history: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, profit]) => ({ date, profit })),
   firstDate: firstDates[0] ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
   exchangeRate, computedAt: new Date().toISOString(),
  }, warning: null };
 } catch {
  return { domestic, combined: null, warning: '미국 계좌 또는 환율을 조회하지 못해 통합 투자성과를 표시할 수 없습니다. 잠시 후 새로고침해 주세요.' };
 }
}
