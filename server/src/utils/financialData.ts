export function financialNumber(value: unknown): number | null {
 if (value === null || value === undefined || typeof value === "boolean") return null;
 const text = String(value).trim().replace(/,/g, "");
 if (!text) return null;
 const number = Number(text);
 return Number.isFinite(number) ? number : null;
}

// A temporary provider failure must not hide recovered financials for six hours.
export function financialCacheTtlMs(data: any): number {
 return [data.roe, data.revenue, data.operatingProfit].every(value => financialNumber(value) !== null)
  ? 6 * 60 * 60 * 1000 : 60 * 1000;
}

export function dartAnnualPeriod(range: unknown, year: number): string {
 const dates = String(range ?? "").match(/\d{4}[.-]\d{2}[.-]\d{2}/g);
 return dates?.length ? dates[dates.length - 1].slice(0, 7).replace(/-/g, ".") : String(year);
}

export function dartQuarterAmount(account: any): number | null {
 // thstrm_add_amount is year-to-date; it must never be shown as one quarter.
 return financialNumber(account?.thstrm_amount);
}

export function mergeReportedPeriods<T extends { period: string }>(primary: T[], secondary: T[]): T[] {
 const rows = new Map(secondary.map(row => [row.period, { ...row }]));
 for (const row of primary) {
  const merged: any = { ...rows.get(row.period) };
  for (const [key, value] of Object.entries(row)) if (value != null || merged[key] == null) merged[key] = value;
  rows.set(row.period, merged);
 }
 return [...rows.values()].sort((a, b) => b.period.localeCompare(a.period));
}
