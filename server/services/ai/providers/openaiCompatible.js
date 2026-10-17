/**
 * Generic OpenAI-compatible LLM Provider using plain fetch (no SDKs).
 * Configured by provider name for Groq, Cerebras, Mistral, OpenRouter, and OpenAI.
 */

export const OPENAI_COMPATIBLE_PROVIDERS = {
  groq: {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    jsonMode: true,
  },
  cerebras: {
    name: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    modelEnv: 'CEREBRAS_MODEL',
    defaultModel: 'llama3.1-70b',
    jsonMode: true,
  },
  mistral: {
    name: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    modelEnv: 'MISTRAL_MODEL',
    defaultModel: 'mistral-small-latest',
    jsonMode: true,
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    jsonMode: true,
  },
  openai: {
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    jsonMode: true,
  },
};
export function normalizeProviderName(name) {
  const norm = String(name || '').toLowerCase().trim();
  if (norm === 'qorq' || norm === 'qgorq' || norm === 'groq') return 'groq';
  if (norm === 'misteral' || norm === 'mistral') return 'mistral';
  return norm;
}

export function getProviderApiKey(providerName) {
  const norm = normalizeProviderName(providerName);
  if (norm === 'groq') {
    return (process.env.GROQ_API_KEY || process.env.QGORQ_API_KEY || process.env.QORQ_API_KEY || '').trim();
  }
  if (norm === 'mistral') {
    return (process.env.MISTRAL_API_KEY || process.env.MISTERAL_API_KEY || '').trim();
  }
  const cfg = OPENAI_COMPATIBLE_PROVIDERS[norm];
  if (!cfg) return '';
  return (process.env[cfg.apiKeyEnv] || '').trim();
}

export function getProviderModel(providerName) {
  const norm = normalizeProviderName(providerName);
  if (norm === 'groq') {
    const m = (process.env.GROQ_MODEL || process.env.QGORQ_MODEL || process.env.QORQ_MODEL || '').trim();
    if (!m || m.includes('llama-3.1-8b-instant') || m.includes('llama3-8b-8192') || m.includes('llama-3.3-70b-versatile')) {
      return 'qwen/qwen3.8-27b';
    }
    return m;
  }
  if (norm === 'mistral') {
    const m = (process.env.MISTRAL_MODEL || process.env.MISTERAL_MODEL || '').trim();
    if (!m || m.toLowerCase().includes('small-4')) {
      return 'open-mistral-7b';
    }
    return m;
  }
  const cfg = OPENAI_COMPATIBLE_PROVIDERS[norm];
  return (process.env[cfg.modelEnv] || '').trim() || cfg?.defaultModel;
}

/**
 * Checks if a provider has its API key configured.
 */
export function hasApiKey(providerName) {
  return Boolean(getProviderApiKey(providerName));
}

/**
 * Generates content using an OpenAI-compatible provider.
 * Never prints API keys.
 */
export async function generateWithOpenAiCompatible(providerName, {
  prompt,
  systemPrompt,
  signal,
  maxTokens = 1500,
  temperature = 0.3,
}) {
  const norm = normalizeProviderName(providerName);
  const cfg = OPENAI_COMPATIBLE_PROVIDERS[norm];
  if (!cfg) {
    const err = new Error(`Unsupported OpenAI-compatible provider: ${providerName}`);
    err.status = 400;
    throw err;
  }

  const apiKey = getProviderApiKey(norm);
  if (!apiKey) {
    const err = new Error(`${cfg.name} API key not configured.`);
    err.status = 401;
    err.noKey = true;
    throw err;
  }

  const model = getProviderModel(norm) || cfg.defaultModel;
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const safeMaxTokens = (norm === 'groq' && maxTokens > 800) ? 800 : maxTokens;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: safeMaxTokens,
  };

  if (cfg.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  // 25-second timeout requirement
  const timeoutMs = 25000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (fetchErr) {
    const isTimeout =
      fetchErr.name === 'TimeoutError' ||
      combinedSignal.aborted ||
      /timeout|abort/i.test(fetchErr.message || '');
    const err = new Error(
      isTimeout
        ? `${cfg.name} request timed out after 25s`
        : `${cfg.name} fetch failed: ${fetchErr.message}`
    );
    err.status = isTimeout ? 504 : 502;
    throw err;
  }

  if (!res.ok) {
    let errMessage = `${cfg.name} returned HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMessage = `${cfg.name} error: ${errJson.error.message}`;
      }
    } catch {
      // ignore
    }
    if (apiKey && apiKey.length > 5) {
      errMessage = errMessage.split(apiKey).join('[REDACTED]');
    }
    const err = new Error(errMessage);
    err.status = res.status;
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error(`${cfg.name} returned invalid HTTP JSON body`);
    err.status = 502;
    err.invalidJson = true;
    throw err;
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== 'string') {
    const err = new Error(`${cfg.name} returned empty choice content`);
    err.status = 502;
    err.invalidJson = true;
    throw err;
  }

  // Parse the content string as JSON (handle markdown fences if present)
  let parsed;
  try {
    parsed = JSON.parse(rawContent.trim());
  } catch {
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const err = new Error(`${cfg.name} content is not valid JSON`);
      err.status = 502;
      err.invalidJson = true;
      throw err;
    }
  }

  return parsed;
}

export default {
  OPENAI_COMPATIBLE_PROVIDERS,
  hasApiKey,
  generateWithOpenAiCompatible,
};
