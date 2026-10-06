import { generateWithMock } from './providers/mock.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenAI } from './providers/openai.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { buildSystemPrompt } from './prompt.js';
import {
  validatePosterContent,
  sanitizeAndTruncateContent,
} from './schema.js';

async function invokeProvider(providerName, options) {
  switch (providerName) {
    case 'gemini':
      return generateWithGemini(options);
    case 'openai':
      return generateWithOpenAI(options);
    case 'anthropic':
      return generateWithAnthropic(options);
    case 'mock':
    default:
      return generateWithMock(options);
  }
}

/**
 * Main AI content generation entrypoint
 *
 * @param {object} params
 * @param {string} params.prompt - User event description
 * @param {object} params.brandKit - Locked Client BrandKit
 * @param {object} params.template - Target poster template
 * @param {string} [params.instruction] - Optional modifier (shorter, minimal, etc.)
 * @returns {Promise<object>} Validated, sanitized poster content
 */
export async function generateContent({ prompt, brandKit, template, instruction }) {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();

  // 20-second hard abort timeout (vercel maxDuration is 30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  const systemPrompt = buildSystemPrompt({ brandKit, template, instruction });

  try {
    let rawOutput;
    let parseError = null;

    try {
      rawOutput = await invokeProvider(provider, {
        prompt,
        systemPrompt,
        brandKit,
        template,
        instruction,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        const timeoutErr = new Error('The AI took too long. Please try again.');
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      parseError = err;
    }

    // Try sanitizing and validating initial attempt
    let candidate = sanitizeAndTruncateContent(rawOutput);
    let validation = candidate ? validatePosterContent(candidate) : { valid: false, errors: parseError };

    // If initial output failed, retry ONCE with error feedback
    if (!validation.valid && !controller.signal.aborted) {
      try {
        const retryPrompt = `${prompt}\n\n[Previous attempt produced invalid JSON or schema errors: ${JSON.stringify(
          validation.errors || parseError?.message
        )}. Re-generate valid JSON strictly following the required fields: title, tagline, date, time, venue, details (array of max 4), imageQuery.]`;

        rawOutput = await invokeProvider(provider, {
          prompt: retryPrompt,
          systemPrompt,
          brandKit,
          template,
          instruction,
          signal: controller.signal,
        });

        candidate = sanitizeAndTruncateContent(rawOutput);
        validation = candidate ? validatePosterContent(candidate) : { valid: false };
      } catch (retryErr) {
        if (retryErr.name === 'AbortError' || controller.signal.aborted) {
          const timeoutErr = new Error('The AI took too long. Please try again.');
          timeoutErr.status = 504;
          throw timeoutErr;
        }
      }
    }

    // If still invalid after retry, throw 502
    if (!validation.valid || !candidate) {
      const failedErr = new Error("We couldn't create the content. Please try again.");
      failedErr.status = 502;
      throw failedErr;
    }

    return candidate;
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      const timeoutErr = new Error('The AI took too long. Please try again.');
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default { generateContent };
