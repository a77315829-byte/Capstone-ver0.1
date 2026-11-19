import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import TradingAccount from '../models/tradingAccount.model';
import UsTradingAccount from '../models/usTradingAccount.model';
import FundingTransaction from '../models/fundingTransaction.model';
import { FxQuote, FxConversion } from '../models/fx.model';
import { calculateExchange, validateExchangeInput, FxDirection, fxError } from '../utils/fx';
import { withAccountMutation } from './accountMutationLock';
import { getExchangeRate } from './fxRate.service';

export async function getFxWallet(userId: string) {
  const [kr, us] = await Promise.all([TradingAccount.findOne({ userId }).lean(), UsTradingAccount.findOne({ userId }).lean()]);
  const balance = (account: any, precision: number) => ({
    cash: Number(account?.cash || 0), reservedCash: Number(account?.reservedCash || 0),
    availableCash: Math.floor(Math.max(0, Number(account?.cash || 0) - Number(account?.reservedCash || 0)) * precision + 1e-7) / precision,
  });
  return { KRW: balance(kr, 1), USD: balance(us, 100) };
}
export async function createFxQuote(userId: string, direction: FxDirection, amount: unknown) {
  // Reject malformed inputs before contacting an external rate provider.
  validateExchangeInput(direction, amount);
  const rate = await getExchangeRate();
  if (rate.stale) throw fxError(503, '최신 환율을 확인할 수 없어 환전을 잠시 중단했습니다.');
  const values = calculateExchange(direction, amount, rate.rate);
  const wallet = await getFxWallet(userId);
  if (wallet[values.sourceCurrency as 'KRW' | 'USD'].availableCash < values.sourceAmount)
    throw fxError(409, '환전 가능한 잔액이 부족합니다. 미체결 주문에 묶인 금액은 사용할 수 없습니다.');
  return (await FxQuote.create({ ...values, userId, quoteId: randomUUID(), rateDate: rate.date,
    rateSource: rate.source, expiresAt: new Date(Date.now() + 120000) })).toObject();
}
let indexes: Promise<unknown> | undefined;
export async function convertFx(userId: string, quoteId: unknown) {
  if (typeof quoteId !== 'string' || !/^[a-f0-9-]{36}$/.test(quoteId)) throw fxError(400, '환전 견적을 먼저 확인해 주세요.');
  indexes ??= Promise.all([FxQuote.init(), FxConversion.init(), FundingTransaction.init(), TradingAccount.init(), UsTradingAccount.init()]).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return withAccountMutation(userId, async () => {
    let receipt: any;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await FxConversion.findOne({ userId, quoteId }).session(session).lean();
        if (existing) { receipt = existing; return; }
        const quote = await FxQuote.findOne({ userId, quoteId }).session(session).lean();
        if (!quote) throw fxError(404, '환전 견적을 찾을 수 없습니다. 다시 견적을 확인해 주세요.');
        if (quote.expiresAt.getTime() <= Date.now()) throw fxError(409, '환전 견적이 만료됐습니다. 다시 견적을 확인해 주세요.');
        const toUsd = quote.direction === 'KRW_TO_USD';
        const source = toUsd ? TradingAccount.collection : UsTradingAccount.collection;
        const target = toUsd ? UsTradingAccount : TradingAccount;
        const precision = toUsd ? 0 : 2;
        const debit = await source.updateOne({ userId, $expr: { $gte: [
          { $round: [{ $subtract: ['$cash', { $ifNull: ['$reservedCash', 0] }] }, precision] }, quote.sourceAmount,
        ] } }, [{ $set: {
          cash: { $round: [{ $subtract: ['$cash', quote.sourceAmount] }, precision] },
          totalDeposits: { $round: [{ $subtract: [{ $ifNull: ['$totalDeposits', 0] }, quote.sourceAmount] }, precision] },
          updatedAt: new Date(),
        } }], { session });
        if (debit.modifiedCount !== 1) throw fxError(409, '환전 가능한 잔액이 부족합니다. 잔액과 미체결 주문을 확인해 주세요.');
        // Sequential operations are required inside MongoDB transactions.
        await (target as typeof TradingAccount).updateOne({ userId }, {
          $inc: { cash: quote.targetAmount, totalDeposits: quote.targetAmount },
          $setOnInsert: { userId, currency: quote.targetCurrency },
        }, { upsert: true, session, setDefaultsOnInsert: true });
        await target.collection.updateOne({ userId }, [{ $set: {
          cash: { $round: ['$cash', toUsd ? 2 : 0] },
          totalDeposits: { $round: ['$totalDeposits', toUsd ? 2 : 0] },
        } }], { session });
        await FundingTransaction.create([
          { userId, market: toUsd ? 'KR' : 'US', type: 'FX_OUT', amount: quote.sourceAmount, currency: quote.sourceCurrency, fundingKey: `FX:${quoteId}:OUT`, referenceId: quoteId },
          { userId, market: toUsd ? 'US' : 'KR', type: 'FX_IN', amount: quote.targetAmount, currency: quote.targetCurrency, fundingKey: `FX:${quoteId}:IN`, referenceId: quoteId },
        ], { session });
        const { _id, createdAt, updatedAt, ...values } = quote;
        const [saved] = await FxConversion.create([values], { session });
        receipt = saved.toObject();
      });
    } finally { await session.endSession(); }
    return { receipt, wallet: await getFxWallet(userId) };
  });
}
export async function getFxHistory(userId: string) {
  return FxConversion.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
}
