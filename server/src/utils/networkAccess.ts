import type { Request, Response, NextFunction } from 'express';
import { networkInterfaces } from 'os';
const { allowedPeer } = require('../../../scripts/lan.cjs');
let lastRead = 0;
let interfaces: ReturnType<typeof networkInterfaces> = {};

export function networkPeerAllowed(address: string | undefined): boolean {
 if (Date.now() - lastRead > 10000) {
  interfaces = networkInterfaces();
  lastRead = Date.now();
 }
 return allowedPeer(address, process.env.NETWORK_ACCESS || 'local', interfaces);
}
export function networkBoundary(req: Request, res: Response, next: NextFunction) {
 // The actual socket peer is authoritative. Forwarded headers cannot bypass the LAN boundary.
 if (!networkPeerAllowed(req.socket.remoteAddress)) {
  return res.status(403).json({ message: '이 전시는 실행 PC와 같은 로컬 네트워크에서만 접속할 수 있습니다.' });
 }
 next();
}
export function inexpensiveAiRequest(req: Pick<Request, 'method' | 'originalUrl'>): boolean {
 return req.method === 'GET' || req.method === 'HEAD' ||
  (['POST', 'DELETE'].includes(req.method) && /^\/api\/ai-judgment\/\d[A-Z0-9]{5}\/watch$/.test(req.originalUrl.split('?')[0]));
}
