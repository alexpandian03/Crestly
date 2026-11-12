import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import app from '../../server/app.js';
import { getAiConfig, inferProviderFromModel } from '../../server/config/ai.js';
import {
  formatFluxEnglishPrompt,
  getHuggingFaceConfig,
  resolveContentImageDimensions,
  STYLE_DIRECTIONS,
} from '../../server/controllers/huggingFace.controller.js';
import {
  CF_FLUX_MODEL,
  generateImage as generateCloudflareImage,
  resetCloudflareShapeLogForTest,
} from '../../server/services/cloudflareImage.js';

const AI_ENV_KEYS = [
  'AI_PROVIDER',
  'AI_MODEL',
  'AI_API_KEY',
  'AI_ACCOUNT_ID',
  'AI_BASE_URL',
  'AI_FALLBACK_MODELS',
  'AI_FALLBACK_MODEL',
  'IMAGE_PROVIDER',
  'HF_API_KEY',
  'HF_IMAGE_MODEL',
  'HF_API_URL',
  'CF_ACCOUNT_ID',
  'CF_API_TOKEN',
  'CF_IMAGE_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_IMAGE_MODEL',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_IMAGE_MODEL',
  'OPENAI_MODEL',
];

describe('Poster Image Generation API (/api/posters/generate)', () => {
  const savedEnv = {};
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetCloudflareShapeLogForTest();
    for (const key of AI_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.IMAGE_PROVIDER = 'huggingface';
    process.env.HF_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
  });

  afterEach(() => {
    for (const key of AI_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    global.fetch = originalFetch;
  });

  it('returns 400 when prompt is missing or empty', async () => {
    const res = await request(app)
      .post('/api/posters/generate')
      .set('Accept', 'image/png')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('prompt is required');
  });

  it('returns 400 when HF_API_KEY is not configured or placeholder', async () => {
    process.env.HF_API_KEY = 'YOUR_HUGGINGFACE_KEY_HERE';

    const res = await request(app)
      .post('/api/posters/generate')
      .set('Accept', 'image/png')
      .send({ prompt: 'Tech Conference 2025' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('HF_API_KEY');
  });

  it('enhances prompt and returns image/png binary when Hugging Face succeeds', async () => {
    process.env.HF_API_KEY = 'test_hf_token_valid';

    // Mock global fetch response with a 1x1 fake PNG binary buffer
    const fakePngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
    ]);

    let capturedUrl = '';
    let capturedBody = null;
    let capturedHeaders = null;

    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;

      return {
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: async () => fakePngBytes.buffer,
      };
    });

    const res = await request(app)
      .post('/api/posters/generate')
      .set('Accept', 'image/png')
      .send({ prompt: 'Music festival in the park' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(capturedUrl).toContain('black-forest-labs/FLUX.1-schnell');
    expect(capturedHeaders.Authorization).toBe('Bearer test_hf_token_valid');
    expect(capturedBody.inputs).toContain('Music festival in the park');
    expect(capturedBody.inputs).toContain('clean minimal advertising poster style');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('builds distinct bright graphic poster prompts preserving full event details without 3D spotlight boilerplate', () => {
    const sportsPrompt = formatFluxEnglishPrompt('Annual sports day on 18 Oct, 8 AM, school ground. Include registration desk and medals.');
    const bloodPrompt = formatFluxEnglishPrompt('Blood donation camp on 12 Nov, 9 AM, community hall. Certificates for donors.');

    expect(sportsPrompt).toContain('"ANNUAL SPORTS DAY"');
    expect(sportsPrompt).toContain('18 Oct');
    expect(sportsPrompt).toContain('8 AM');
    expect(sportsPrompt).toMatch(/school ground/i);
    expect(sportsPrompt).toContain('Include registration desk and medals');
    expect(sportsPrompt).toContain('sports field');
    expect(sportsPrompt).toContain('flat modern vector poster art');
    expect(sportsPrompt).not.toMatch(/3D title|dramatic lighting/i);

    expect(bloodPrompt).toContain('"BLOOD DONATION CAMP"');
    expect(bloodPrompt).toContain('12 Nov');
    expect(bloodPrompt).toContain('Certificates for donors');
    expect(bloodPrompt).toContain('red heart emblem');
    expect(bloodPrompt).toContain('flat modern vector poster art');
    expect(bloodPrompt).not.toMatch(/3D title|dramatic lighting/i);
  });

  it('varies creative composition and palette across styleIndex values', () => {
    const prompts = STYLE_DIRECTIONS.map((_, idx) =>
      formatFluxEnglishPrompt('Annual sports day on 18 Oct, 8 AM, school ground', { styleIndex: idx })
    );

    const unique = new Set(prompts);
    expect(unique.size).toBe(STYLE_DIRECTIONS.length);
    for (const p of prompts) {
      expect(p).toContain('"ANNUAL SPORTS DAY"');
      expect(p).toContain('clean minimal advertising poster style');
      expect(p).not.toMatch(/3D title|dramatic lighting/i);
    }
  });

  it('rotates poster art direction across consecutive API requests without repeating default design', async () => {
    process.env.HF_API_KEY = 'hf_test_valid_token_key_12345';
    const capturedPrompts = [];
    const fakePng = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(600)]);

    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      if (String(url).includes('router.huggingface.co')) {
        capturedPrompts.push(JSON.parse(opts.body).inputs);
        return new Response(fakePng, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const first = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Annual sports day on 18 Oct, 8 AM, school ground' });
    const second = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Annual sports day on 18 Oct, 8 AM, school ground' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['x-poster-model']).toBe('black-forest-labs/FLUX.1-schnell');
    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[0]).not.toEqual(capturedPrompts[1]);
  });

  it('supports mock, huggingface, and cloudflare IMAGE_PROVIDER values and rejects unsupported ones', async () => {
    process.env.IMAGE_PROVIDER = 'huggingface';
    process.env.HF_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';

    const hfCfg = getHuggingFaceConfig();
    expect(hfCfg.provider).toBe('huggingface');
    expect(hfCfg.model).toBe('black-forest-labs/FLUX.1-schnell');
    expect(hfCfg.routerUrl).toContain('black-forest-labs/FLUX.1-schnell');

    process.env.IMAGE_PROVIDER = 'mock';
    const mockRes = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Annual sports day poster' });

    expect(mockRes.status).toBe(200);
    expect(mockRes.headers['content-type']).toContain('image/png');
    expect(mockRes.headers['x-poster-model']).toBe('mock');

    process.env.IMAGE_PROVIDER = 'unsupported-engine';
    const badRes = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Annual sports day poster' });

    expect(badRes.status).toBe(400);
    expect(badRes.body.success).toBe(false);
    expect(badRes.body.error.message).toContain('mock, huggingface, cloudflare');
  });

  it('calls Cloudflare Workers AI FLUX.2 via generateImage and parses result.image', async () => {
    process.env.CF_ACCOUNT_ID = 'cf-account-test';
    process.env.CF_API_TOKEN = 'cf-secret-token-test';

    const sampleJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const b64 = sampleJpegBytes.toString('base64');

    let calledUrl = '';
    let calledHeaders = null;
    let calledForm = null;

    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      calledUrl = url;
      calledHeaders = opts.headers;
      calledForm = opts.body;
      return new Response(JSON.stringify({ success: true, result: { image: b64 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const dataUrl = await generateCloudflareImage('Environment day "GREEN EARTH" | 5 Jun flat vector poster');
    expect(calledUrl).toBe(
      `https://api.cloudflare.com/client/v4/accounts/cf-account-test/ai/run/${CF_FLUX_MODEL}`
    );
    expect(calledHeaders.Authorization).toBe('Bearer cf-secret-token-test');
    expect(calledForm).toBeInstanceOf(FormData);
    expect(calledForm.get('prompt')).toBe('Environment day GREEN EARTH, 5 Jun flat vector poster');
    expect(calledForm.get('width')).toBe('768');
    expect(calledForm.get('height')).toBe('768');
    expect(dataUrl).toBe(`data:image/jpeg;base64,${b64}`);

    expect(resolveContentImageDimensions(1080, 1080)).toEqual({ width: 1024, height: 1024 });
    expect(resolveContentImageDimensions(1080, 810)).toEqual({ width: 1024, height: 768 });
  });

  it('logs alternate Cloudflare response shape once and throws clearly when no image exists', async () => {
    process.env.CF_ACCOUNT_ID = 'cf-account-test';
    process.env.CF_API_TOKEN = 'cf-secret-token-test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const b64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');
    global.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, result: { image_base64: b64 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(await generateCloudflareImage('First')).toBe(`data:image/jpeg;base64,${b64}`);
    expect(await generateCloudflareImage('Second')).toBe(`data:image/jpeg;base64,${b64}`);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(generateCloudflareImage('Missing image')).rejects.toThrow(/did not include an image/i);
  });

  it('generates binary JPEG from /api/posters/generate when IMAGE_PROVIDER=cloudflare and maps 429/quota errors cleanly', async () => {
    process.env.IMAGE_PROVIDER = 'cloudflare';
    process.env.CF_ACCOUNT_ID = 'cf-account-test';
    process.env.CF_API_TOKEN = 'cf-secret-token-test';

    const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(600, 1)]);
    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('api.cloudflare.com')) {
        return new Response(JSON.stringify({ success: true, result: { image: jpegBytes.toString('base64') } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const okRes = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Road safety awareness helmet poster' });

    expect(okRes.status).toBe(200);
    expect(okRes.headers['content-type']).toContain('image/jpeg');
    expect(okRes.headers['x-poster-model']).toBe(CF_FLUX_MODEL);
    expect(Buffer.isBuffer(okRes.body)).toBe(true);
    expect(okRes.body.length).toBe(jpegBytes.length);

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errors: [{ message: 'Daily neuron limit reached' }] }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const quotaRes = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Road safety awareness' });

    expect(quotaRes.status).toBe(429);
    expect(quotaRes.body.success).toBe(false);
    expect(quotaRes.body.error.message).toBe('Image quota reached. Try again later.');

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errors: [{ message: 'Upstream failure' }] }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const errRes = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Road safety awareness' });

    expect(errRes.status).toBe(500);
    expect(errRes.body.success).toBe(false);
    expect(errRes.body.error.message).toContain('Upstream failure');
  });

  it('declares Hugging Face runtime packages in root package.json for Render/Vercel installs', async () => {
    const rootPkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(rootPkg.dependencies['@gradio/client']).toBeTruthy();
    expect(rootPkg.dependencies['@huggingface/inference']).toBeTruthy();
    const gradio = await import('@gradio/client');
    const hf = await import('@huggingface/inference');
    expect(typeof gradio.Client).toBe('function');
    expect(typeof hf.InferenceClient).toBe('function');
  });

  it('resolves universal AI_MODEL and AI_API_KEY across all providers and reflects active model in /api/health', async () => {
    expect(inferProviderFromModel('@cf/black-forest-labs/flux-2-klein-9b')).toBe('cloudflare');
    expect(inferProviderFromModel('gemini-2.5-flash-image')).toBe('gemini');
    expect(inferProviderFromModel('imagen-3.0-generate-002')).toBe('gemini');
    expect(inferProviderFromModel('gpt-image-1')).toBe('openai');
    expect(inferProviderFromModel('stabilityai/stable-diffusion-3.5-large')).toBe('huggingface');

    // Universal AI_MODEL + AI_API_KEY overrides lingering legacy IMAGE_PROVIDER / HF_IMAGE_MODEL
    delete process.env.AI_PROVIDER;
    process.env.IMAGE_PROVIDER = 'huggingface';
    process.env.HF_IMAGE_MODEL = 'legacy/ignored-model';
    process.env.AI_MODEL = 'gemini-2.5-flash-image';
    process.env.AI_API_KEY = 'universal-gemini-key';

    const resolved = getAiConfig();
    expect(resolved.provider).toBe('gemini');
    expect(resolved.model).toBe('gemini-2.5-flash-image');
    expect(resolved.apiKey).toBe('universal-gemini-key');
    expect(getHuggingFaceConfig().model).toBe('gemini-2.5-flash-image');

    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.imageModel).toBe('gemini-2.5-flash-image');
    expect(healthRes.body.activeProviders).toBe('gemini (gemini-2.5-flash-image)');
  });

  it('switches to Gemini, OpenAI, or custom Cloudflare model solely via .env variables', async () => {
    const pngBytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(600, 2)]);

    // 1. Gemini via AI_MODEL + AI_API_KEY (auto-inferred provider)
    delete process.env.AI_PROVIDER;
    delete process.env.IMAGE_PROVIDER;
    process.env.AI_MODEL = 'gemini-2.5-flash-image';
    process.env.AI_API_KEY = 'gem-test-key';

    let capturedUrl = '';
    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: pngBytes.toString('base64') } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const gemRes = await request(app).post('/api/posters/generate').send({ prompt: 'Tech summit keynote' });
    expect(gemRes.status).toBe(200);
    expect(gemRes.headers['x-poster-model']).toBe('gemini-2.5-flash-image');
    expect(capturedUrl).toContain('models/gemini-2.5-flash-image:generateContent?key=gem-test-key');

    // 2. OpenAI / custom base URL via AI_MODEL + AI_API_KEY + AI_BASE_URL
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'gpt-image-1';
    process.env.AI_API_KEY = 'sk-universal-test';
    process.env.AI_BASE_URL = 'https://proxy.example.com/v1';

    let openAiBody = null;
    let openAiAuth = '';
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      capturedUrl = String(url);
      openAiAuth = opts.headers.Authorization;
      openAiBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({ data: [{ b64_json: pngBytes.toString('base64') }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const oaiRes = await request(app).post('/api/posters/generate').send({ prompt: 'Music night' });
    expect(oaiRes.status).toBe(200);
    expect(oaiRes.headers['x-poster-model']).toBe('gpt-image-1');
    expect(capturedUrl).toBe('https://proxy.example.com/v1/images/generations');
    expect(openAiAuth).toBe('Bearer sk-universal-test');
    expect(openAiBody.model).toBe('gpt-image-1');

    // 3. Cloudflare using custom AI_MODEL without falling back behind user's back
    delete process.env.AI_BASE_URL;
    process.env.AI_PROVIDER = 'cloudflare';
    process.env.AI_MODEL = '@cf/leonardo/lucid-origin';
    process.env.AI_API_KEY = 'cf-universal-token';
    process.env.AI_ACCOUNT_ID = 'cf-universal-account';

    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ success: true, result: { image: pngBytes.toString('base64') } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const cfRes = await request(app).post('/api/posters/generate').send({ prompt: 'Science fair' });
    expect(cfRes.status).toBe(200);
    expect(cfRes.headers['x-poster-model']).toBe('@cf/leonardo/lucid-origin');
    expect(capturedUrl).toBe(
      'https://api.cloudflare.com/client/v4/accounts/cf-universal-account/ai/run/@cf/leonardo/lucid-origin'
    );
  });
});
