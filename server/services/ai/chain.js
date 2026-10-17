import { OPENAI_COMPATIBLE_PROVIDERS, hasApiKey as hasOpenAiKey, generateWithOpenAiCompatible, normalizeProviderName } from './providers/openaiCompatible.js';
import { generateWithGemini, hasApiKey as hasGeminiKey } from './providers/gemini.js';
import { generateWithMock } from './providers/mock.js';
import { generateWithAnthropic } from './providers/anthropic.js';

// 429 Cooldown Tracking (10 minutes)
const rateLimitedProviders = new Map(); // providerName -> expiresAt timestamp (ms)

export function isProviderRateLimited(providerName) {
  const norm = normalizeProviderName(providerName);
  const expiresAt = rateLimitedProviders.get(norm);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    rateLimitedProviders.delete(norm);
    return false;
  }
  return true;
}

export function recordRateLimit(providerName) {
  const norm = normalizeProviderName(providerName);
  rateLimitedProviders.set(norm, Date.now() + 10 * 60 * 1000);
}

export function clearRateLimits() {
  rateLimitedProviders.clear();
}

/**
 * Checks whether an API key is configured for a given provider.
 * Never logs or returns keys.
 */
export function hasProviderKey(providerName) {
  const norm = normalizeProviderName(providerName);
  if (norm === 'mock') return true;
  if (norm === 'gemini') return hasGeminiKey();
  if (norm === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return hasOpenAiKey(norm);
}

/**
 * Parses and returns the ordered list of chain providers.
 * Requirement: The mock is always last.
 */
export function getChainProviders() {
  const envChain = (process.env.LLM_CHAIN || 'groq,cerebras,gemini,mock')
    .split(',')
    .map((p) => normalizeProviderName(p.trim()))
    .filter(Boolean);

  const withoutMock = envChain.filter((p) => p !== 'mock');
  withoutMock.push('mock');
  return Array.from(new Set(withoutMock));
}

/**
 * Scrub any potential API keys from error messages before logging or throwing.
 */
function scrubKeys(message) {
  if (!message || typeof message !== 'string') return '';
  let clean = message;
  const envKeys = [
    process.env.GROQ_API_KEY,
    process.env.CEREBRAS_API_KEY,
    process.env.MISTRAL_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
  ].filter((k) => k && typeof k === 'string' && k.length > 5);

  for (const k of envKeys) {
    clean = clean.split(k).join('[REDACTED]');
  }
  return clean.replace(/(?:key|bearer|token)\s*[:=]?\s*[A-Za-z0-9_-]{16,}/gi, '[REDACTED]');
}

/**
 * Single provider invoker.
 */
export async function invokeSingleProvider(providerName, options) {
  const norm = normalizeProviderName(providerName);

  if (norm === 'mock') {
    return generateWithMock(options);
  }

  if (norm === 'gemini') {
    return generateWithGemini(options);
  }

  if (norm === 'anthropic') {
    return generateWithAnthropic(options);
  }

  if (OPENAI_COMPATIBLE_PROVIDERS[norm]) {
    return generateWithOpenAiCompatible(norm, options);
  }

  throw new Error(`Unknown provider: ${providerName}`);
}

/**
 * Executes a call using the provider chain.
 *
 * Rules:
 * 1. LLM_PROVIDER=chain tries providers in LLM_CHAIN in order.
 * 2. Moves to next on 429, 5xx, timeout (25s), invalid key or invalid JSON.
 * 3. Remembers a provider that returned 429 for 10 minutes.
 * 4. Skips providers with no key set.
 * 5. Mock is always last.
 * 6. Logs one short line per failure (never prints keys).
 * 7. Returns { result, provider }.
 */
export async function executeWithChain(options) {
  const providerMode = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();

  // If a single provider is explicitly selected (and not 'chain'), try it first, but fallback gracefully
  const chain = providerMode === 'chain'
    ? getChainProviders()
    : [providerMode, 'mock'].filter((p, i, a) => a.indexOf(p) === i);

  // Guarantee mock is last
  const normalizedChain = chain.filter((p) => p !== 'mock');
  normalizedChain.push('mock');

  for (const provider of normalizedChain) {
    if (provider !== 'mock') {
      // Rule 4: Skip providers with no key set
      if (!hasProviderKey(provider)) {
        continue;
      }
      // Rule 3: Check 10-minute 429 cooldown
      if (isProviderRateLimited(provider)) {
        continue;
      }
    }

    try {
      const result = await invokeSingleProvider(provider, options);
      if (result === undefined || result === null) {
        throw new Error('Provider returned null or undefined');
      }
      return { result, provider };
    } catch (err) {
      const status = Number(err.status) || 500;
      const is429 = status === 429 || /rate limit|too many requests/i.test(err.message || '');
      const is5xx = status >= 500 && status < 600;
      const isTimeout = status === 504 || /timeout|aborted/i.test(err.message || '');
      const isInvalidKey = status === 401 || status === 403 || err.noKey || /api key|unauthorized|forbidden/i.test(err.message || '');
      const isInvalidJson = err.invalidJson || /json|syntaxerror/i.test(err.message || '');

      if (is429) {
        recordRateLimit(provider);
      }

      // Log one short line per failure (Rule 5 & never print keys)
      const cleanMsg = scrubKeys(err.message || 'error');
      console.warn(`[AI Chain] ${provider} failed: ${cleanMsg} (${status})`);

      // If this is the last provider (mock), throw or return
      if (provider === 'mock') {
        throw err;
      }

      // Rule 2: Move to the next on 429, 5xx, timeout, invalid key, or invalid JSON
      if (is429 || is5xx || isTimeout || isInvalidKey || isInvalidJson) {
        continue;
      }

      // For any other error on a non-mock provider, continue to next provider
      continue;
    }
  }

  // If loop completes without returning, fallback to mock directly
  const fallbackResult = await generateWithMock(options);
  return { result: fallbackResult, provider: 'mock' };
}

/* ------------------------------------------------------------------------- *
 * 10-Minute In-Memory Cache (keyed by prompt and options)
 * ------------------------------------------------------------------------- */
const inMemoryCache = new Map(); // cacheKey -> { data, expiresAt }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function createCacheKey(prompt, options = {}) {
  const text = String(prompt || '').trim();
  const optPart = JSON.stringify({
    instruction: options.instruction || '',
    mode: options.mode || 'template',
    variants: options.variants || 1,
    eventType: options.eventType || '',
    avoidRecipeIds: options.avoidRecipeIds || [],
    variant: options.variant ?? null,
    count: options.count ?? 1,
    seedCounter: options.seedCounter ?? 0,
    seed: options.seed ?? 42,
  });
  return `${text}::${optPart}`;
}

export function getFromCache(key) {
  const entry = inMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setInCache(key, data) {
  inMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearAiCache() {
  inMemoryCache.clear();
}

export default {
  executeWithChain,
  invokeSingleProvider,
  getChainProviders,
  hasProviderKey,
  isProviderRateLimited,
  recordRateLimit,
  clearRateLimits,
  createCacheKey,
  getFromCache,
  setInCache,
  clearAiCache,
};
