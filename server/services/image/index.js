import storageService from '../storage.js';
import { checkContentImageUrl } from '../../../shared/templateElements.js';
import { aspectRatioFor, buildImagePrompt } from './prompt.js';
import { generateWithMockImage } from './providers/mock.js';
import { generateWithGeminiImage } from './providers/gemini.js';

/* Making one picture for a poster.
 *
 * Only two providers are offered. An OpenAI picture needs 30-45 seconds and often more, which is
 * longer than this app's function may run, so it is deliberately not wired up here; see
 * .env.example. Everything that leaves this file is an address inside this tenant's own
 * Cloudinary folder - the bytes never reach the browser as a data: address and nothing is kept
 * on disk. */

/** How long one picture may take before we give up on it. */
export const IMAGE_TIMEOUT_MS = 25_000;

/** The providers this build offers, in the order the setting names them. */
export const IMAGE_PROVIDERS = ['mock', 'gemini'];

/** The largest picture we will carry from a provider into Cloudinary. */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const TOO_LONG_MESSAGE =
  'Making that picture took too long, so your poster keeps its mark. Try again, or choose a photo instead.';

function imageError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function imageProviderName() {
  return (process.env.IMAGE_PROVIDER || 'mock').toLowerCase().trim();
}

async function callProvider(provider, { prompt, aspectRatio, signal }) {
  if (provider === 'gemini') return generateWithGeminiImage({ prompt, aspectRatio, signal });
  return generateWithMockImage();
}

/**
 * Asks the configured picture service for one illustration and keeps it in this tenant's own
 * Cloudinary folder. Returns the address to store, never the bytes.
 */
export async function generatePosterPicture({ subject, brandKit, size, clientId }) {
  const provider = imageProviderName();
  if (!IMAGE_PROVIDERS.includes(provider)) {
    throw imageError(
      'This app is set to a picture service that needs more time than it may take. Ask your administrator to set the picture service to gemini or mock.',
      503
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  let answer;
  try {
    answer = await callProvider(provider, {
      prompt: buildImagePrompt({ subject, brandKit }),
      aspectRatio: aspectRatioFor(size),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted || err?.name === 'AbortError') throw imageError(TOO_LONG_MESSAGE, 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  /* The mock answers with a stock address of its own; a real service answers with bytes that
     have to be stored somewhere the poster is allowed to point at. */
  if (answer?.url) {
    const url = String(answer.url).trim();
    const check = checkContentImageUrl(url, {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      clientId,
    });
    if (!check.ok) throw imageError('The picture service answered with a photo we cannot use.', 502);
    return { imageUrl: url, provider };
  }

  const buffer = Buffer.from(String(answer?.base64 || ''), 'base64');
  if (buffer.length < 512) throw imageError('The picture service sent an empty picture. Please try again.', 502);
  if (buffer.length > IMAGE_MAX_BYTES) throw imageError('That picture came back too large. Please try again.', 502);

  const uploaded = await storageService.uploadBuffer(buffer, {
    folder: `brand/${clientId}/ai-pictures`,
    filename: `picture-${Date.now()}`,
    mimetype: answer?.mimeType || 'image/png',
  });

  const url = String(uploaded?.url || '').trim();
  const check = checkContentImageUrl(url, {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    clientId,
  });
  if (!check.ok) {
    throw imageError(
      url.startsWith('data:')
        ? 'We have nowhere to keep the picture we made. Ask your administrator to connect your image library.'
        : `We could not keep that picture: ${check.reason}`,
      503
    );
  }

  return { imageUrl: url, provider };
}

export default { generatePosterPicture, imageProviderName };
