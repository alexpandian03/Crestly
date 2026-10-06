import RateCounter from '../models/RateCounter.model.js';

/**
 * Fixed-window counter stored in MongoDB so serverless instances share one limit.
 * The window always increments; callers reject when it is already over the limit.
 */
export async function consumeRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMs + 60_000);

  const counter = await RateCounter.findOneAndUpdate(
    { key, windowStartedAt },
    { $inc: { count: 1 }, $set: { expiresAt }, $setOnInsert: { key, windowStartedAt } },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  const count = counter?.count ?? 1;
  const minutes = Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - now) / 60_000));
  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterMinutes: minutes,
  };
}
