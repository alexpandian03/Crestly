/**
 * /server/services/ai/choices.js
 *
 * Orchestrates ONE Gemini call for AI Choices, with schema validation,
 * one retry with error list, fallback model, and deterministic rule-based fallback.
 *
 * Requirements:
 *  1. ONE Gemini call returns JSON: { facts, mood, blockPreferences, reason, copyVariants }.
 *  2. Enums built dynamically from shared block definitions.
 *  3. Dates, times, venues, names only from user's text; variants never alter facts.
 *  4. Drop invalid variants; if fewer than 3 survive, fill from rule-based fallback.
 *  5. Invalid enums replaced by composer's choice.
 *  6. Reliability: schema validation, one retry with error list, fallback model from GEMINI_FALLBACK_MODEL,
 *     then rule-based fallback.
 *  7. 25-second timeout and per-user daily limit in MongoDB with one atomic update.
 *  8. Always returns a valid result.
 */

import { generateWithGemini } from './providers/gemini.js';
import { generateWithMock } from './providers/mock.js';
import { buildAiChoicesSystemPrompt } from './prompt.js';
import { validateAiChoices, createRuleBasedChoices } from '../../../shared/aiChoices.js';
import { logFallback } from './index.js';
import { consumeRateLimit } from '../rateLimit.js';

export const AI_CHOICES_TIMEOUT_MS = 25000;

/**
 * Checks per-user daily rate limit with an atomic MongoDB update.
 *
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, count: number, remaining: number }>}
 */
export async function checkChoicesDailyLimit(userId) {
  if (!userId) return { allowed: true, count: 0, remaining: 1000 };

  const limit = process.env.NODE_ENV === 'production' ? 50 : 1000;
  return consumeRateLimit({
    key: `ai-generate:user:${userId}`,
    limit,
    windowMs: 24 * 60 * 60 * 1000,
  });
}

/**
 * Executes the AI CHOICES flow:
 * ONE Gemini call -> validate -> retry with error list -> fallback model -> rule-based fallback.
 *
 * @param {object} params
 * @param {string} params.prompt - User description
 * @param {string} [params.eventType] - Event type
 * @param {object} [params.brandKit] - Brand Kit
 * @param {string} [params.instruction] - Special instruction
 * @param {number|string} [params.seed] - Seed for PRNG and caching
 * @param {string} [params.requestId] - Tracing request ID
 * @param {AbortSignal} [params.signal] - Abort signal
 * @param {string} [params.userId] - Authenticated user ID for daily rate limit
 * @returns {Promise<object>} Guaranteed valid choices object
 */
export async function generateAiChoices({
  prompt,
  eventType = 'general',
  brandKit = null,
  instruction = undefined,
  seed = 42,
  requestId = 'req-choices',
  signal = null,
  userId = null,
} = {}) {
  // 1. Per-user daily limit counted in MongoDB with one atomic update
  if (userId) {
    const quota = await checkChoicesDailyLimit(userId);
    if (!quota.allowed) {
      const limitErr = new Error('You have reached your daily generation limit. Please try again tomorrow.');
      limitErr.status = 429;
      throw limitErr;
    }
  }

  const userPrompt = String(prompt || '').trim();
  const context = { prompt: userPrompt, eventType, brandKit, seed, requestId };

  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // If mock provider or no API key, use deterministic rule-based fallback
  if (provider === 'mock' || !apiKey) {
    return createRuleBasedChoices(context);
  }

  const systemPrompt = buildAiChoicesSystemPrompt({ brandKit, instruction, eventType });
  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();

  let firstAttemptErrors = [];

  // -------------------------------------------------------------
  // Attempt 1: Primary Gemini Model with 25s timeout
  // -------------------------------------------------------------
  try {
    const primarySignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS)])
      : AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS);

    const raw = await generateWithGemini({
      prompt: userPrompt,
      systemPrompt,
      signal: primarySignal,
      maxTokens: 1400,
      model: primaryModel,
    });

    const validated = validateAiChoices(raw, context);
    if (validated.ok) {
      return {
        ...validated.data,
        provider: 'gemini',
      };
    }

    firstAttemptErrors = validated.errors;
  } catch (err) {
    logFallback(requestId, `Primary model failed: ${err.message || 'API error'}`);
    firstAttemptErrors.push(err.message || 'API call failed');
  }

  // -------------------------------------------------------------
  // Attempt 2: One Retry with Error List
  // -------------------------------------------------------------
  if (firstAttemptErrors.length > 0) {
    try {
      const retrySignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS)])
        : AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS);

      const retryPrompt = `${userPrompt}\n\n[SYSTEM REVISION REQUIRED]: Your previous response had the following validation errors:\n- ${firstAttemptErrors.join(
        '\n- '
      )}\nPlease fix these errors and return valid JSON adhering strictly to the schema.`;

      const rawRetry = await generateWithGemini({
        prompt: retryPrompt,
        systemPrompt,
        signal: retrySignal,
        maxTokens: 1400,
        model: primaryModel,
      });

      const validatedRetry = validateAiChoices(rawRetry, context);
      if (validatedRetry.ok || (validatedRetry.data && validatedRetry.data.copyVariants.length >= 3)) {
        return {
          ...validatedRetry.data,
          provider: 'gemini-retry',
        };
      }
    } catch (retryErr) {
      logFallback(requestId, `Retry with error list failed: ${retryErr.message || 'API error'}`);
    }
  }

  // -------------------------------------------------------------
  // Attempt 3: Fallback Model from GEMINI_FALLBACK_MODEL
  // -------------------------------------------------------------
  if (fallbackModel && fallbackModel !== primaryModel) {
    try {
      const fallbackSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS)])
        : AbortSignal.timeout(AI_CHOICES_TIMEOUT_MS);

      const rawFallback = await generateWithGemini({
        prompt: userPrompt,
        systemPrompt,
        signal: fallbackSignal,
        maxTokens: 1400,
        model: fallbackModel,
      });

      const validatedFallback = validateAiChoices(rawFallback, context);
      if (validatedFallback.data) {
        return {
          ...validatedFallback.data,
          provider: 'gemini-fallback',
        };
      }
    } catch (fbErr) {
      logFallback(requestId, `Fallback model (${fallbackModel}) failed: ${fbErr.message || 'API error'}`);
    }
  }

  // -------------------------------------------------------------
  // Final Fallback: Rule-Based Deterministic Fallback
  // Guaranteed to always return a valid result!
  // -------------------------------------------------------------
  logFallback(requestId, 'Invoking rule-based fallback choices');
  return createRuleBasedChoices(context);
}

export default {
  AI_CHOICES_TIMEOUT_MS,
  checkChoicesDailyLimit,
  generateAiChoices,
};
