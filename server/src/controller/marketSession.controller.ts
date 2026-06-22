import {
	NextFunction,
	Request,
	Response,
} from "express";

import {
	getKrxMarketStatus,
} from "../services/marketSession.service";

export const getKrxStatus = (
	_req: Request,
	res: Response,
) => {
	return res.status(200).json({
		success: true,
		data: getKrxMarketStatus(),
	});
};

export const validateKrxOrderSession = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const market =
		String(
			req.body?.market ??
				"KRX",
		)
			.trim()
			.toUpperCase();

	if (
		![
			"KRX",
			"KOSPI",
			"KOSDAQ",
		].includes(market)
	) {
		return res.status(400).json({
			success: false,
			code:
				"UNSUPPORTED_MARKET",
			message:
				"현재는 국내 주식 주문만 지원합니다.",
		});
	}

	const orderType =
		String(
			req.body?.orderType ??
				"",
		)
			.trim()
			.toUpperCase();

	if (
		orderType !== "MARKET" &&
		orderType !== "LIMIT"
	) {
		return res.status(400).json({
			success: false,
			code:
				"INVALID_ORDER_TYPE",
			message:
				"주문 방식은 MARKET 또는 LIMIT이어야 합니다.",
		});
	}

	const status =
		getKrxMarketStatus();

	req.body ??= {};
	req.body.market = "KRX";

	if (orderType === "LIMIT") {
		req.body.deferExecution =
			!status.isOpen &&
			!status
				.orderAllowedByOverride;

		return next();
	}

	if (
		!status.isOpen &&
		!status
			.orderAllowedByOverride
	) {
		return res.status(409).json({
			success: false,
			code: "MARKET_CLOSED",
			message:
				"시장가 주문은 국내 정규장 운영시간에만 가능합니다. 현재는 지정가 예약 주문을 이용하세요.",
			data: status,
		});
	}

	return next();
};

export default {
	getKrxStatus,
	validateKrxOrderSession,
};
