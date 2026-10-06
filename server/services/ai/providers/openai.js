/**
 * OpenAI Provider (plain fetch, json_object mode)
 */
export async function generateWithOpenAI({ prompt, systemPrompt, signal }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('OpenAI provider not configured. Please set OPENAI_API_KEY in your environment.');
    err.status = 500;
    throw err;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.5,
    }),
    signal,
  });

  if (!res.ok) {
    const err = new Error(`OpenAI error: HTTP ${res.status}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

export default { generateWithOpenAI };
