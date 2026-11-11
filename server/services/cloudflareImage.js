const CF_FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';

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

/**
 * Generates an image with Cloudflare Workers AI (@cf/black-forest-labs/flux-1-schnell)
 * and returns a base64 JPEG data URL.
 */
export async function generateImage(prompt) {
  const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!cleanPrompt) {
    throw new Error('A prompt is required to generate an image with Cloudflare Workers AI.');
  }

  const accountId = String(process.env.CF_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CF_API_TOKEN || '').trim();
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Workers AI credentials are missing (CF_ACCOUNT_ID / CF_API_TOKEN).');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_FLUX_MODEL}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: cleanPrompt, steps: 4 }),
  });

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
    throw err;
  }

  if (contentType.startsWith('image/')) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      throw new Error('Cloudflare Workers AI returned an empty image response.');
    }
    const mime = contentType.split(';')[0] || 'image/jpeg';
    logUnexpectedShapeOnce({ contentType, byteLength: buffer.length });
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`Cloudflare Workers AI returned invalid JSON: ${parseErr.message}`);
  }

  if (data?.success === false) {
    throw new Error(extractCloudflareErrorMessage(response.status, data, ''));
  }

  const b64 = extractBase64FromPayload(data);
  if (!b64) {
    logUnexpectedShapeOnce(data);
    throw new Error('Cloudflare Workers AI response did not include an image.');
  }

  return formatDataUrl(b64, 'image/jpeg');
}

export function resetCloudflareShapeLogForTest() {
  loggedUnexpectedShape = false;
}

export { CF_FLUX_MODEL };
