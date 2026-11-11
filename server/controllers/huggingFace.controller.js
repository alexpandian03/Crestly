import storageService from '../services/storage.js';

/**
 * Hugging Face Inference Controller
 * Generates high-quality commercial event poster artwork using Hugging Face FLUX.1.
 * Respects IMAGE_PROVIDER=huggingface and HF_IMAGE_MODEL (default: black-forest-labs/FLUX.1-schnell).
 */

const HF_BASE_URL = 'https://huggingface.co';
const DEFAULT_HF_MODEL = 'black-forest-labs/FLUX.1-schnell';

export function getHuggingFaceConfig() {
  const provider = String(process.env.IMAGE_PROVIDER || 'huggingface').trim().toLowerCase();
  const model = String(process.env.HF_IMAGE_MODEL || DEFAULT_HF_MODEL).trim() || DEFAULT_HF_MODEL;
  return {
    provider,
    model,
    routerUrl: `https://router.huggingface.co/hf-inference/models/${model}`,
    directUrl: `https://api-inference.huggingface.co/models/${model}`,
    modelEndpoint: `${HF_BASE_URL}/${model}`,
  };
}

const HF_MODEL = DEFAULT_HF_MODEL;
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_DIRECT_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_MODEL_ENDPOINT = `${HF_BASE_URL}/${HF_MODEL}`;

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
 * Strips trailing schedule metadata (e.g. "on 18 Oct, 8 AM, school ground")
 * so FLUX focuses on crisp English headline lettering without baking garbled dates
 * that <PosterCanvas> already renders cleanly in HTML.
 */
function extractSubjectPhrase(firstSentence) {
  const withoutSchedule = firstSentence
    .replace(
      /(?:\s+\b(?:on|at|from)\b\s+|\s*,\s*)(?:\d{1,2}\b|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun).*$/i,
      ''
    )
    .replace(/\s*,\s*\d{1,2}\s*(?::\d{2})?\s*(?:am|pm)\b.*$/i, '')
    .trim();
  return withoutSchedule || firstSentence;
}

/**
 * Formats a bright, colorful flat graphic poster prompt for FLUX.1.
 * Rotates through STYLE_DIRECTIONS so each poster gets a distinct art direction
 * instead of repetitive dark spotlight or single default layouts.
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

  const subjectContext = extractSubjectPhrase(firstSentence);
  const theme = resolvePosterTheme(raw);

  if (raw.toLowerCase().includes('poster of') || raw.toLowerCase().includes('poster for')) {
    return `${raw}. ${style.composition}, featuring ${style.lettering} reading "${cleanTitle}", ${style.palette}, flat modern vector poster art, clean minimal advertising poster style, clear breathing room near the bottom edge.`;
  }

  return `Vibrant illustrated graphic design event poster for ${subjectContext}, ${style.composition}, using ${style.lettering} and ${theme.headlineColors} reading "${cleanTitle}" cleanly in English across ${theme.canvas}, ${theme.scene}, ${style.palette}, cheerful daylight colors, flat modern vector poster art, clean minimal advertising poster style, clear breathing room near the bottom edge.`;
}

/**
 * Active Express backend route handler for FLUX.1 on Hugging Face.
 * Accepts { prompt } in req.body, generates poster artwork with Hugging Face,
 * saves to storage, and streams binary image data.
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

    const { provider, model: hfModel, routerUrl } = getHuggingFaceConfig();
    if (provider !== 'huggingface') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Unsupported IMAGE_PROVIDER "${provider}". Set IMAGE_PROVIDER=huggingface to use ${hfModel}.`,
          status: 400,
        },
      });
    }

    // 1. Read key from process.env.HF_API_KEY
    const apiKey = process.env.HF_API_KEY;

    if (!apiKey || apiKey === 'YOUR_HUGGINGFACE_KEY_HERE') {
      return res.status(400).json({
        success: false,
        error: {
          message:
            'Hugging Face API key is not configured. Please set HF_API_KEY in your root .env file.',
          status: 400,
        },
      });
    }

    // Format prompt with a fresh non-repeating creative style direction and clean English typography
    const styleIndex = pickNextStyleIndex(req.body?.variation);
    const enhancedPrompt = formatFluxEnglishPrompt(prompt, { styleIndex });

    // 2. Direct endpoint / router HTTP fetch (also used when HF_API_URL or fetch is mocked in tests)
    let buffer = null;
    let lastError = null;
    const endpoint = process.env.HF_API_URL || routerUrl;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    };

    try {
      const hfResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
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

    // 3. Official @huggingface/inference providers API for the configured HF_IMAGE_MODEL
    const isSchnell = hfModel.toLowerCase().includes('schnell');
    if ((!buffer || buffer.length <= 500) && !process.env.HF_API_URL) {
      try {
        const { InferenceClient } = await import('@huggingface/inference');
        const hfClient = new InferenceClient(apiKey);
        const blob = await hfClient.textToImage({
          provider: 'auto',
          model: hfModel,
          inputs: enhancedPrompt,
          parameters: isSchnell
            ? { width: 1024, height: 1024, num_inference_steps: 4 }
            : { width: 1024, height: 1024, guidance_scale: 3.5, num_inference_steps: 20 },
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

    // 4. Official Gradio Space strictly for the configured HF_IMAGE_MODEL
    if (!buffer || buffer.length <= 500) {
      try {
        const { Client } = await import('@gradio/client');
        const gradioClient = await Client.connect(hfModel, {
          token: apiKey,
        });

        const inferParams = isSchnell
          ? {
              prompt: enhancedPrompt,
              seed: Math.floor(Math.random() * 1000000),
              randomize_seed: true,
              width: 1024,
              height: 1024,
              num_inference_steps: 4,
            }
          : {
              prompt: enhancedPrompt,
              seed: Math.floor(Math.random() * 1000000),
              randomize_seed: true,
              width: 1024,
              height: 1024,
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

    // 5. Return generated poster image
    if (buffer && buffer.length > 500) {
      let cloudUrl = '';
      try {
        const clientId = req.clientId || 'generic';
        const folder = `ai-posters/tenants/${clientId}/poster-images`;
        const uploadRes = await storageService.uploadBuffer(buffer, {
          folder,
          filename: `flux_${Date.now()}`,
          mimetype: 'image/png',
        });
        cloudUrl = uploadRes?.secure_url || uploadRes?.url || '';
      } catch (upErr) {
        console.warn('[Poster Storage Upload Warning]:', upErr.message);
      }

      const isWebp =
        buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
      const contentType = isWebp ? 'image/webp' : 'image/png';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-Poster-Model', hfModel);
      if (cloudUrl) {
        res.setHeader('X-Poster-Image-Url', cloudUrl);
        res.setHeader('Access-Control-Expose-Headers', 'X-Poster-Image-Url, X-Poster-Model');
      } else {
        res.setHeader('Access-Control-Expose-Headers', 'X-Poster-Model');
      }

      return res.status(200).send(buffer);
    }

    // 6. Friendly error handling when model quota or credits are exhausted
    let errorMessage = `Hugging Face model ${hfModel} is temporarily busy. Please try again shortly.`;
    if (lastError?.message?.includes('ZeroGPU')) {
      errorMessage = `Hugging Face ZeroGPU quota exceeded for ${hfModel}. Wait for quota reset or upgrade to Hugging Face PRO / add Inference credits.`;
    } else if (/pre-paid credits|Inference Providers|402/i.test(lastError?.message || '')) {
      errorMessage = `Hugging Face Inference credits are required for ${hfModel}. Add Inference credits or subscribe to Hugging Face PRO.`;
    } else if (lastError?.message) {
      errorMessage = `Hugging Face (${hfModel}) notice: ${lastError.message}`;
    }

    return res.status(503).json({
      success: false,
      error: { message: errorMessage, status: 503 },
    });
  } catch (err) {
    return next(err);
  }
}

export { HF_BASE_URL, HF_MODEL, HF_MODEL_ENDPOINT, HF_ROUTER_URL };
