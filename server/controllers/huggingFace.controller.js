import storageService from '../services/storage.js';
import { generateImage as generateCloudflareImage } from '../services/cloudflareImage.js';
import { generateGeminiImage, generateOpenAiImage } from '../services/aiImage.js';
import { DEFAULT_MODELS, SUPPORTED_AI_PROVIDERS, getAiConfig } from '../config/ai.js';
import { extractEventFacts } from '../../shared/fallbackParser.js';

/**
 * Universal AI Poster Image Generation Controller
 * Reads AI_PROVIDER / AI_MODEL / AI_API_KEY (or legacy provider env vars) from server/config/ai.js.
 */

const HF_BASE_URL = 'https://huggingface.co';
const HF_MODEL = DEFAULT_MODELS.huggingface;
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_MODEL_ENDPOINT = `${HF_BASE_URL}/${HF_MODEL}`;

export const SUPPORTED_IMAGE_PROVIDERS = SUPPORTED_AI_PROVIDERS;

export function getHuggingFaceConfig() {
  return getAiConfig();
}

const MOCK_POSTER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

// Event-tailored bright flat graphic poster themes (avoids dark spotlight / 3D boilerplate)
const POSTER_THEMES = [
  {
    match: /\b(sports?|athletics?|marathon|running|runner|race|cricket|football|soccer|basketball|badminton|volleyball|tournament|championship|match|games?)\b/i,
    headlineColors: 'bold red and white outlined flat display typography',
    canvas: 'a bright crisp white top background',
    scene:
      'vibrant green school sports field, red running track, goalposts, trees, energetic athletes, soccer ball and shiny gold medal flat vector illustrations',
  },
  {
    match: /\b(blood|donat\w*|medical|health|hospital|clinic|dental|eye camp|vaccin\w*)\b/i,
    headlineColors: 'bold vibrant crimson red and navy flat graphic display typography',
    canvas: 'a crisp warm cream-white background',
    scene:
      'bright red heart emblem, caring helping hands, medical cross and red blood drop flat vector illustrations in a hopeful community healthcare scene',
  },
  {
    match: /\b(birthday|bday|anniversary|party)\b/i,
    headlineColors: 'bold festive coral, royal blue and golden flat display typography',
    canvas: 'a cheerful bright cream-white background',
    scene:
      'colorful floating party balloons, festive bunting flags, confetti ribbons and celebration cake flat vector illustrations',
  },
  {
    match: /\b(awards?|felicitat\w*|honor\w*|honour\w*|ceremony|troph(?:y|ies)|prizes?|graduation|convocation)\b/i,
    headlineColors: 'bold royal navy and warm gold flat graphic display typography',
    canvas: 'a bright ivory-white celebratory background',
    scene:
      'gleaming golden trophy, laurel wreath, celebratory ribbons, stars and stage podium flat vector illustrations',
  },
  {
    match: /\b(school|college|annual day|alumni|students?|academic|kids)\b/i,
    headlineColors: 'bold vibrant indigo and warm orange flat display typography',
    canvas: 'a crisp sky-white background',
    scene:
      'festive school stage, colorful bunting flags, books, stars and joyful celebration flat vector illustrations',
  },
  {
    match: /\b(pongal|ongal|sankranti|kolam|sugarcane|tamil)\b/i,
    headlineColors: 'bold rich saffron-orange, turmeric gold and deep maroon flat display typography',
    canvas: 'a warm sunlit cream and bright golden background',
    scene:
      'decorated terracotta clay pongal pot with overflowing boiling rice, tall green sugarcane stalks, turmeric leaves, glowing brass oil lamps and traditional intricate geometric kolam border pattern flat vector illustrations',
  },
  {
    match: /\b(temple|festivals?|diwali|navaratri|ganesh|puja|pooja|holi|onam|fest)\b/i,
    headlineColors: 'bold rich saffron-orange and deep maroon flat display typography',
    canvas: 'a warm bright cream and soft saffron background',
    scene:
      'ornate festive arch, glowing brass oil lamps, marigold flower garlands and vibrant floral rangoli flat vector illustrations',
  },
  {
    match: /\b(wedding|marriage|engagement|reception|bridal|sangeet)\b/i,
    headlineColors: 'elegant rose-gold and deep burgundy serif display typography',
    canvas: 'a soft ivory and blush white background',
    scene: 'lush blooming floral arch, botanical greenery, garlands and celebration ribbons in flat editorial illustration',
  },
  {
    match: /\b(workshops?|seminars?|conferences?|webinars?|hackathons?|bootcamps?|training|tech)\b/i,
    headlineColors: 'bold electric blue and deep navy flat geometric typography',
    canvas: 'a crisp bright white and light sky background',
    scene:
      'modern lightbulb motif, speaker podium microphone, charts and collaborative learners flat vector illustration',
  },
  {
    match: /\b(meetings?|assembly|rotary|club|charity|fundraiser|cleanup|clean-up|trees?|environment)\b/i,
    headlineColors: 'bold royal blue and warm gold flat graphic display typography',
    canvas: 'a clean bright white background',
    scene:
      'welcoming community unity emblem, microphone, laurel accents and cheerful people flat vector illustration',
  },
  {
    match: /\b(music|concerts?|band|dance|singing|dj|market|fair|exhibitions?|food)\b/i,
    headlineColors: 'bold vibrant coral, teal and deep navy flat display typography',
    canvas: 'a bright sunny cream-white background',
    scene:
      'festive illustrated event stage, musical instruments, colorful lights, bunting and joyful celebration flat vector artwork',
  },
];

const DEFAULT_POSTER_THEME = {
  headlineColors: 'bold vibrant modern flat display typography',
  canvas: 'a crisp bright white background',
  scene:
    'rich colorful flat vector editorial illustration tailored visually to the event subject with harmonious event colors',
};

// Varied commercial poster art directions rotated per generation so FLUX creates fresh designs
export const STYLE_DIRECTIONS = [
  {
    name: 'panoramic-editorial',
    composition: 'open airy top title space flowing cleanly into a wide sunlit illustrated scene',
    palette: 'fresh sky blue, bright white, and vibrant sunshine accents',
    lettering: 'chunky bold outlined geometric poster typography',
  },
  {
    name: 'swiss-color-block',
    composition: 'asymmetrical Swiss geometric color-block poster grid with crisp angled panels framing the artwork',
    palette: 'warm coral, cream ivory, cobalt blue, and butter yellow flat screenprint colors',
    lettering: 'tall tight-tracked Swiss grotesque stacked headlines',
  },
  {
    name: 'diagonal-dynamic',
    composition: 'energetic diagonal sweep layout with sweeping curved ribbon banners wrapping the central artwork',
    palette: 'high-energy tangerine orange, crisp cloud white, mint green, and sky azure tones',
    lettering: 'dynamic slanted athletic display lettering with clean drop shadow',
  },
  {
    name: 'arch-emblem-frame',
    composition: 'modern architectural arch window frame centered over patterned side margins and a crest badge',
    palette: 'bright peach cream, emerald teal, marigold gold, and crisp off-white palette',
    lettering: 'strong centered arch-aligned modern sans-serif display type',
  },
  {
    name: 'paper-cut-collage',
    composition: 'layered scalloped color bands and tactile cut-paper geometric shapes separating headline and artwork',
    palette: 'cheerful pastel lemon, sky turquoise, coral pink, and warm white hues',
    lettering: 'playful rounded cut-paper poster block lettering',
  },
  {
    name: 'sunburst-retro-grid',
    composition: 'cheerful geometric sunburst halo behind a clean horizontal divider and grounded emblem stage',
    palette: 'sunny goldenrod yellow, crisp white, cardinal red, and navy contrast tones',
    lettering: 'bold mid-century retro-modern commercial poster typography',
  },
  {
    name: 'two-tone-split-card',
    composition: 'bold two-tone top-and-bottom split card layout pairing oversized display lettering with rich scene art',
    palette: 'vibrant cyan, mint sage, warm cream, and magenta accent palette',
    lettering: 'oversized ultra-clean modern condensed sans display lettering',
  },
];

let lastStyleIndex = -1;

export function pickNextStyleIndex(variation) {
  const count = STYLE_DIRECTIONS.length;
  if (typeof variation === 'number' && Number.isFinite(variation)) {
    const candidate = ((Math.trunc(variation) % count) + count) % count;
    if (candidate !== lastStyleIndex) {
      lastStyleIndex = candidate;
      return candidate;
    }
  }
  if (typeof variation === 'string' && variation.trim()) {
    let hash = 0;
    for (let i = 0; i < variation.length; i += 1) {
      hash = (hash * 31 + variation.charCodeAt(i)) >>> 0;
    }
    let candidate = hash % count;
    if (candidate === lastStyleIndex) {
      candidate = (candidate + 1) % count;
    }
    lastStyleIndex = candidate;
    return candidate;
  }

  const offset =
    lastStyleIndex < 0
      ? Math.floor(Math.random() * count)
      : 1 + Math.floor(Math.random() * (count - 1));
  const nextIndex = ((lastStyleIndex < 0 ? 0 : lastStyleIndex) + offset) % count;
  lastStyleIndex = nextIndex;
  return nextIndex;
}

function resolvePosterTheme(text) {
  return POSTER_THEMES.find((theme) => theme.match.test(text)) || DEFAULT_POSTER_THEME;
}

/**
 * Formats a bright, colorful flat graphic poster prompt using explicit quoted English
 * text lines (headline, date/time/venue, and highlights) so image models render crisp
 * spelling without gibberish text. Rotates through STYLE_DIRECTIONS for visual variety.
 */
export function formatFluxEnglishPrompt(userPrompt, options = {}) {
  const raw = String(userPrompt || '').trim();
  if (!raw) return '';

  const rawIndex = Number.isInteger(options?.styleIndex) ? options.styleIndex : 0;
  const normalizedIndex = ((rawIndex % STYLE_DIRECTIONS.length) + STYLE_DIRECTIONS.length) % STYLE_DIRECTIONS.length;
  const style = STYLE_DIRECTIONS[normalizedIndex];

  const firstSentence = raw.split(/[.\n]/)[0].trim() || raw;
  const titlePart = firstSentence.split(/\b(?:on|at|in|from|date:|time:|venue:|for)\b|,/i)[0].trim();
  const cleanTitle = (titlePart || firstSentence)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toUpperCase();

  const facts = extractEventFacts(raw);
  const metaParts = [facts.date, facts.time, facts.venue]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const metaLine = metaParts.join(' | ');
  const extraSentences = raw
    .split(/[.\n]/)
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  const extraLine = extraSentences.join(' • ');

  const textInstructions = [
    `bold crisp English headline text reading "${cleanTitle}"`,
    metaLine ? `clean smaller English text below reading "${metaLine}"` : '',
    extraLine ? `clean footer text reading "${extraLine}"` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const theme = resolvePosterTheme(raw);

  if (raw.toLowerCase().includes('poster of') || raw.toLowerCase().includes('poster for')) {
    return `${firstSentence}. ${style.composition}, featuring ${style.lettering} with ${textInstructions}, ${style.palette}, correct English spelling only, keep all text, emblems, and artwork comfortably inside clear top and bottom margins away from edges, balanced typographic poster layout, flat modern vector poster art, clean minimal advertising poster style.`;
  }

  return `Vibrant illustrated graphic design event poster for ${firstSentence}, ${style.composition}, using ${style.lettering} and ${theme.headlineColors} with ${textInstructions} cleanly across ${theme.canvas}, ${theme.scene}, ${style.palette}, cheerful daylight colors, correct English spelling only, keep all text, emblems, and artwork comfortably inside clear top and bottom margins away from edges, balanced typographic poster layout, flat modern vector poster art, clean minimal advertising poster style.`;
}

export function resolveContentImageDimensions(contentWidth, contentHeight) {
  const w = Number(contentWidth);
  const h = Number(contentHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1024, height: 1024 };
  }
  const ratio = w / h;
  if (Math.abs(ratio - 1) <= 0.04) {
    return { width: 1024, height: 1024 };
  }
  const snap16 = (val) => Math.min(1024, Math.max(512, Math.round(val / 16) * 16));
  if (ratio > 1) {
    return { width: 1024, height: snap16(1024 / ratio) };
  }
  return { width: snap16(1024 * ratio), height: 1024 };
}

function detectImageContentType(buffer, fallback = 'image/png') {
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
    return 'image/webp';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  return fallback;
}

function parseDataUrlToImage(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(String(dataUrl || '').trim());
  if (!match) {
    throw new Error('Image provider returned an invalid image format.');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Image provider returned empty image data.');
  }
  return {
    buffer,
    contentType: match[1].toLowerCase(),
  };
}

function sendGenerationError(res, err, fallbackMessage = 'Failed to generate image.') {
  const message = err?.message || fallbackMessage;
  if (err?.status === 429 || /\b429\b|quota|limit/i.test(message)) {
    return res.status(429).json({
      success: false,
      error: { message: 'Image quota reached. Try again later.', status: 429 },
    });
  }
  if (err?.status === 400) {
    return res.status(400).json({
      success: false,
      error: { message, status: 400 },
    });
  }
  return res.status(500).json({
    success: false,
    error: { message, status: 500 },
  });
}

async function streamPosterImage({ req, res, buffer, modelName, preferredContentType = 'image/png' }) {
  const contentType = detectImageContentType(buffer, preferredContentType);
  const ext = contentType.split('/')[1] || 'png';
  let cloudUrl = '';
  try {
    const clientId = req.clientId || 'generic';
    const folder = `ai-posters/tenants/${clientId}/poster-images`;
    const uploadRes = await storageService.uploadBuffer(buffer, {
      folder,
      filename: `poster_${Date.now()}.${ext}`,
      mimetype: contentType,
    });
    cloudUrl = uploadRes?.secure_url || uploadRes?.url || '';
  } catch (upErr) {
    console.warn('[Poster Storage Upload Warning]:', upErr.message);
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Poster-Model', modelName);
  if (cloudUrl) {
    res.setHeader('X-Poster-Image-Url', cloudUrl);
    res.setHeader('Access-Control-Expose-Headers', 'X-Poster-Image-Url, X-Poster-Model');
  } else {
    res.setHeader('Access-Control-Expose-Headers', 'X-Poster-Model');
  }

  return res.status(200).send(buffer);
}

async function generateWithHuggingFace({
  enhancedPrompt,
  hfModel,
  routerUrl,
  apiKey,
  width = 1024,
  height = 1024,
}) {
  let buffer = null;
  let lastError = null;
  const endpoint = routerUrl;

  try {
    const hfResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify({ inputs: enhancedPrompt }),
    });

    if (hfResponse.ok) {
      const arrayBuffer = await hfResponse.arrayBuffer();
      const candidate = Buffer.from(arrayBuffer);
      if (candidate.length > 500) {
        buffer = candidate;
      }
    }
  } catch {
    // Direct router fetch failed or mocked network error; continue to Inference Providers / Space
  }

  const isSchnell = hfModel.toLowerCase().includes('schnell');
  if ((!buffer || buffer.length <= 500) && !process.env.HF_API_URL && !process.env.AI_BASE_URL) {
    try {
      const { InferenceClient } = await import('@huggingface/inference');
      const hfClient = new InferenceClient(apiKey);
      const blob = await hfClient.textToImage({
        provider: 'auto',
        model: hfModel,
        inputs: enhancedPrompt,
        parameters: isSchnell
          ? { width, height, num_inference_steps: 4 }
          : { width, height, guidance_scale: 3.5, num_inference_steps: 20 },
      });
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const candidate = Buffer.from(arrayBuffer);
        if (candidate.length > 500) {
          buffer = candidate;
        }
      }
    } catch (inferErr) {
      console.warn(`[Hugging Face InferenceClient ${hfModel} notice]:`, inferErr.message);
      lastError = inferErr;
    }
  }

  if (!buffer || buffer.length <= 500) {
    try {
      const { Client } = await import('@gradio/client');
      const gradioClient = await Client.connect(hfModel, { token: apiKey });
      const inferParams = isSchnell
        ? {
            prompt: enhancedPrompt,
            seed: Math.floor(Math.random() * 1000000),
            randomize_seed: true,
            width,
            height,
            num_inference_steps: 4,
          }
        : {
            prompt: enhancedPrompt,
            seed: Math.floor(Math.random() * 1000000),
            randomize_seed: true,
            width,
            height,
            guidance_scale: 3.5,
            num_inference_steps: 20,
          };

      const result = await gradioClient.predict('/infer', inferParams);
      const imgUrl = result?.data?.[0]?.url;
      if (imgUrl) {
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const candidate = Buffer.from(arrayBuffer);
          if (candidate.length > 500) {
            buffer = candidate;
          }
        }
      }
    } catch (spaceErr) {
      console.warn(`[Hugging Face Space ${hfModel} notice]:`, spaceErr.message);
      lastError = spaceErr;
    }
  }

  if (buffer && buffer.length > 500) {
    return buffer;
  }

  let errorMessage = `Hugging Face model ${hfModel} is temporarily busy. Please try again shortly.`;
  if (lastError?.message?.includes('ZeroGPU')) {
    errorMessage = `Hugging Face ZeroGPU quota exceeded for ${hfModel}. Wait for quota reset or upgrade to Hugging Face PRO / add Inference credits.`;
  } else if (/pre-paid credits|Inference Providers|402/i.test(lastError?.message || '')) {
    errorMessage = `Hugging Face Inference credits are required for ${hfModel}. Add Inference credits or subscribe to Hugging Face PRO.`;
  } else if (lastError?.message) {
    errorMessage = `Hugging Face (${hfModel}) notice: ${lastError.message}`;
  }
  const err = new Error(errorMessage);
  if (lastError?.status) err.status = lastError.status;
  throw err;
}

/**
 * Active Express backend route handler for poster artwork generation.
 * Resolves AI_PROVIDER / AI_MODEL / AI_API_KEY (or legacy provider vars) via getAiConfig(),
 * generates poster artwork, saves to storage, and streams binary image data.
 */
export async function generateHuggingFacePoster(req, res, next) {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: { message: 'A poster description or prompt is required', status: 400 },
      });
    }

    const aiConfig = getAiConfig();
    const { provider, model, apiKey, accountId, baseUrl, fallbackModels, routerUrl } = aiConfig;
    if (!SUPPORTED_AI_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Unsupported AI_PROVIDER "${provider}". Supported providers: ${SUPPORTED_AI_PROVIDERS.join(', ')}.`,
          status: 400,
        },
      });
    }

    const styleIndex = pickNextStyleIndex(req.body?.variation);
    const enhancedPrompt = formatFluxEnglishPrompt(prompt, { styleIndex });
    const targetSize = resolveContentImageDimensions(req.body?.contentWidth, req.body?.contentHeight);

    switch (provider) {
      case 'mock':
        return streamPosterImage({
          req,
          res,
          buffer: MOCK_POSTER_PNG,
          modelName: 'mock',
          preferredContentType: 'image/png',
        });

      case 'cloudflare': {
        try {
          const dataUrl = await generateCloudflareImage(enhancedPrompt, {
            ...targetSize,
            model,
            apiKey,
            accountId,
            baseUrl,
          });
          const { buffer, contentType } = parseDataUrlToImage(dataUrl);
          return streamPosterImage({
            req,
            res,
            buffer,
            modelName: model,
            preferredContentType: contentType,
          });
        } catch (cfErr) {
          return sendGenerationError(res, cfErr);
        }
      }

      case 'huggingface': {
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            error: {
              message:
                'Hugging Face API key is not configured. Please set AI_API_KEY or HF_API_KEY in your root .env file.',
              status: 400,
            },
          });
        }

        try {
          const buffer = await generateWithHuggingFace({
            enhancedPrompt,
            hfModel: model,
            routerUrl,
            apiKey,
            ...targetSize,
          });
          return streamPosterImage({
            req,
            res,
            buffer,
            modelName: model,
            preferredContentType: 'image/png',
          });
        } catch (hfErr) {
          return sendGenerationError(res, hfErr);
        }
      }

      case 'gemini': {
        try {
          const result = await generateGeminiImage(enhancedPrompt, {
            model,
            apiKey,
            baseUrl,
            fallbackModels,
            ...targetSize,
          });
          return streamPosterImage({
            req,
            res,
            buffer: result.buffer,
            modelName: result.model || model,
            preferredContentType: result.contentType,
          });
        } catch (geminiErr) {
          return sendGenerationError(res, geminiErr);
        }
      }

      case 'openai': {
        try {
          const result = await generateOpenAiImage(enhancedPrompt, {
            model,
            apiKey,
            baseUrl,
            fallbackModels,
            ...targetSize,
          });
          return streamPosterImage({
            req,
            res,
            buffer: result.buffer,
            modelName: result.model || model,
            preferredContentType: result.contentType,
          });
        } catch (openAiErr) {
          return sendGenerationError(res, openAiErr);
        }
      }

      default:
        return res.status(400).json({
          success: false,
          error: {
            message: `Unsupported AI_PROVIDER "${provider}". Supported providers: ${SUPPORTED_AI_PROVIDERS.join(', ')}.`,
            status: 400,
          },
        });
    }
  } catch (err) {
    return next(err);
  }
}

export { HF_BASE_URL, HF_MODEL, HF_MODEL_ENDPOINT, HF_ROUTER_URL };
