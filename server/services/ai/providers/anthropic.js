/**
 * Anthropic Claude Provider (plain fetch)
 */
export async function generateWithAnthropic({ prompt, systemPrompt, signal }) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Anthropic provider not configured. Please set ANTHROPIC_API_KEY in your environment.');
    err.status = 500;
    throw err;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    const err = new Error(`Anthropic error: HTTP ${res.status}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  return JSON.parse(text);
}

export default { generateWithAnthropic };
