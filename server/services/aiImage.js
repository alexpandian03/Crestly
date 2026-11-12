/**
 * Universal image generation adapters for Gemini (Imagen / Gemini Image models)
 * and OpenAI / OpenAI-compatible image endpoints.
 */

function parseErrorDetail(payload, rawText) {
  return (
    payload?.error?.message ||
    (Array.isArray(payload?.errors) ? payload.errors.map((e) => e?.message || e).filter(Boolean).join('; ') : '') ||
    payload?.message ||
    (rawText && !/^\s*</.test(rawText) ? rawText.slice(0, 220) : '')
  );
}

async function readJsonSafely(response) {
  const rawText = await response.text();
  try {
    return { rawText, payload: rawText ? JSON.parse(rawText) : null };
  } catch {
    return { rawText, payload: null };
  }
}

function buildApiError(providerLabel, status, payload, rawText) {
  const detail = parseErrorDetail(payload, rawText);
  const message = detail
    ? `${providerLabel} request failed (${status}): ${detail}`
    : `${providerLabel} request failed with status ${status}`;
  const err = new Error(message);
  err.status = status;
  return err;
}

function resolveAspectRatio(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '1:1';
  const ratio = w / h;
  if (Math.abs(ratio - 1) <= 0.12) return '1:1';
  if (ratio >= 1.55) return '16:9';
  if (ratio > 1) return '4:3';
  if (ratio <= 0.65) return '9:16';
  return '3:4';
}

function resolveOpenAiSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '1024x1024';
  const ratio = w / h;
  if (Math.abs(ratio - 1) <= 0.12) return '1024x1024';
  return ratio > 1 ? '1792x1024' : '1024x1792';
}

function isRetryableAttempt(err) {
  const status = Number(err?.status || 0);
  return status >= 500 || status === 404;
}

/**
 * Generates an image using Google Gemini / Imagen REST APIs with the configured model and API key.
 */
export async function generateGeminiImage(prompt, config = {}) {
  const apiKey = String(config.apiKey || '').trim();
  const baseUrl = String(config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const candidates =
    Array.isArray(config.fallbackModels) && config.fallbackModels.length > 0
      ? config.fallbackModels
      : [config.model].filter(Boolean);

  if (!apiKey) {
    const err = new Error('API key is not configured for gemini. Set AI_API_KEY or GEMINI_API_KEY in your .env file.');
    err.status = 400;
    throw err;
  }
  if (candidates.length === 0) {
    const err = new Error('AI_MODEL is required for gemini. Set AI_MODEL or GEMINI_IMAGE_MODEL in your .env file.');
    err.status = 400;
    throw err;
  }

  let lastError = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const model = candidates[i];
    const isImagen = model.toLowerCase().startsWith('imagen');
    const endpoint = isImagen
      ? `${baseUrl}/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(apiKey)}`
      : `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = isImagen
      ? {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: resolveAspectRatio(config.width, config.height),
          },
        }
      : {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { rawText, payload } = await readJsonSafely(response);
      const err = buildApiError('Gemini AI', response.status, payload, rawText);
      if (!lastError) lastError = err;
      if (isRetryableAttempt(err) && i < candidates.length - 1) continue;
      throw err;
    }

    const data = await response.json();
    const imagenB64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (imagenB64) {
      return {
        buffer: Buffer.from(imagenB64, 'base64'),
        contentType: data?.predictions?.[0]?.mimeType || 'image/png',
        model,
      };
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p?.inlineData?.data);
    if (imagePart?.inlineData?.data) {
      return {
        buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
        contentType: imagePart.inlineData.mimeType || 'image/png',
        model,
      };
    }

    const missingErr = new Error(`Gemini AI (${model}) response did not include an image.`);
    if (!lastError) lastError = missingErr;
    if (i < candidates.length - 1) continue;
    throw missingErr;
  }

  throw lastError || new Error('Gemini AI image generation failed.');
}

/**
 * Generates an image using OpenAI or any OpenAI-compatible /images/generations endpoint.
 */
export async function generateOpenAiImage(prompt, config = {}) {
  const apiKey = String(config.apiKey || '').trim();
  const baseUrl = String(config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const candidates =
    Array.isArray(config.fallbackModels) && config.fallbackModels.length > 0
      ? config.fallbackModels
      : [config.model].filter(Boolean);

  if (!apiKey) {
    const err = new Error('API key is not configured for openai. Set AI_API_KEY or OPENAI_API_KEY in your .env file.');
    err.status = 400;
    throw err;
  }
  if (candidates.length === 0) {
    const err = new Error('AI_MODEL is required for openai. Set AI_MODEL or OPENAI_MODEL in your .env file.');
    err.status = 400;
    throw err;
  }

  const endpoint = baseUrl.endsWith('/images/generations') ? baseUrl : `${baseUrl}/images/generations`;
  const size = resolveOpenAiSize(config.width, config.height);

  let lastError = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const model = candidates[i];
    const lowerModel = model.toLowerCase();
    const body = {
      model,
      prompt,
      n: 1,
      size,
    };
    if (!lowerModel.startsWith('gpt-image') && !lowerModel.startsWith('chatgpt-image')) {
      body.response_format = 'b64_json';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { rawText, payload } = await readJsonSafely(response);
      const err = buildApiError('OpenAI Image', response.status, payload, rawText);
      if (!lastError) lastError = err;
      if (isRetryableAttempt(err) && i < candidates.length - 1) continue;
      throw err;
    }

    const data = await response.json();
    const first = data?.data?.[0];
    if (first?.b64_json) {
      return {
        buffer: Buffer.from(first.b64_json, 'base64'),
        contentType: 'image/png',
        model,
      };
    }

    if (first?.url) {
      const imgRes = await fetch(first.url);
      if (imgRes.ok) {
        const arr = await imgRes.arrayBuffer();
        return {
          buffer: Buffer.from(arr),
          contentType: imgRes.headers?.get('content-type') || 'image/png',
          model,
        };
      }
    }

    const missingErr = new Error(`OpenAI Image (${model}) response did not include an image.`);
    if (!lastError) lastError = missingErr;
    if (i < candidates.length - 1) continue;
    throw missingErr;
  }

  throw lastError || new Error('OpenAI Image generation failed.');
}
