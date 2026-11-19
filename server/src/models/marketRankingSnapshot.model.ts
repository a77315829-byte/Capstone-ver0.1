import mongoose, { Schema } from 'mongoose';

// One public-market snapshot per market/sort/period: at most 16 documents, no user data.
const schema = new Schema({
 key: { type: String, required: true, unique: true, match: /^(KR|US):(volume|turnover|gainers|losers):(session|two-day)$/ },
 snapshot: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });
export default mongoose.model('MarketRankingSnapshot', schema);
