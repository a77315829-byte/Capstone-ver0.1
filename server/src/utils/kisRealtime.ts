export interface DomesticTrade {
	type: "trade";
	symbol: string;
	time: number;
	price: number;
	quantity: number;
	cumulativeVolume: number;
	changePrice: number;
	changeRate: number;
	open: number;
	high: number;
	low: number;
}

// KIS dates and execution times are Asia/Seoul, not UTC or the server's timezone.
export function domesticTimestamp(date: string, time = "000000"): number {
	if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(time)) return NaN;
	const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}+09:00`;
	const timestamp = Date.parse(iso);
	if (!Number.isFinite(timestamp)) return NaN;
	const normalized = new Date(timestamp + 9 * 3600 * 1000).toISOString().slice(0, 19).replace(/[-:T]/g, "");
	return normalized === date + time ? timestamp / 1000 : NaN;
}

export function parseDomesticTrades(message: string): DomesticTrade[] {
	const [encoding, trId, countText, body] = message.split("|");
	if (encoding !== "0" || trId !== "H0STCNT0" || !body) return [];
	const count = Number(countText);
	const fields = body.split("^");
	const width = fields.length / count;
	// Older KIS responses have 46 columns; current responses append MARKET_CLS_CODE.
	if (!Number.isInteger(count) || count < 1 || !Number.isInteger(width) || width < 46) return [];
	const trades: DomesticTrade[] = [];
	for (let index = 0; index < count; index++) {
		const row = fields.slice(index * width, (index + 1) * width);
		const value = (position: number) => Number(row[position]);
		const time = domesticTimestamp(row[33], row[1]);
		const price = value(2);
		const quantity = value(12);
		const cumulativeVolume = value(13);
		if (!/^\d[A-Z0-9]{5}$/.test(row[0]) || !Number.isFinite(time) || price <= 0 ||
			!Number.isFinite(price) || quantity < 0 || !Number.isFinite(quantity) ||
			cumulativeVolume < 0 || !Number.isFinite(cumulativeVolume)) continue;
		const sign = ["4", "5"].includes(row[3]) ? -1 : row[3] === "3" ? 0 : 1;
		trades.push({
			type: "trade", symbol: row[0], time, price, quantity, cumulativeVolume,
			changePrice: sign * Math.abs(value(4) || 0),
			changeRate: sign * Math.abs(value(5) || 0),
			open: value(7) || price, high: value(8) || price, low: value(9) || price,
		});
	}
	return trades;
}
