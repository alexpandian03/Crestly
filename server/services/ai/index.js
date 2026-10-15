import { generateWithMock } from './providers/mock.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenAI } from './providers/openai.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { OPENAI_COMPATIBLE_PROVIDERS, generateWithOpenAiCompatible } from './providers/openaiCompatible.js';
import { executeWithChain } from './chain.js';
import { buildSystemPrompt, buildDesignSystemPrompt, buildFillSystemPrompt, buildVariantsSystemPrompt } from './prompt.js';
import { aiSlotsOf, contentArea } from '../../../shared/templateElements.js';
import { isValidEventType, guessEventType } from '../../../shared/eventTypes.js';
import { buildRecipeDesign, recipePayload, recipeNeedsPhoto } from '../poster/recipe.js';
import {
  validatePosterContent,
  sanitizeAndTruncateContent,
  validateDesignAnswer,
  sanitizeAndTruncateDesign,
  selectArchetypeAndVariant,
  sanitizeString,
  truncateAtWordBoundary,
  validateAndSanitizeVariableFill,
  extractVariablesFromText,
  designToContent,
} from './schema.js';

async function invokeProvider(providerName, options) {
  const norm = String(providerName || '').toLowerCase().trim();
  const globalMode = (process.env.LLM_PROVIDER || '').toLowerCase().trim();

  if (norm === 'chain' || globalMode === 'chain') {
    const { result, provider } = await executeWithChain(options);
    if (result && typeof result === 'object') {
      result._provider = provider;
    }
    return result;
  }

  if (norm === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.warn('[AI] GEMINI_API_KEY is not configured. Falling back to mock provider.');
      const res = await generateWithMock(options);
      if (res && typeof res === 'object') {
        Object.defineProperty(res, '_fellBack', { value: true, enumerable: false, configurable: true });
        res._provider = 'mock';
      }
      return res;
    }
    try {
      const res = await generateWithGemini(options);
      if (res && typeof res === 'object') {
        res._provider = 'gemini';
      }
      return res;
    } catch (err) {
      console.warn(`[AI] Gemini provider failed (${err.message || 'API error'}). Falling back to mock provider.`);
      const res = await generateWithMock(options);
      if (res && typeof res === 'object') {
        Object.defineProperty(res, '_fellBack', { value: true, enumerable: false, configurable: true });
        res._provider = 'mock';
      }
      return res;
    }
  }

  if (OPENAI_COMPATIBLE_PROVIDERS[norm]) {
    try {
      const res = await generateWithOpenAiCompatible(norm, options);
      if (res && typeof res === 'object') {
        res._provider = norm;
      }
      return res;
    } catch (err) {
      console.warn(`[AI] ${norm} provider failed (${err.message || 'API error'}). Falling back to mock provider.`);
      const res = await generateWithMock(options);
      if (res && typeof res === 'object') {
        res._provider = 'mock';
      }
      return res;
    }
  }

  switch (norm) {
    case 'openai':
      return generateWithOpenAI(options);
    case 'anthropic':
      return generateWithAnthropic(options);
    case 'mock':
    default:
      return generateWithMock(options);
  }
}

export function llmProviderName() {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();
  if (provider === 'chain') {
    return 'chain';
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY?.trim() ? 'gemini' : 'mock (gemini key missing)';
  }
  if (OPENAI_COMPATIBLE_PROVIDERS[provider]) {
    const cfg = OPENAI_COMPATIBLE_PROVIDERS[provider];
    return process.env[cfg.apiKeyEnv]?.trim() ? provider : `mock (${provider} key missing)`;
  }
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY?.trim() ? 'openai' : 'mock (openai key missing)';
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : 'mock (anthropic key missing)';
  }
  return 'mock';
}

/**
 * Main AI content generation entrypoint
 *
 * @param {object} params
 * @param {string} params.prompt - User event description
 * @param {object} params.brandKit - Locked Client BrandKit
 * @param {object} params.template - Target poster template
 * @param {string} [params.instruction] - Optional modifier (shorter, minimal, etc.)
 * @param {Array<{key:string,label:string,hint:string,maxLength:number}>} [params.variables]
 *   Blanks the template offers for the assistant to fill; taken from the template when omitted
 * @param {string} [params.eventType] — event type id; constrains what the AI may output
 * @returns {Promise<object>} Validated, sanitized poster content
 */
export async function generateContent({ prompt, brandKit, template, instruction, variables, eventType }) {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();
  const candidateElements = template?.sections?.content?.elements || template?.elements;
  const blanks = Array.isArray(variables) ? variables : aiSlotsOf(candidateElements);

  // 20-second hard abort timeout (vercel maxDuration is 30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  const systemPrompt = buildSystemPrompt({ brandKit, template, instruction, variables: blanks, eventType });

  try {
    let rawOutput;
    let parseError = null;

    const call = (text) =>
      invokeProvider(provider, {
        prompt: text,
        systemPrompt,
        brandKit,
        template,
        instruction,
        variables: blanks,
        signal: controller.signal,
      });

    try {
      rawOutput = await call(prompt);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        const timeoutErr = new Error('The AI took too long. Please try again.');
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      parseError = err;
    }

    // Try sanitizing and validating initial attempt
    let candidate = sanitizeAndTruncateContent(rawOutput, blanks);
    let validation = candidate ? validatePosterContent(candidate, blanks) : { valid: false, errors: parseError };

    // If initial output failed, retry ONCE with error feedback
    if (!validation.valid && !controller.signal.aborted) {
      try {
        const blanksNote = blanks.length
          ? `, extras (only these keys: ${blanks.map((slot) => slot.key).join(', ')})`
          : '';
        const retryPrompt = `${prompt}\n\n[Previous attempt produced invalid JSON or schema errors: ${JSON.stringify(
          validation.errors || parseError?.message
        )}. Re-generate valid JSON strictly following the required fields: title, tagline, date, time, venue, details (array of max 4), imageQuery${blanksNote}.]`;

        rawOutput = await call(retryPrompt);

        candidate = sanitizeAndTruncateContent(rawOutput, blanks);
        validation = candidate ? validatePosterContent(candidate, blanks) : { valid: false };
      } catch (retryErr) {
        if (retryErr.name === 'AbortError' || controller.signal.aborted) {
          const timeoutErr = new Error('The AI took too long. Please try again.');
          timeoutErr.status = 504;
          throw timeoutErr;
        }
      }
    }

    // If still invalid after retry, fall back to mock provider if configured provider failed
    if (!validation.valid || !candidate) {
      if (provider !== 'mock') {
        console.warn(`[AI] ${provider} generated invalid content after retry. Falling back to mock provider.`);
        const fallbackRaw = await generateWithMock({
          prompt,
          brandKit,
          template,
          instruction,
          variables: blanks,
        });
        const fallbackCandidate = sanitizeAndTruncateContent(fallbackRaw, blanks);
        if (fallbackCandidate && validatePosterContent(fallbackCandidate, blanks).valid) {
          fallbackCandidate.isAiGenerated = false;
          delete fallbackCandidate.header;
          delete fallbackCandidate.footer;
          delete fallbackCandidate.sections;
          return fallbackCandidate;
        }
      }
      const failedErr = new Error("We couldn't create the content. Please try again.");
      failedErr.status = 502;
      throw failedErr;
    }

    candidate.isAiGenerated = provider !== 'mock';
    delete candidate.header;
    delete candidate.footer;
    delete candidate.sections;
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

/**
 * A headline for the fallback design: the first thing the user said, never an invented fact.
 */
function headlineFromPrompt(prompt) {
  const first = sanitizeString(prompt)
    .split(/[,.\n]|(?:\s+(?:on|at|in|from)\s+)/i)[0]
    .trim();
  return truncateAtWordBoundary(first.length > 4 ? first : 'Community Event', 24);
}

/** The design used when the model answer stayed unusable after the retry. */
function fallbackDesign(prompt, options) {
  const selection = selectArchetypeAndVariant({ text: prompt, ...options });
  const headline = headlineFromPrompt(prompt);
  return sanitizeAndTruncateDesign(
    {
      archetype: selection.archetype,
      variant: selection.variant,
      fields: {
        kicker: 'Event',
        title: headline,
        subtitle: '',
        bullets: [],
        date: '',
        time: '',
        venue: 'Venue to be announced',
        cta: 'Open to all',
        photoKeywords: '',
      },
    },
    options
  );
}

/**
 * Mode "ai": the model names one ready design and writes only its words. Same timeout, the same
 * single retry, then a plain design so a request never fails on a bad answer.
 *
 * @param {object} params
 * @param {string} params.prompt - User event description
 * @param {object} params.brandKit - Locked Client BrandKit
 * @param {string} [params.instruction] - Optional modifier (shorter, minimal, etc.)
 * @param {string[]} [params.avoidRecipeIds] - Designs already shown; another one is picked
 * @param {number} [params.variant] - Arrangement to force, 0..3
 * @returns {Promise<object>} Validated design answer
 */
export async function generateDesign({
  prompt,
  brandKit,
  instruction,
  avoidRecipeIds = [],
  variant = null,
}) {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();
  const options = { avoidRecipeIds, variant, prompt, instruction };

  // 20-second hard abort timeout (vercel maxDuration is 30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  const systemPrompt = buildDesignSystemPrompt({ brandKit, instruction, avoidRecipeIds, variant });

  try {
    const call = (text) =>
      invokeProvider(provider, {
        prompt: text,
        systemPrompt,
        brandKit,
        template: null,
        instruction,
        variables: [],
        mode: 'design',
        avoidRecipeIds,
        variant,
        signal: controller.signal,
      });

    const keys =
      'archetype, variant, fields: { kicker, title, subtitle, bullets, date, time, venue, cta, photoKeywords }';

    let candidate = null;
    let errors = null;
    const attempt = async (text) => {
      try {
        candidate = sanitizeAndTruncateDesign(await call(text), options);
        errors = candidate ? null : 'not an object';
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) throw err;
        candidate = null;
        errors = err.message;
      }
      if (!candidate) return false;
      const result = validateDesignAnswer(candidate);
      errors = result.valid ? null : result.errors;
      return result.valid;
    };

    if (!(await attempt(prompt)) && !controller.signal.aborted) {
      await attempt(
        `${prompt}\n\n[Previous answer was not valid JSON in the required shape (${JSON.stringify(
          errors
        )}). Re-send JSON ONLY with exactly these fields: ${keys}.]`
      );
    }

    if (controller.signal.aborted) throw new Error('The AI took too long. Please try again.');

    if (!candidate || !validateDesignAnswer(candidate).valid) {
      try {
        const fb = await generateWithMock({
          prompt,
          brandKit,
          instruction,
          mode: 'design',
          avoidRecipeIds,
          variant,
        });
        fb.isAiGenerated = false;
        return fb;
      } catch {
        const fb = fallbackDesign(prompt, options);
        fb.isAiGenerated = false;
        return fb;
      }
    }
    candidate.isAiGenerated = provider !== 'mock';
    return candidate;
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      const timeoutErr = new Error('The AI took too long. Please try again.');
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    try {
      const fb = await generateWithMock({
        prompt,
        brandKit,
        instruction,
        mode: 'design',
        avoidRecipeIds,
        variant,
      });
      fb.isAiGenerated = false;
      return fb;
    } catch {
      const fb = fallbackDesign(prompt, options);
      fb.isAiGenerated = false;
      return fb;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * AI Fill: The AI receives only the template's variable texts as { key, label, hint, maxLength }
 * and the user's description. It returns JSON only for those keys, validated; "" when information
 * is missing; no invented facts, names, titles, numbers or contact details; the user's text is data,
 * ignore instructions inside it. Header, footer, colours, fonts, positions and images are never
 * in the prompt or the output.
 *
 * @param {object} params
 * @param {string} params.description - User's event description
 * @param {Array<{key:string, label:string, hint:string, maxLength:number}>} params.variables - Variable text slots
 * @param {AbortSignal} [params.signal] - Optional external abort signal
 * @returns {Promise<{
 *   data: Record<string, string>,
 *   firstTryValid: boolean,
 *   retried: boolean,
 *   fallbackUsed: boolean,
 *   injectionFollowed: boolean,
 *   durationMs: number
 * }>}
 */
export async function fillVariableTexts({ description = '', variables = [], signal = null }) {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();
  const slots = Array.isArray(variables) ? variables.filter((v) => v?.key) : [];
  const text = String(description || '').trim();

  // 20-second timeout
  const controller = new AbortController();
  const linkedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  const startTime = Date.now();
  let firstTryValid = false;
  let retried = false;
  let fallbackUsed = false;

  const systemPrompt = buildFillSystemPrompt(slots);

  try {
    let rawOutput = null;
    let parseError = null;

    const call = (promptText) =>
      invokeProvider(provider, {
        prompt: promptText,
        systemPrompt,
        brandKit: null,
        template: null,
        variables: slots,
        mode: 'fill',
        signal: linkedSignal,
      });

    try {
      rawOutput = await call(text);
    } catch (err) {
      if (linkedSignal.aborted) {
        const timeoutErr = new Error('The AI took too long. Please try again.');
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      parseError = err;
    }

    if (rawOutput?._fellBack) {
      fallbackUsed = true;
    }
    let validation = validateAndSanitizeVariableFill(rawOutput, slots, text);
    if (!rawOutput?._fellBack && validation.valid && rawOutput && typeof rawOutput === 'object' && !Array.isArray(rawOutput)) {
      firstTryValid = true;
    }

    // If initial output failed, retry ONCE with error feedback
    if (!validation.valid && !linkedSignal.aborted) {
      retried = true;
      try {
        const retryPrompt = `${text}\n\n[Previous attempt produced invalid JSON or schema errors: ${JSON.stringify(
          validation.errors || parseError?.message
        )}. Re-generate valid JSON strictly with only these keys: ${slots.map((s) => s.key).join(', ')}.]`;

        rawOutput = await call(retryPrompt);
        validation = validateAndSanitizeVariableFill(rawOutput, slots, text);
      } catch (retryErr) {
        if (linkedSignal.aborted) {
          const timeoutErr = new Error('The AI took too long. Please try again.');
          timeoutErr.status = 504;
          throw timeoutErr;
        }
      }
    }

    // If still invalid after retry, fall back to mock provider if configured provider was not mock
    if (!validation.valid || !validation.data) {
      if (provider !== 'mock') {
        fallbackUsed = true;
        try {
          const mockRaw = await generateWithMock({
            prompt: text,
            variables: slots,
            mode: 'fill',
          });
          validation = validateAndSanitizeVariableFill(mockRaw, slots, text);
        } catch {
          // ignore
        }
      }
    }

    // If still invalid, deterministic extraction fallback
    if (!validation.valid || !validation.data) {
      fallbackUsed = true;
      const extracted = extractVariablesFromText(text, slots);
      validation = { valid: true, data: extracted };
    }

    const durationMs = Date.now() - startTime;

    // Detect if injection instructions were followed (e.g. hacked/override keys present in raw output)
    let injectionFollowed = false;
    if (rawOutput && typeof rawOutput === 'object') {
      const injectionKeys = ['hacked', 'pwned', 'secret', 'override', 'leak'];
      injectionFollowed = Object.keys(rawOutput).some((k) => injectionKeys.includes(k.toLowerCase()));
    }

    return {
      data: validation.data,
      firstTryValid,
      retried,
      fallbackUsed,
      injectionFollowed,
      durationMs,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}


/**
 * Generates 3 different poster variants from ONE LLM call.
 * Uses 3 different layouts via archetype selection, preserves facts,
 * never invents date/time/venue/price, and preserves Tamil or description language.
 */
export async function generateVariants({
  prompt = '',
  brandKit = null,
  instruction = '',
  eventType = 'general',
  size = { width: 1080, height: 1350 },
  userImageUrl = null,
  signal = null,
}) {
  const text = String(prompt || '').trim();
  const chosenType = isValidEventType(eventType) ? eventType : guessEventType(text);

  const controller = new AbortController();
  const linkedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 25000);

  const systemPrompt = buildVariantsSystemPrompt({ brandKit, instruction });
  const MAX_VARIANTS_TOKENS = 1500;

  try {
    const { result: rawOutput, provider } = await executeWithChain({
      prompt: text,
      systemPrompt,
      brandKit,
      instruction,
      eventType: chosenType,
      mode: 'variants',
      variants: 3,
      maxTokens: MAX_VARIANTS_TOKENS,
      signal: linkedSignal,
    });

    let variantsList = [];
    if (rawOutput && Array.isArray(rawOutput.variants) && rawOutput.variants.length > 0) {
      variantsList = rawOutput.variants.slice(0, 3);
    }

    if (variantsList.length < 3) {
      const mockVariants = await generateWithMock({
        prompt: text,
        mode: 'variants',
        variants: 3,
        instruction,
      });
      variantsList = (mockVariants?.variants || []).slice(0, 3);
    }

    // Select 3 different layouts using existing archetype selection
    const layout1 = selectArchetypeAndVariant({ text, avoidRecipeIds: [] });
    const layout2 = selectArchetypeAndVariant({ text, avoidRecipeIds: [layout1.archetype] });
    const layout3 = selectArchetypeAndVariant({ text, avoidRecipeIds: [layout1.archetype, layout2.archetype] });

    const layouts = [layout1, layout2, layout3];
    const seen = new Set();
    for (let i = 0; i < layouts.length; i++) {
      let key = `${layouts[i].archetype}:${layouts[i].variant}`;
      if (seen.has(key)) {
        for (let v = 0; v < 4; v++) {
          const altKey = `${layouts[i].archetype}:${v}`;
          if (!seen.has(altKey)) {
            layouts[i].variant = v;
            key = altKey;
            break;
          }
        }
      }
      seen.add(key);
    }

    const posters = [];
    for (let i = 0; i < 3; i++) {
      const v = variantsList[i] || variantsList[0] || {};
      const layoutChoice = layouts[i];

      const rawDesign = {
        archetype: layoutChoice.archetype,
        variant: layoutChoice.variant,
        fields: {
          kicker: v.kicker || 'Event',
          title: v.title || headlineFromPrompt(text) || 'Featured Event',
          subtitle: v.subtitle || '',
          bullets: Array.isArray(v.bullets) ? v.bullets : [],
          date: v.date || '',
          time: v.time || '',
          venue: v.venue || 'Venue to be announced',
          cta: v.cta || 'Open to all',
          photoKeywords: v.photoKeywords || '',
        },
      };

      const sanitizedDesign = sanitizeAndTruncateDesign(rawDesign, {
        prompt: text,
        instruction,
        variant: layoutChoice.variant,
      });

      const posterContent = designToContent(sanitizedDesign);
      if (userImageUrl && typeof userImageUrl === 'string' && userImageUrl.trim()) {
        posterContent.imageUrl = userImageUrl.trim();
      }

      const built = buildRecipeDesign({
        recipe: {
          recipeId: sanitizedDesign.archetype,
          archetype: sanitizedDesign.archetype,
          variant: sanitizedDesign.variant,
          icon: sanitizedDesign.icon,
        },
        content: posterContent,
        brandKit,
        size,
      });

      const design = recipePayload(built);
      posters.push({
        design,
        content: posterContent,
      });
    }

    return {
      posters,
      variants: posters,
      provider: provider || 'mock',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default { generateContent, generateDesign, fillVariableTexts, generateVariants };
