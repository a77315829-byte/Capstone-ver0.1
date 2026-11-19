import { Request, Response } from 'express';
import { getCombinedPerformance } from '../services/combinedPerformance.service';
export async function combinedPerformance(req: Request, res: Response) {
 try {
  const data = await getCombinedPerformance((req as Request & { userId: string }).userId);
  return res.json({ success: true, data });
 } catch {
  return res.status(503).json({ message: '투자성과를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
 }
}
