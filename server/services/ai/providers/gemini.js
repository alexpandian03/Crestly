/**
 * Google Gemini LLM Provider (plain fetch, no heavy SDKs)
 */
export async function generateWithGemini({ prompt, systemPrompt, signal }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Gemini API key is not configured. Set GEMINI_API_KEY in your environment variables.');
    err.status = 500;
    throw err;
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
      temperature: 0.5,
      maxOutputTokens: 500,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

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
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const err = new Error('Gemini returned an empty response');
    err.status = 502;
    throw err;
  }

  return JSON.parse(rawText);
}

export default { generateWithGemini };
