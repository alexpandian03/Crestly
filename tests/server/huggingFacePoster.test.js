import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';
import {
  formatFluxEnglishPrompt,
  getHuggingFaceConfig,
  STYLE_DIRECTIONS,
} from '../../server/controllers/huggingFace.controller.js';

describe('Hugging Face Poster Generation API (/api/posters/generate)', () => {
  const originalEnv = process.env.HF_API_KEY;
  const originalProvider = process.env.IMAGE_PROVIDER;
  const originalModel = process.env.HF_IMAGE_MODEL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.IMAGE_PROVIDER = 'huggingface';
    process.env.HF_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.HF_API_KEY;
    else process.env.HF_API_KEY = originalEnv;
    if (originalProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = originalProvider;
    if (originalModel === undefined) delete process.env.HF_IMAGE_MODEL;
    else process.env.HF_IMAGE_MODEL = originalModel;
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

  it('builds distinct bright graphic poster prompts per event without dark 3D spotlight boilerplate or schedule clutter', () => {
    const sportsPrompt = formatFluxEnglishPrompt('Annual sports day on 18 Oct, 8 AM, school ground');
    const bloodPrompt = formatFluxEnglishPrompt('Blood donation camp on 12 Nov, 9 AM, community hall. Certificates for donors.');

    expect(sportsPrompt).toContain('"ANNUAL SPORTS DAY"');
    expect(sportsPrompt).toContain('sports field');
    expect(sportsPrompt).toContain('flat modern vector poster art');
    expect(sportsPrompt).not.toContain('18 Oct');
    expect(sportsPrompt).not.toContain('8 AM');
    expect(sportsPrompt).not.toMatch(/3D title|dramatic lighting/i);

    expect(bloodPrompt).toContain('"BLOOD DONATION CAMP"');
    expect(bloodPrompt).toContain('red heart emblem');
    expect(bloodPrompt).toContain('flat modern vector poster art');
    expect(bloodPrompt).not.toContain('12 Nov');
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

  it('uses configured IMAGE_PROVIDER and HF_IMAGE_MODEL dynamically and rejects non-huggingface provider', async () => {
    process.env.IMAGE_PROVIDER = 'huggingface';
    process.env.HF_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
    process.env.HF_API_KEY = 'hf_test_valid_token_key_12345';

    const cfg = getHuggingFaceConfig();
    expect(cfg.provider).toBe('huggingface');
    expect(cfg.model).toBe('black-forest-labs/FLUX.1-schnell');
    expect(cfg.routerUrl).toContain('black-forest-labs/FLUX.1-schnell');

    process.env.IMAGE_PROVIDER = 'mock';
    const res = await request(app)
      .post('/api/posters/generate')
      .send({ prompt: 'Annual sports day poster' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('IMAGE_PROVIDER=huggingface');
  });
});
