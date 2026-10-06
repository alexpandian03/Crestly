/**
 * Image Resolution Service
 * Resolves an imageQuery through the Pexels API with a 5-second timeout.
 * Returns a landscape image URL, or empty string on failure/timeout/missing key.
 */
export async function resolveImage(imageQuery) {
  if (!imageQuery || typeof imageQuery !== 'string' || !imageQuery.trim()) {
    return '';
  }

  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  if (!pexelsKey) {
    return '';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const cleanQuery = imageQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().slice(0, 60);
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&per_page=1&orientation=landscape`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: pexelsKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return '';
    }

    const data = await res.json();
    const photo = data.photos?.[0];
    const imageUrl = photo?.src?.large || photo?.src?.landscape || '';

    // Only allow secure HTTPS URLs from Pexels domain
    if (imageUrl && imageUrl.startsWith('https://images.pexels.com/')) {
      return imageUrl;
    }

    return '';
  } catch {
    // Timeout or network error: never fail the main poster request
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}

export default { resolveImage };
