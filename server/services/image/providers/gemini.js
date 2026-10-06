function imageError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const BLOCKED_MESSAGE = 'That idea is not something we can draw. Try plainer words about the event.';

/**
 * Gemini picture provider (plain fetch, no SDK). The key travels in a header, never in the
 * address, so it cannot end up in a logged URL.
 * Returns { base64, mimeType } — the bytes stay in memory and are handed straight to Cloudinary.
 */
export async function generateWithGeminiImage({ prompt, aspectRatio = '1:1', signal }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw imageError(
      'Picture making is not turned on for this app yet. An administrator needs to add the picture key.',
      503
    );
  }

  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio },
        },
      }),
      signal,
    }
  );

  if (!res.ok) {
    let reason = '';
    try {
      reason = (await res.json())?.error?.message || '';
    } catch {
      /* The body is not the point; the status is. */
    }
    if (res.status === 404 || /not found|unsupported model/i.test(reason)) {
      throw imageError('The picture service we were told to use is not available. Please try again later.', 503);
    }
    throw imageError(`The picture service answered ${res.status}. Please try again.`, 502);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (/SAFETY|IMAGE_SAFETY|PROHIBITED|BLOCKLIST/.test(String(candidate?.finishReason || ''))) {
    throw imageError(BLOCKED_MESSAGE, 400);
  }
  if (candidate?.finishReason === 'NO_IMAGE') {
    throw imageError('The picture service did not draw anything for that. Try other words.', 502);
  }
  const blocked = String(data?.promptFeedback?.blockReason || '');
  if (blocked && blocked !== 'NONE') throw imageError(BLOCKED_MESSAGE, 400);

  const part = (candidate?.content?.parts || []).find((item) => item?.inlineData?.data);
  if (!part) throw imageError('The picture service sent no picture. Please try again.', 502);

  return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
}

export default { generateWithGeminiImage };
