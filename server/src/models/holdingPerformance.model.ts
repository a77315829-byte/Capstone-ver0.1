import mongoose, { Schema } from 'mongoose';

// Last observed valuation per Seoul calendar day, not a reconstructed historical price.
const schema = new Schema({
 userId: { type: String, required: true },
 date: { type: String, required: true },
 buyAmount: { type: Number, required: true },
 evaluationAmount: { type: Number, required: true },
 profit: { type: Number, required: true },
 rate: { type: Number, default: null },
 observedAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ userId: 1, date: 1 }, { unique: true });
export default mongoose.model('HoldingPerformance', schema);
