export type FinancialPeriod = {
 period: string;
 revenue?: number | null;
 operatingProfit?: number | null;
 netIncome?: number | null;
 operatingMargin?: number | null;
 roe?: number | null;
};

export function financialColumns(periods: FinancialPeriod[], mode: "annual" | "quarter") {
 const current = periods[0];
 const year = current?.period.match(/^\d{4}/)?.[0];
 const priorYearPeriod = year ? current.period.replace(year, String(Number(year) - 1)) : undefined;
 return [current, periods[1], mode === "annual" ? periods[2] : periods.find(row => row.period === priorYearPeriod)];
}
