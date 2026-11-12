import { DEFAULT_MODELS, getAiConfig } from '../config/ai.js';

const CF_FLUX_MODEL = DEFAULT_MODELS.cloudflare;

let loggedUnexpectedShape = false;

function sanitizeValueForLog(value, depth = 0) {
  if (depth > 3) return '[Nested]';
  if (typeof value === 'string') {
    return value.length > 80 ? `<string len=${value.length}>` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => sanitizeValueForLog(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const summary = {};
    for (const key of Object.keys(value).slice(0, 15)) {
      summary[key] = sanitizeValueForLog(value[key], depth + 1);
    }
    return summary;
  }
  return value;
}

function logUnexpectedShapeOnce(shape) {
  if (loggedUnexpectedShape) return;
  loggedUnexpectedShape = true;
  console.warn('Cloudflare Workers AI returned unexpected image response shape:', sanitizeValueForLog(shape));
}

function formatDataUrl(rawImage, mimeType = 'image/jpeg') {
  const trimmed = String(rawImage || '').trim();
  if (!trimmed) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
    return trimmed;
  }
  const cleanBase64 = trimmed.replace(/\s+/g, '');
  return `data:${mimeType};base64,${cleanBase64}`;
}

function extractCloudflareErrorMessage(status, payload, rawText) {
  const errorMessages = Array.isArray(payload?.errors)
    ? payload.errors.map((entry) => entry?.message || entry).filter(Boolean)
    : [];
  const detail =
    errorMessages.join('; ') ||
    payload?.error?.message ||
    (typeof payload?.error === 'string' ? payload.error : '') ||
    payload?.message ||
    (rawText && !/^\s*</.test(rawText) ? rawText.slice(0, 220) : '');

  return detail
    ? `Cloudflare Workers AI request failed (${status}): ${detail}`
    : `Cloudflare Workers AI request failed with status ${status}`;
}

function extractBase64FromPayload(data) {
  const primary = data?.result?.image;
  if (typeof primary === 'string' && primary.trim()) {
    return primary;
  }

  const fallbackCandidates = [
    data?.result?.image_base64,
    data?.result?.b64_json,
    data?.result?.data?.[0]?.b64_json,
    data?.image,
    typeof data?.result === 'string' ? data.result : '',
  ];
  const matched = fallbackCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (matched) {
    logUnexpectedShapeOnce(data);
    return matched;
  }

  return '';
}

function getCloudflareModelCandidates(config, overrideModel) {
  const list = [overrideModel, config.model, ...(config.fallbackModels || [])].filter(Boolean);
  return [...new Set(list)];
}

function clampCloudflareDimension(value, fallback = 1024) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const clamped = Math.min(1024, Math.max(512, num));
  return Math.round(clamped / 16) * 16;
}

function buildCloudflareRequest(model, prompt, apiToken, { width = 1024, height = 1024 } = {}) {
  const safeW = clampCloudflareDimension(width, 1024);
  const safeH = clampCloudflareDimension(height, 1024);
  const lower = String(model || '').toLowerCase();
  if (lower.includes('flux-2')) {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(safeW));
    form.append('height', String(safeH));
    return {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    };
  }

  const body =
    lower.includes('flux-1') || lower.includes('schnell')
      ? { prompt, steps: 4 }
      : { prompt, width: safeW, height: safeH };

  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Generates an image with Cloudflare Workers AI using the active AI_MODEL / AI_API_KEY
 * (or legacy CF_IMAGE_MODEL / CF_API_TOKEN) and returns a base64 data URL.
 */
export async function generateImage(prompt, options = {}) {
  const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!cleanPrompt) {
    throw new Error('A prompt is required to generate an image with Cloudflare Workers AI.');
  }

  const aiConfig = getAiConfig({ ...process.env, AI_PROVIDER: 'cloudflare', IMAGE_PROVIDER: 'cloudflare' });
  const accountId = String(options.accountId || aiConfig.accountId || '').trim();
  const apiToken = String(options.apiKey || aiConfig.apiKey || '').trim();
  const baseUrl = String(options.baseUrl || aiConfig.baseUrl || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');
  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare Workers AI credentials are missing (set AI_ACCOUNT_ID / AI_API_KEY or CF_ACCOUNT_ID / CF_API_TOKEN).'
    );
  }

  const candidates = getCloudflareModelCandidates(aiConfig, options.model);
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const model = candidates[i];
    const endpoint = `${baseUrl}/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(endpoint, buildCloudflareRequest(model, cleanPrompt, apiToken, options));
    if (!response) {
      break;
    }

    const contentType = String(response.headers?.get('content-type') || '').toLowerCase();

    if (!response.ok) {
      let payload = null;
      let rawText = '';
      try {
        rawText = await response.text();
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }
      const err = new Error(extractCloudflareErrorMessage(response.status, payload, rawText));
      err.status = response.status;
      if (!lastError) lastError = err;

      // Quota exhaustion is account-wide and should fail fast; transient 5xx can fall back cleanly.
      const isRetryable = response.status >= 500 || response.status === 404;
      if (isRetryable && i < candidates.length - 1) {
        continue;
      }
      throw err;
    }

    if (contentType.startsWith('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        const emptyErr = new Error('Cloudflare Workers AI returned an empty image response.');
        if (!lastError) lastError = emptyErr;
        if (i < candidates.length - 1) continue;
        throw emptyErr;
      }
      const mime = contentType.split(';')[0] || 'image/jpeg';
      logUnexpectedShapeOnce({ contentType, byteLength: buffer.length });
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      const jsonErr = new Error(`Cloudflare Workers AI returned invalid JSON: ${parseErr.message}`);
      if (!lastError) lastError = jsonErr;
      if (i < candidates.length - 1) continue;
      throw jsonErr;
    }

    if (data?.success === false) {
      const apiErr = new Error(extractCloudflareErrorMessage(response.status, data, ''));
      if (!lastError) lastError = apiErr;
      if (i < candidates.length - 1) continue;
      throw apiErr;
    }

    const b64 = extractBase64FromPayload(data);
    if (!b64) {
      logUnexpectedShapeOnce(data);
      const missingErr = new Error('Cloudflare Workers AI response did not include an image.');
      if (!lastError) lastError = missingErr;
      throw missingErr;
    }

    return formatDataUrl(b64, 'image/jpeg');
  }

  throw lastError || new Error('Cloudflare Workers AI image generation failed.');
}

export function resetCloudflareShapeLogForTest() {
  loggedUnexpectedShape = false;
}

export { CF_FLUX_MODEL };
