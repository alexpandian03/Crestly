/**
 * Google Gemini LLM Provider (plain fetch, no heavy SDKs)
 */
export async function generateWithGemini({ prompt, systemPrompt, signal, maxTokens = 1000 }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Gemini API key is not configured.');
    err.status = 401;
    err.noKey = true;
    throw err;
  }

  let model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  if (model.includes('2.5')) {
    model = 'gemini-2.0-flash';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\nUser Event Information:\n"""${prompt}"""`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: maxTokens,
    },
  };

  const fetchSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
    : AbortSignal.timeout(25000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: fetchSignal,
    });
  } catch (fetchErr) {
    if (signal?.aborted) throw fetchErr;
    const timeoutErr = new Error(`Gemini request timed out or failed: ${fetchErr.message}`);
    timeoutErr.status = 504;
    throw timeoutErr;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errMsg = `Gemini API returned status ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errMsg = parsed.error?.message || errMsg;
    } catch {
      // Ignore
    }
    const err = new Error(errMsg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const err = new Error('Gemini returned an empty response');
    err.status = 502;
    throw err;
  }

  let cleanText = rawText.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.slice(7).replace(/```$/, '').trim();
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.slice(3).replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(cleanText);
  } catch {
    const err = new Error('Gemini content is not valid JSON');
    err.status = 502;
    err.invalidJson = true;
    throw err;
  }
}

export function hasApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export default { generateWithGemini, hasApiKey };

