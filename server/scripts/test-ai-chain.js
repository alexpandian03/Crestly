import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

import {
  executeWithChain,
  getChainProviders,
  hasProviderKey,
  isProviderRateLimited,
  recordRateLimit,
  clearRateLimits,
  getFromCache,
  setInCache,
  clearAiCache,
  createCacheKey,
} from '../services/ai/chain.js';
import { generateVariants, generateContent, llmProviderName } from '../services/ai/index.js';
import { generateMockVariants } from '../services/ai/providers/mock.js';
import { OPENAI_COMPATIBLE_PROVIDERS } from '../services/ai/providers/openaiCompatible.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    process.exitCode = 1;
  }
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  clearRateLimits();
  clearAiCache();
}

console.log('\n--- AI Provider Chain & Variants Tests ---\n');

await (async () => {
  // Test 1: Provider chain ordering and mock is always last
  await test('getChainProviders always places mock at the very end', () => {
    process.env.LLM_CHAIN = 'mock,groq,gemini,cerebras';
    const chain1 = getChainProviders();
    assert.strictEqual(chain1[chain1.length - 1], 'mock');
    assert.strictEqual(chain1.filter((p) => p === 'mock').length, 1);

    process.env.LLM_CHAIN = 'cerebras,mistral';
    const chain2 = getChainProviders();
    assert.strictEqual(chain2[chain2.length - 1], 'mock');
  });

  // Test 2: Skipping provider without key
  await test('Skipping a provider without an API key', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.QGORQ_API_KEY;
    delete process.env.QORQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.MISTERAL_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;

    assert.strictEqual(hasProviderKey('groq'), false);
    assert.strictEqual(hasProviderKey('cerebras'), false);
    assert.strictEqual(hasProviderKey('gemini'), false);
    assert.strictEqual(hasProviderKey('mock'), true);

    process.env.LLM_PROVIDER = 'chain';
    process.env.LLM_CHAIN = 'groq,cerebras,mock';

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not have called fetch for unkeyed providers');
    };

    try {
      const res = await executeWithChain({
        prompt: 'Blood donation camp this Sunday',
        mode: 'design',
      });
      assert.strictEqual(fetchCalled, false, 'Fetch must not be called when keys are missing');
      assert.strictEqual(res.provider, 'mock');
      assert.ok(res.result);
    } finally {
      restoreEnv();
    }
  });

  // Test 3: Fallback on 429 and 10-minute cooldown
  await test('Fallback on 429 rate limit and remember cooldown for 10 minutes', async () => {
    process.env.LLM_PROVIDER = 'chain';
    process.env.LLM_CHAIN = 'groq,cerebras,mock';
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.CEREBRAS_API_KEY = 'test-cerebras-key';

    let groqCalls = 0;
    let cerebrasCalls = 0;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('groq.com')) {
        groqCalls++;
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('cerebras.ai')) {
        cerebrasCalls++;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    archetype: 'photo-hero',
                    variant: 1,
                    fields: {
                      kicker: 'Health',
                      title: 'Blood Camp',
                      subtitle: 'Donate blood today',
                      bullets: ['Free checkup'],
                      date: 'Sunday',
                      time: '9 AM',
                      venue: 'City Hospital',
                      cta: 'Open to all',
                      photoKeywords: 'medical blood',
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${u}`);
    };

    try {
      // First call: Groq returns 429, falls back to Cerebras
      const first = await executeWithChain({ prompt: 'Blood donation camp', mode: 'design' });
      assert.strictEqual(groqCalls, 1, 'Groq should have been called once');
      assert.strictEqual(cerebrasCalls, 1, 'Cerebras should have succeeded as fallback');
      assert.strictEqual(first.provider, 'cerebras');
      assert.strictEqual(isProviderRateLimited('groq'), true, 'Groq must be marked rate-limited');

      // Second call: Groq should be skipped immediately due to 10-minute cooldown
      const second = await executeWithChain({ prompt: 'Another event', mode: 'design' });
      assert.strictEqual(groqCalls, 1, 'Groq must be skipped while in 429 cooldown');
      assert.strictEqual(cerebrasCalls, 2, 'Cerebras should be used directly');
      assert.strictEqual(second.provider, 'cerebras');
    } finally {
      restoreEnv();
    }
  });

  // Test 4: Fallback on timeout (25 seconds)
  await test('Fallback on timeout moves to next provider', async () => {
    process.env.LLM_PROVIDER = 'chain';
    process.env.LLM_CHAIN = 'groq,mock';
    process.env.GROQ_API_KEY = 'test-groq-key';

    globalThis.fetch = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };

    try {
      const res = await executeWithChain({ prompt: 'Workshop on robotics', mode: 'design' });
      assert.strictEqual(res.provider, 'mock', 'Must fall back to mock on timeout');
      assert.ok(res.result);
    } finally {
      restoreEnv();
    }
  });

  // Test 5: Fallback on invalid JSON
  await test('Fallback on invalid JSON response from provider', async () => {
    process.env.LLM_PROVIDER = 'chain';
    process.env.LLM_CHAIN = 'groq,mock';
    process.env.GROQ_API_KEY = 'test-groq-key';

    globalThis.fetch = async () => {
      return new Response('Not JSON at all, completely malformed <html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    };

    try {
      const res = await executeWithChain({ prompt: 'Annual sports day', mode: 'design' });
      assert.strictEqual(res.provider, 'mock', 'Must fall back to mock when provider outputs invalid JSON');
      assert.ok(res.result);
    } finally {
      restoreEnv();
    }
  });

  // Test 6: Never print or leak API keys in logs or responses
  await test('No API keys appear in logs or responses on failures', async () => {
    const SECRET_KEY = 'gsk_secret_1234567890abcdef1234567890';
    process.env.LLM_PROVIDER = 'chain';
    process.env.LLM_CHAIN = 'groq,mock';
    process.env.GROQ_API_KEY = SECRET_KEY;

    let logged = '';
    const origWarn = console.warn;
    const origError = console.error;
    console.warn = (...args) => {
      logged += args.join(' ') + '\n';
    };
    console.error = (...args) => {
      logged += args.join(' ') + '\n';
    };

    globalThis.fetch = async () => {
      // Simulate an error mentioning the key or header
      return new Response(JSON.stringify({ error: { message: `Invalid authentication with key ${SECRET_KEY}` } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const res = await executeWithChain({ prompt: 'Event description', mode: 'design' });
      console.warn = origWarn;
      console.error = origError;

      assert.strictEqual(res.provider, 'mock');
      assert.strictEqual(logged.includes(SECRET_KEY), false, 'Secret key must NEVER appear in logs');
      const responseString = JSON.stringify(res);
      assert.strictEqual(responseString.includes(SECRET_KEY), false, 'Secret key must NEVER appear in response');
    } finally {
      console.warn = origWarn;
      console.error = origError;
      restoreEnv();
    }
  });

  // Test 7: variants=3 returns 3 posters with different layouts
  await test('variants=3 returns 3 posters with different layouts', async () => {
    process.env.LLM_PROVIDER = 'mock';

    const brandKit = {
      orgName: 'Green Earth Foundation',
      colors: { primary: '#059669', background: '#ffffff', text: '#111827' },
      fonts: { heading: 'Inter', body: 'Inter' },
    };

    const res = await generateVariants({
      prompt: 'Tree Planting Drive on 15th August at 9 AM, Nehru Park. Tools provided, free admission.',
      brandKit,
    });

    assert.ok(res.posters, 'Must return posters array');
    assert.strictEqual(res.posters.length, 3, 'Must return exactly 3 posters');
    assert.ok(res.provider, 'Must specify provider name');

    // Verify different layouts
    const layouts = res.posters.map((p) => `${p.design.archetype}:${p.design.variant}`);
    const uniqueLayouts = new Set(layouts);
    assert.ok(uniqueLayouts.size >= 2, `Expected different layouts across variants, got: ${layouts.join(', ')}`);

    // Verify all posters have valid design and content
    for (let i = 0; i < res.posters.length; i++) {
      const p = res.posters[i];
      assert.ok(p.design?.elements?.length > 0, `Poster ${i} must have design elements`);
      assert.ok(p.content?.title, `Poster ${i} must have title`);
      // Core facts must be preserved
      assert.ok(p.content.venue.includes('Nehru Park'), `Poster ${i} must preserve venue`);
    }

    // Verify kickers and subtitles differ between variants
    const subtitles = res.posters.map((p) => p.content.tagline || p.content.subtitle);
    const uniqueSubtitles = new Set(subtitles.filter(Boolean));
    assert.ok(uniqueSubtitles.size >= 2, 'Variants must have different subtitles/angles');
  });

  // Test 8: Tamil text passes through unchanged
  await test('Tamil text passes through unchanged across all 3 variants', async () => {
    process.env.LLM_PROVIDER = 'mock';

    const tamilPrompt = 'இரத்த தான முகாம் - ஞாயிறு காலை 9 மணி, காந்தி மண்டபம், சென்னை. அனைவரும் வருக.';
    const res = await generateVariants({
      prompt: tamilPrompt,
      brandKit: { orgName: 'தமிழ் சங்கம்' },
    });

    assert.strictEqual(res.posters.length, 3);

    for (let i = 0; i < res.posters.length; i++) {
      const p = res.posters[i];
      // Title must contain Tamil characters
      assert.ok(/[\u0B80-\u0BFF]/.test(p.content.title), `Poster ${i} title must contain Tamil characters: ${p.content.title}`);
      // Tagline/subtitle must contain Tamil characters if present
      if (p.content.tagline) {
        assert.ok(/[\u0B80-\u0BFF]/.test(p.content.tagline), `Poster ${i} tagline must contain Tamil characters`);
      }
      // Bullets must contain Tamil
      if (p.content.details && p.content.details.length > 0) {
        assert.ok(p.content.details.some((d) => /[\u0B80-\u0BFF]/.test(d)), `Poster ${i} details must contain Tamil`);
      }
      // Venue must contain Tamil
      assert.ok(/[\u0B80-\u0BFF]/.test(p.content.venue), `Poster ${i} venue must contain Tamil`);
    }
  });

  // Test 9: In-memory cache for 10 minutes
  await test('10-minute in-memory cache stores and retrieves responses', () => {
    const key = createCacheKey('Annual Sports Gala', { mode: 'ai', variants: 1 });
    assert.strictEqual(getFromCache(key), null);

    const testData = { success: true, data: { content: { title: 'Annual Sports Gala' } } };
    setInCache(key, testData);

    const retrieved = getFromCache(key);
    assert.deepStrictEqual(retrieved, testData);

    clearAiCache();
    assert.strictEqual(getFromCache(key), null);
  });
})();

console.log(`\nAI Chain test suite finished: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
