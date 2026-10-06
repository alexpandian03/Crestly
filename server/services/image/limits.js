import { consumeRateLimit } from '../rateLimit.js';

/* One day of picture making, counted in MongoDB so every serverless instance shares the same
   total. Each check is a single atomic update; nothing is kept in memory. */

const DAY_MS = 24 * 60 * 60 * 1000;

export const IMAGE_LIMITS = {
  perUserPerDay: 10,
  perClientPerDay: 60,
  dayWindowMs: DAY_MS,
};

export async function consumeImageQuota({ userId, clientId }) {
  const client = await consumeRateLimit({
    key: `ai-picture:client:${clientId}`,
    limit: IMAGE_LIMITS.perClientPerDay,
    windowMs: DAY_MS,
  });
  if (!client.allowed) {
    return {
      ok: false,
      scope: 'client',
      message: `Your organization has made ${IMAGE_LIMITS.perClientPerDay} pictures today, which is the most it gets. Try again tomorrow, or choose a photo from your library.`,
    };
  }

  const user = await consumeRateLimit({
    key: `ai-picture:user:${userId}`,
    limit: IMAGE_LIMITS.perUserPerDay,
    windowMs: DAY_MS,
  });
  if (!user.allowed) {
    return {
      ok: false,
      scope: 'user',
      message: `You have made ${IMAGE_LIMITS.perUserPerDay} pictures today, which is the most one person gets. Try again tomorrow, or choose a photo from your library.`,
    };
  }

  return { ok: true, user, client };
}

export default { consumeImageQuota };
