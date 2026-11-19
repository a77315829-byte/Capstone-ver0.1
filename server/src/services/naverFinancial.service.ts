import axios from "axios";
import { financialNumber } from "../utils/financialData";
import type { FinancialPeriodSummary } from "./dartStockDetail.service";

// Public Npay financial statements. Only reported periods, never consensus.
export function parseNaverFinancials(payload: any, symbol: string): FinancialPeriodSummary[] {
 if (payload?.itemCode !== symbol || !Array.isArray(payload.financeInfo?.trTitleList) || !Array.isArray(payload.financeInfo?.rowList)) return [];
 const rows = payload.financeInfo.rowList;
 const value = (title: string, key: string, scale = 1) => {
  const n = financialNumber(rows.find((row: any) => row.title === title)?.columns?.[key]?.value);
  return n === null ? null : n * scale;
 };
 return payload.financeInfo.trTitleList
  .filter((period: any) => period.isConsensus === "N" && /^\d{6}$/.test(period.key))
  .sort((a: any, b: any) => b.key.localeCompare(a.key))
  .map((period: any) => ({
   period: `${period.key.slice(0,4)}.${period.key.slice(4,6)}`,
   revenue: value("매출액", period.key, 100_000_000),
   operatingProfit: value("영업이익", period.key, 100_000_000),
   netIncome: value("당기순이익", period.key, 100_000_000),
   operatingMargin: value("영업이익률", period.key), roe: value("ROE", period.key),
  }))
  .filter((period: FinancialPeriodSummary) => period.revenue !== null || period.netIncome !== null);
}

export async function fetchNaverFinancials(symbol: string) {
 if (!/^\d{6}$/.test(symbol)) return null;
 const periods = await Promise.all(["annual", "quarter"].map(async period => {
  try {
   const response = await axios.get(`https://m.stock.naver.com/api/stock/${symbol}/finance/${period}`, { timeout: 6000 });
   return parseNaverFinancials(response.data, symbol);
  } catch { return []; }
 }));
 if (!periods.some(rows => rows.length)) return null;
 return { annualFinancials: periods[0], quarterlyFinancials: periods[1] };
}
