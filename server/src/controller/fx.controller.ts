import { Request, Response } from 'express';
import { getExchangeRate } from '../services/fxRate.service';
import { convertFx, createFxQuote, getFxHistory, getFxWallet } from '../services/fx.service';
const endpoint = (work: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { res.json(await work(req)); }
  catch (error: any) { res.status(error.statusCode || 503).json({ message: error.statusCode ? error.message : '환전 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }); }
};
export default {
  rate: endpoint(() => getExchangeRate()),
  wallet: endpoint(req => getFxWallet((req as any).userId)),
  quote: endpoint(req => createFxQuote((req as any).userId, req.body.direction, req.body.amount)),
  convert: endpoint(req => convertFx((req as any).userId, req.body.quoteId)),
  history: endpoint(req => getFxHistory((req as any).userId)),
};
