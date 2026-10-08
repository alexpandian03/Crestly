/**
 * Image Resolution & Search Service
 * Supports Unsplash (IMAGE_SEARCH_PROVIDER=unsplash), Pexels, and Mock.
 * Returns regular size image URL, photographer name and profile link with UTM tags.
 * Calls Unsplash download_location when a photo is chosen for a poster.
 */

export function imageSearchProviderName() {
  const explicit = (process.env.IMAGE_SEARCH_PROVIDER || '').toLowerCase().trim();
  if (explicit) return explicit;
  if (process.env.UNSPLASH_API_KEY?.trim()) return 'unsplash';
  if (process.env.PEXELS_API_KEY?.trim()) return 'pexels';
  return 'mock';
}

function getMockPhotos(cleanQuery) {
  const appName = process.env.UNSPLASH_APP_NAME?.trim() || 'Brandframe';
  const q = String(cleanQuery || '').toLowerCase();
  let fallbackUrl = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1080&q=80&auto=format&fit=crop';
  if (q.includes('sport') || q.includes('athlete') || q.includes('stadium') || q.includes('run')) {
    fallbackUrl = 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1080&q=80&auto=format&fit=crop';
  } else if (q.includes('pongal') || q.includes('tamil') || q.includes('harvest') || q.includes('diwali') || q.includes('festival')) {
    fallbackUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1080&q=80&auto=format&fit=crop';
  } else if (q.includes('cultural') || q.includes('culture') || q.includes('music') || q.includes('dance')) {
    fallbackUrl = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1080&q=80&auto=format&fit=crop';
  } else if (q.includes('blood') || q.includes('medical') || q.includes('doctor')) {
    fallbackUrl = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1080&q=80&auto=format&fit=crop';
  }

  return [
    {
      imageUrl: fallbackUrl,
      photographer: 'Stock Contributor',
      photographerUrl: `https://unsplash.com?utm_source=${encodeURIComponent(appName)}&utm_medium=referral`,
      downloadLocation: '',
      description: cleanQuery || 'Event photo',
      provider: 'mock',
    },
  ];
}

/**
 * Triggers Unsplash download tracking endpoint when a photo is chosen for a poster.
 * Never throws or fails the request.
 */
export async function triggerDownload(downloadLocation) {
  if (!downloadLocation || typeof downloadLocation !== 'string' || !downloadLocation.startsWith('https://')) {
    return;
  }
  const apiKey = process.env.UNSPLASH_API_KEY?.trim();
  if (!apiKey) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(downloadLocation, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${apiKey}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch {
    // Best-effort reporting as required by Unsplash API guideline
  }
}

async function searchUnsplash(cleanQuery, { perPage = 10, signal } = {}) {
  const apiKey = process.env.UNSPLASH_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[Images] UNSPLASH_API_KEY is not configured. Falling back to mock provider.');
    return getMockPhotos(cleanQuery);
  }

  const appName = process.env.UNSPLASH_APP_NAME?.trim() || 'Brandframe';
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanQuery)}&per_page=${perPage}&orientation=landscape`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${apiKey}`,
      },
      signal,
    });

    if (!res.ok) {
      console.warn(`[Images] Unsplash API returned status ${res.status}. Falling back to mock provider.`);
      return getMockPhotos(cleanQuery);
    }

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      return getMockPhotos(cleanQuery);
    }

    return results.map((item) => {
      const profileBase = item.user?.links?.html || `https://unsplash.com/@${item.user?.username || ''}`;
      const photographerUrl = `${profileBase}?utm_source=${encodeURIComponent(appName)}&utm_medium=referral`;
      return {
        imageUrl: item.urls?.regular || item.urls?.small || '',
        photographer: item.user?.name || 'Unsplash Photographer',
        photographerUrl,
        downloadLocation: item.links?.download_location || '',
        description: item.description || item.alt_description || '',
        provider: 'unsplash',
      };
    });
  } catch (err) {
    console.warn(`[Images] Unsplash search failed (${err.message || 'network error'}). Falling back to mock provider.`);
    return getMockPhotos(cleanQuery);
  }
}

async function searchPexels(cleanQuery, { perPage = 10, signal } = {}) {
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  if (!pexelsKey) {
    console.warn('[Images] PEXELS_API_KEY is not configured. Falling back to mock provider.');
    return getMockPhotos(cleanQuery);
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&per_page=${perPage}&orientation=landscape`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: pexelsKey,
      },
      signal,
    });

    if (!res.ok) {
      console.warn(`[Images] Pexels API returned status ${res.status}. Falling back to mock provider.`);
      return getMockPhotos(cleanQuery);
    }

    const data = await res.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    if (!photos.length) {
      return getMockPhotos(cleanQuery);
    }

    return photos.map((photo) => ({
      imageUrl: photo.src?.large || photo.src?.landscape || '',
      photographer: photo.photographer || 'Pexels Photographer',
      photographerUrl: photo.photographer_url || 'https://www.pexels.com',
      downloadLocation: '',
      description: photo.alt || '',
      provider: 'pexels',
    }));
  } catch (err) {
    console.warn(`[Images] Pexels search failed (${err.message || 'network error'}). Falling back to mock provider.`);
    return getMockPhotos(cleanQuery);
  }
}

/**
 * Searches photos via the configured provider (unsplash, pexels, or mock).
 */
export async function searchPhotos(query, { perPage = 10 } = {}) {
  const cleanQuery = typeof query === 'string'
    ? query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().slice(0, 60)
    : '';

  if (!cleanQuery) {
    return getMockPhotos('community');
  }

  const provider = imageSearchProviderName();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    if (provider === 'unsplash') {
      return await searchUnsplash(cleanQuery, { perPage, signal: controller.signal });
    }
    if (provider === 'pexels') {
      return await searchPexels(cleanQuery, { perPage, signal: controller.signal });
    }
    return getMockPhotos(cleanQuery);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolves an image query to a single chosen photo with photographer details.
 * Automatically triggers Unsplash download_location when a photo is selected.
 */
export async function resolveImageDetails(imageQuery) {
  if (!imageQuery || typeof imageQuery !== 'string' || !imageQuery.trim()) {
    return null;
  }

  try {
    const photos = await searchPhotos(imageQuery, { perPage: 1 });
    const chosen = photos[0];
    if (chosen?.imageUrl) {
      if (chosen.downloadLocation && chosen.provider === 'unsplash') {
        triggerDownload(chosen.downloadLocation);
      }
      return chosen;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves an imageQuery returning an image URL (regular size) or empty string.
 * Preserves backwards compatibility for existing poster controllers.
 */
export async function resolveImage(imageQuery) {
  const details = await resolveImageDetails(imageQuery);
  return details?.imageUrl || '';
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'on', 'in', 'at', 'from', 'to',
  'of', 'by', 'our', 'all', 'we', 'your', 'be', 'is', 'are', 'this', 'that',
  'include', 'including', 'venue', 'date', 'time', 'pm', 'am', 'session', 'day'
]);

export function extractEventKeywords(description, title, keywords) {
  if (typeof keywords === 'string' && keywords.trim()) {
    const kwWords = keywords.trim().split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    if (kwWords.length >= 2) {
      return kwWords.slice(0, 4).join(' ');
    }
  } else if (Array.isArray(keywords) && keywords.length > 0) {
    const kwWords = keywords.filter((w) => typeof w === 'string' && !STOP_WORDS.has(w.toLowerCase()));
    if (kwWords.length >= 2) {
      return kwWords.slice(0, 4).join(' ');
    }
  }

  const text = `${title || ''} ${description || ''}`.toLowerCase();
  if (text.includes('sport') || text.includes('athletic') || text.includes('marathon') || text.includes('race')) {
    return 'sports stadium athletes';
  }
  if (text.includes('pongal') || text.includes('tamil') || text.includes('harvest')) {
    return 'pongal harvest celebration festival';
  }
  if (text.includes('cultural') || text.includes('culture') || text.includes('fest')) {
    return 'cultural festival celebration stage';
  }
  if (text.includes('diwali') || text.includes('deepavali') || text.includes('light')) {
    return 'diwali festival lamps lights';
  }
  if (text.includes('blood') || text.includes('donation')) {
    return 'blood donation medical volunteer';
  }
  if (text.includes('yoga') || text.includes('wellness') || text.includes('meditation')) {
    return 'yoga meditation wellness';
  }
  if (text.includes('award') || text.includes('ceremony') || text.includes('trophy')) {
    return 'awards ceremony stage trophy';
  }

  const combined = `${title || ''} ${description || ''}`
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const unique = Array.from(new Set(combined.map((w) => w.toLowerCase())));
  if (unique.length >= 2) {
    return unique.slice(0, 4).join(' ');
  }
  return 'community event celebration';
}

/**
 * Shared image resolution for both template mode and "AI designs it".
 * Searches Unsplash with 2 to 4 keywords from the event, stores the chosen
 * image and photographer credit on the poster, and falls back gracefully.
 */
export async function resolvePosterImage(description, title, keywords) {
  const query = extractEventKeywords(description, title, keywords);
  try {
    const photos = await searchPhotos(query, { perPage: 1 });
    const chosen = photos[0];
    if (chosen?.imageUrl) {
      if (chosen.downloadLocation && chosen.provider === 'unsplash') {
        triggerDownload(chosen.downloadLocation);
      }
      return chosen;
    }
  } catch (err) {
    console.warn(`[Images] resolvePosterImage failed: ${err.message || 'unknown error'}`);
  }

  const fallbackList = getMockPhotos(query);
  return fallbackList[0] || null;
}

export default {
  resolveImage,
  resolveImageDetails,
  resolvePosterImage,
  extractEventKeywords,
  searchPhotos,
  triggerDownload,
  imageSearchProviderName,
};
