import { Request, Response } from 'express';
import { getMarketOverview } from '../services/marketOverview.service';
import { isRankingSort } from '../utils/marketOverview';
export async function marketOverview(req: Request, res: Response) {
  const market = req.query.market || 'KR';
  if (market !== 'KR' && market !== 'US') { res.status(400).json({ message: '지원하지 않는 시장입니다.' }); return; }
  const sort = req.query.sort ?? 'volume';
  if (!isRankingSort(sort)) { res.status(400).json({ message: '지원하지 않는 순위 기준입니다.' }); return; }
  try { res.json(await getMarketOverview(market, sort)); }
  catch { res.status(503).json({ message: '시장 정보를 불러오지 못했습니다.' }); }
}
