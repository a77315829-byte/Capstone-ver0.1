import mongoose, { Schema } from 'mongoose';
const fields = {
  quoteId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  direction: { type: String, required: true, enum: ['KRW_TO_USD', 'USD_TO_KRW'] },
  sourceCurrency: { type: String, required: true },
  targetCurrency: { type: String, required: true },
  sourceAmount: { type: Number, required: true },
  targetAmount: { type: Number, required: true },
  rate: { type: Number, required: true },
  rateDate: { type: String, required: true },
  rateSource: { type: String, required: true },
  expiresAt: { type: Date, required: true },
};
const quoteSchema = new Schema(fields, { timestamps: true });
quoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
const conversionSchema = new Schema(fields, { timestamps: true });
export const FxQuote = mongoose.model('FxQuote', quoteSchema);
export const FxConversion = mongoose.model('FxConversion', conversionSchema);
