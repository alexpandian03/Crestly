/**
 * Universal AI provider, model, and credential resolver.
 * Change AI_PROVIDER / AI_MODEL / AI_API_KEY (and optional AI_ACCOUNT_ID,
 * AI_BASE_URL, AI_FALLBACK_MODELS) in .env to switch models across the entire app
 * without editing source files. Legacy provider-specific env vars remain supported
 * as fallbacks when universal variables are unset.
 */

export const SUPPORTED_AI_PROVIDERS = ['mock', 'huggingface', 'cloudflare', 'gemini', 'openai'];

export const DEFAULT_MODELS = Object.freeze({
  mock: 'mock',
  cloudflare: '@cf/black-forest-labs/flux-2-klein-9b',
  huggingface: 'black-forest-labs/FLUX.1-schnell',
  gemini: 'gemini-2.5-flash-image',
  openai: 'gpt-image-1',
});

export const DEFAULT_BASE_URLS = Object.freeze({
  cloudflare: 'https://api.cloudflare.com/client/v4',
  huggingface: 'https://router.huggingface.co/hf-inference/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openai: 'https://api.openai.com/v1',
});

const PLACEHOLDER_KEYS = new Set([
  'YOUR_HUGGINGFACE_KEY_HERE',
  'YOUR_API_KEY_HERE',
  'YOUR_AI_API_KEY',
  'REPLACE_ME',
]);

function cleanValue(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/(?:^|\s+)#.*$/, '')
    .trim();
}

function cleanSecret(raw) {
  const val = cleanValue(raw);
  if (!val || PLACEHOLDER_KEYS.has(val)) return '';
  return val;
}

function stripTrailingSlash(url) {
  return cleanValue(url).replace(/\/+$/, '');
}

/**
 * Infers the provider protocol from a model identifier when AI_PROVIDER is omitted or "auto".
 */
export function inferProviderFromModel(modelName) {
  const model = cleanValue(modelName);
  if (!model) return '';
  const lower = model.toLowerCase();

  if (lower === 'mock') return 'mock';
  if (lower.startsWith('@cf/')) return 'cloudflare';
  if (/^(gemini|imagen)/i.test(lower)) return 'gemini';
  if (/^(gpt-image|dall-e|chatgpt-image)/i.test(lower)) return 'openai';
  if (model.includes('/') && !lower.startsWith('@')) return 'huggingface';
  return '';
}

function resolveProvider(env) {
  const universalProvider = cleanValue(env.AI_PROVIDER).toLowerCase();
  if (universalProvider && universalProvider !== 'auto') {
    return universalProvider;
  }

  const universalModel = cleanValue(env.AI_MODEL);
  if (universalModel) {
    const inferred = inferProviderFromModel(universalModel);
    if (inferred) return inferred;
    if (cleanValue(env.AI_BASE_URL)) return 'openai';
  }

  const legacyProvider = cleanValue(env.IMAGE_PROVIDER).toLowerCase();
  if (legacyProvider && legacyProvider !== 'auto') {
    return legacyProvider;
  }

  if (cleanValue(env.CF_ACCOUNT_ID || env.AI_ACCOUNT_ID) && cleanSecret(env.CF_API_TOKEN)) {
    return 'cloudflare';
  }
  if (cleanSecret(env.GEMINI_API_KEY) && cleanValue(env.GEMINI_IMAGE_MODEL || env.GEMINI_MODEL)) {
    return 'gemini';
  }
  if (cleanSecret(env.OPENAI_API_KEY) && cleanValue(env.OPENAI_IMAGE_MODEL || env.OPENAI_MODEL)) {
    return 'openai';
  }

  return 'huggingface';
}

function resolveModel(provider, env) {
  if (provider === 'mock') return 'mock';

  const universalModel = cleanValue(env.AI_MODEL);
  if (universalModel) return universalModel;

  const providerModelMap = {
    cloudflare: cleanValue(env.CF_IMAGE_MODEL),
    huggingface: cleanValue(env.HF_IMAGE_MODEL),
    gemini: cleanValue(env.GEMINI_IMAGE_MODEL || env.GEMINI_MODEL),
    openai: cleanValue(env.OPENAI_IMAGE_MODEL || env.OPENAI_MODEL),
  };

  return providerModelMap[provider] || DEFAULT_MODELS[provider] || '';
}

function resolveApiKey(provider, env) {
  if (provider === 'mock') return 'mock';

  const universalKey = cleanSecret(env.AI_API_KEY);
  if (universalKey) return universalKey;

  const providerKeyMap = {
    cloudflare: cleanSecret(env.CF_API_TOKEN),
    huggingface: cleanSecret(env.HF_API_KEY),
    gemini: cleanSecret(env.GEMINI_API_KEY),
    openai: cleanSecret(env.OPENAI_API_KEY),
  };

  return providerKeyMap[provider] || '';
}

function resolveBaseUrl(provider, env) {
  const custom = stripTrailingSlash(env.AI_BASE_URL);
  if (custom) return custom;

  if (provider === 'huggingface') {
    const hfUrl = stripTrailingSlash(env.HF_API_URL);
    if (hfUrl) return hfUrl;
  }

  return DEFAULT_BASE_URLS[provider] || '';
}

function resolveFallbackModels(primaryModel, env) {
  const raw = cleanValue(env.AI_FALLBACK_MODELS || env.AI_FALLBACK_MODEL);
  if (!raw) return primaryModel ? [primaryModel] : [];

  const extras = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...extras].filter(Boolean))];
}

/**
 * Resolves the active AI configuration for the entire backend.
 */
export function getAiConfig(env = process.env) {
  const provider = resolveProvider(env);
  const model = resolveModel(provider, env);
  const apiKey = resolveApiKey(provider, env);
  const accountId = cleanValue(env.AI_ACCOUNT_ID || env.CF_ACCOUNT_ID);
  const baseUrl = resolveBaseUrl(provider, env);
  const fallbackModels = resolveFallbackModels(model, env);

  const hfModel = provider === 'huggingface' ? model : cleanValue(env.HF_IMAGE_MODEL) || DEFAULT_MODELS.huggingface;
  const routerUrl =
    provider === 'huggingface' && cleanValue(env.AI_BASE_URL || env.HF_API_URL)
      ? baseUrl
      : `${DEFAULT_BASE_URLS.huggingface}/${hfModel}`;

  return {
    provider,
    model,
    apiKey,
    accountId,
    baseUrl,
    fallbackModels,
    hfModel,
    routerUrl,
    directUrl: `https://api-inference.huggingface.co/models/${hfModel}`,
    modelEndpoint: `https://huggingface.co/${hfModel}`,
  };
}
