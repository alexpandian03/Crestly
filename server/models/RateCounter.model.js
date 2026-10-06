import mongoose from 'mongoose';

/**
 * Fixed-window counter used for serverless-safe rate limits (no in-memory state).
 * One document per key + window; the TTL index clears it once the window is over.
 */
const rateCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    windowStartedAt: { type: Date, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

rateCounterSchema.index({ key: 1, windowStartedAt: 1 }, { unique: true });
rateCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateCounter =
  mongoose.models.RateCounter || mongoose.model('RateCounter', rateCounterSchema);

export default RateCounter;
