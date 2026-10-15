/**
 * exportPoster(node, format, filename, { width, height }, backgroundColor)
 *
 * Captures a full-resolution DOM node and downloads it as PNG, JPG, or PDF.
 *
 * Returns { ok: true, warnings: string[] }
 * Throws a friendly Error string on hard failure.
 */

import { loadedFontRequests } from '../hooks/useGoogleFonts';

// Google CSS per family and font bytes per file url, so repeat exports are cheap
const familyCssCache = new Map();
const fontFileCache = new Map();

/** The one link a poster is drawn with: this family at exactly these weights. */
async function fetchFamilyCSS(family, weights) {
  const sorted = [...new Set(weights)].sort((a, b) => a - b);
  const key = `${family}@${sorted.join(',')}`;
  if (familyCssCache.has(key)) return familyCssCache.get(key);
  let css = null;
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${sorted.join(';')}&display=swap`
    );
    if (res.ok) css = await res.text();
  } catch {
    css = null;
  }
  familyCssCache.set(key, css);
  return css;
}

function usedCodePoints(text) {
  const points = new Set();
  for (const char of String(text || '')) points.add(char.codePointAt(0));
  return [...points];
}

/**
 * Google serves every script a family covers (latin, cyrillic, thai, …) as its own
 * file. Only the subsets the poster actually prints are worth embedding.
 */
function keepUsedSubsets(css, points) {
  if (!points.length) return css;
  return css
    .split(/(?=@font-face)/)
    .filter((block) => {
      const range = block.match(/unicode-range:\s*([^;]+);/i);
      if (!range) return true;
      return range[1].split(',').some((part) => {
        const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
        if (!m) return true;
        const from = parseInt(m[1], 16);
        const to = parseInt(m[2] || m[1], 16);
        return points.some((p) => p >= from && p <= to);
      });
    })
    .join('');
}

async function inlineFontFile(url) {
  if (fontFileCache.has(url)) return fontFileCache.get(url);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    const mime = url.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
    const dataUri = `url(data:${mime};base64,${btoa(binary)})`;
    fontFileCache.set(url, dataUri);
    return dataUri;
  } catch {
    // leave this url un-inlined, the font may still come from the system
    return null;
  }
}

/**
 * Build the @font-face CSS for the families in use with every font file inlined.
 * Returns the CSS string, or null on failure (caller should warn + skip).
 */
async function inlineGoogleFontCSS(requests, text) {
  try {
    const points = usedCodePoints(text);
    const raws = await Promise.all(
      requests.map((request) => fetchFamilyCSS(request.family, request.weights))
    );
    let css = raws
      .map((raw) => (raw ? keepUsedSubsets(raw, points) : ''))
      .join('\n')
      .trim();
    if (!css) return null;

    const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map((m) => m[1]))];
    const inlined = await Promise.all(urls.map(inlineFontFile));
    urls.forEach((url, index) => {
      if (inlined[index]) css = css.split(`url(${url})`).join(inlined[index]);
    });
    return css;
  } catch {
    return null;
  }
}

/**
 * Loads every font face used in the poster DOM tree via document.fonts.load().
 * Extracts font-family, font-weight, font-style from all elements within the node.
 */
async function loadUsedFontFaces(node) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;

  const fontSpecs = new Set();

  try {
    const requests = loadedFontRequests();
    for (const req of requests) {
      for (const w of req.weights || [400, 700]) {
        fontSpecs.add(`normal ${w} 16px "${req.family}"`);
        fontSpecs.add(`italic ${w} 16px "${req.family}"`);
      }
    }
  } catch {
    /* fallback to inspecting node */
  }

  if (node) {
    const elements = [node, ...node.querySelectorAll('*')];
    for (const el of elements) {
      const style = el.style;
      const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el) : null;
      const fontFamily = style?.fontFamily || computed?.fontFamily;
      if (!fontFamily) continue;

      const fontWeight = style?.fontWeight || computed?.fontWeight || '400';
      const fontStyle = style?.fontStyle || computed?.fontStyle || 'normal';

      const cleanFamilies = fontFamily
        .split(',')
        .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
        .filter((f) => {
          const lower = f.toLowerCase();
          return f && !['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial'].includes(lower);
        });

      for (const fam of cleanFamilies) {
        fontSpecs.add(`${fontStyle} ${fontWeight} 16px "${fam}"`);
        fontSpecs.add(`normal 400 16px "${fam}"`);
        fontSpecs.add(`normal 700 16px "${fam}"`);
      }
    }
  }

  const loads = Array.from(fontSpecs).map((spec) =>
    document.fonts.load(spec).catch(() => {})
  );

  await Promise.allSettled(loads);
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/**
 * Preload and decode an image with crossOrigin="anonymous".
 * Retries a failed image once.
 */
async function preloadAndDecodeImage(src, timeoutMs = 8000) {
  if (!src) return { ok: false, src, reason: 'Empty image source' };
  if (src.startsWith('data:')) {
    try {
      const img = new Image();
      img.src = src;
      if (typeof img.decode === 'function') await img.decode();
      return { ok: true, src, img };
    } catch {
      return { ok: true, src };
    }
  }

  const attempt = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => {
        img.src = '';
        reject(new Error('Image timed out'));
      }, timeoutMs);

      img.onload = async () => {
        clearTimeout(timer);
        try {
          if (typeof img.decode === 'function') {
            await img.decode();
          }
          resolve(img);
        } catch {
          if (img.naturalWidth > 0) resolve(img);
          else reject(new Error('Image decode failed'));
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Image failed to load'));
      };

      img.src = url;
    });

  try {
    const loaded = await attempt(src);
    return { ok: true, src, img: loaded };
  } catch {
    // Retry once
    try {
      const retryUrl = src.includes('?') ? `${src}&retry=1` : `${src}?retry=1`;
      const loaded = await attempt(retryUrl);
      return { ok: true, src, img: loaded, retried: true };
    } catch (retryErr) {
      return { ok: false, src, reason: retryErr.message };
    }
  }
}

/**
 * Preload, decode, and set crossOrigin="anonymous" on all images in the poster node.
 */
async function preloadAllPosterImages(node, perImageTimeout = 8000) {
  const imgEls = Array.from(node.querySelectorAll('img'));
  imgEls.forEach((img) => {
    if (!img.crossOrigin) img.crossOrigin = 'anonymous';
  });

  const srcs = new Set();
  imgEls.forEach((img) => {
    if (img.src) srcs.add(img.src);
    else if (img.getAttribute('src')) srcs.add(img.getAttribute('src'));
  });

  const allEls = [node, ...node.querySelectorAll('*')];
  allEls.forEach((el) => {
    const bg = el.style?.backgroundImage || (typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el)?.backgroundImage : '');
    if (bg && bg.includes('url(')) {
      const match = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match && match[1]) srcs.add(match[1]);
    }
  });

  const results = await Promise.all(
    Array.from(srcs).map((src) => preloadAndDecodeImage(src, perImageTimeout))
  );

  const missing = results.filter((r) => !r.ok);
  return {
    total: srcs.size,
    missing: missing.map((m) => m.src),
  };
}

/**
 * Compute safe pixel ratio: 2 when canvas pixel count is under the browser limit,
 * else 1 with a friendly notice added to warnings.
 */
function resolveExportPixelRatio(width, height, warnings) {
  const BROWSER_PIXEL_LIMIT = 16_000_000;
  const desiredPixels = width * height * 2 * 2;
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);

  if (isMobile || desiredPixels > BROWSER_PIXEL_LIMIT) {
    warnings.push('High-resolution export was reduced to standard quality to stay within browser memory limits.');
    return 1;
  }
  return 2;
}

/**
 * Sanitize a filename: keep letters, digits, dashes; max 60 chars; no extension.
 */
function sanitizeFilename(name) {
  return (name || 'poster')
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'poster';
}

/**
 * Download a Blob as a file.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Verify that the exported canvas is not blank by sampling the header, content, and footer bands.
 */
export function verifyCanvasNotBlank(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: true };

  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) {
    return { ok: false, reason: 'Canvas has zero dimensions.' };
  }

  // Header band: top 0% - 15%
  // Content band: middle 20% - 80%
  // Footer band: bottom 85% - 100%
  const bands = [
    { name: 'header', top: 0, bottom: Math.max(1, Math.floor(h * 0.15)) },
    { name: 'content', top: Math.floor(h * 0.20), bottom: Math.floor(h * 0.80) },
    { name: 'footer', top: Math.max(0, Math.floor(h * 0.85)), bottom: h },
  ];

  let totalAlpha = 0;
  const allSampledColors = [];

  for (const band of bands) {
    const bandHeight = band.bottom - band.top;
    if (bandHeight <= 0) continue;
    const stepX = Math.max(1, Math.floor(w / 7));
    const stepY = Math.max(1, Math.floor(bandHeight / 5));
    let bandAlpha = 0;

    for (let x = stepX; x < w; x += stepX) {
      for (let y = band.top + stepY; y < band.bottom; y += stepY) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const [r, g, b, a] = pixel;
        if (a > 0) {
          bandAlpha++;
          totalAlpha++;
        }
        allSampledColors.push(`${r},${g},${b},${a}`);
      }
    }

    if (bandAlpha === 0) {
      return { ok: false, reason: `The ${band.name} band appears blank.` };
    }
  }

  const uniqueColors = new Set(allSampledColors);
  if (totalAlpha === 0 || uniqueColors.size <= 1) {
    return { ok: false, reason: 'The exported poster appears blank.' };
  }

  return { ok: true };
}

/**
 * Report export failures to error monitoring without poster text or sensitive user data.
 */
export function reportExportError(error, metadata = {}) {
  const sanitized = {
    message: error?.message || 'Export failed',
    name: error?.name || 'ExportError',
    stack: error?.stack,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    imageCount: metadata.imageCount,
    missingImageCount: metadata.missingImageCount,
    pixelRatio: metadata.pixelRatio,
    reason: metadata.reason,
  };

  console.error('[exportPoster:monitoring]', sanitized);

  if (typeof window !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.captureException(new Error(sanitized.message), {
          tags: { feature: 'export' },
          extra: sanitized,
        });
      })
      .catch(() => {});
  }
}

/**
 * Inline the font files the poster is actually drawn with, as base64.
 * Returns { css: string|null, hadFamilies: boolean }.
 */
async function collectFontEmbedCSS(node) {
  try {
    const requests = loadedFontRequests();
    if (requests.length === 0) return { css: null, hadFamilies: false };
    const css = await inlineGoogleFontCSS(requests, node?.textContent);
    return { css: css || null, hadFamilies: true };
  } catch {
    return { css: null, hadFamilies: true };
  }
}

const exportFilter = (n) => {
  if (!n || n.nodeType !== 1) return true;
  return n.getAttribute('data-export-ignore') !== 'true';
};

/**
 * Render a poster node to a JPEG Blob (used for background thumbnails).
 * Never downloads anything. Throws on hard failure so callers can silently skip.
 */
export async function renderPosterJpeg(node, templateSize, { targetWidth = 400, quality = 0.7, backgroundColor } = {}) {
  if (!node) throw new Error('Missing poster node');
  const { width = 1080, height = 1350 } = templateSize || {};

  await document.fonts.ready;
  const { toJpeg } = await import('html-to-image');
  const { css: fontEmbedCSS } = await collectFontEmbedCSS(node);

  const pixelRatio = Math.min(1, Math.max(0.1, targetWidth / width));
  const dataUrl = await toJpeg(node, {
    pixelRatio,
    quality,
    cacheBust: false,
    backgroundColor: backgroundColor || '#ffffff',
    filter: exportFilter,
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
  });

  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error('Thumbnail render failed');
  return await res.blob();
}

/**
 * Main export function.
 *
 * @param {HTMLElement} node        - The full-size, unscaled poster DOM node
 * @param {'png'|'jpg'|'pdf'} format
 * @param {string} filename         - Base name without extension (will be sanitized)
 * @param {{ width: number, height: number }} templateSize
 * @param {string} [backgroundColor] - Brand background color (needed for JPG/PDF)
 * @returns {Promise<{ ok: boolean, warnings: string[], canvas?: HTMLCanvasElement }>}
 */
export async function exportPoster(node, format, filename, templateSize, backgroundColor) {
  if (!node) throw new Error("We couldn't create the file. Please try again.");

  const warnings = [];
  const { width = 1080, height = 1350 } = templateSize || {};
  const pixelRatio = resolveExportPixelRatio(width, height, warnings);
  const safeName = sanitizeFilename(filename);

  const imgElements = Array.from(node.querySelectorAll('img')).filter((img) => img.src || img.getAttribute('src'));
  const imageCount = imgElements.length;
  const timeoutMs = imageCount > 10 ? 40_000 : 25_000;

  let imagePrep = { total: 0, missing: [] };

  const exportExecution = async () => {
    // 1. Load every font face used
    await loadUsedFontFaces(node);

    // 2. Preload and decode every image with crossOrigin="anonymous", retry failed images once
    imagePrep = await preloadAllPosterImages(node, 8000);
    if (imagePrep.missing.length > 0) {
      const count = imagePrep.missing.length;
      warnings.push(
        count === 1
          ? '1 image could not be loaded and was left out of the export.'
          : `${count} images could not be loaded and were left out of the export.`
      );
    }

    // 3. Inline Google Fonts CSS
    let fontEmbedCSS;
    const fontResult = await collectFontEmbedCSS(node);
    fontEmbedCSS = fontResult.css;
    if (!fontEmbedCSS && fontResult.hadFamilies) {
      warnings.push('Custom fonts could not be embedded; system fonts used instead.');
    }

    // 4. Dynamic import html-to-image
    const { toCanvas } = await import('html-to-image');

    const bgColor = backgroundColor || '#0b0f17';

    const sharedOpts = {
      pixelRatio,
      cacheBust: true,
      filter: exportFilter,
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
      backgroundColor: format === 'png' && !backgroundColor ? undefined : bgColor,
    };

    /**
     * Safari renders cross-origin images blank on the first call.
     * Warm up by calling once and discarding, then capture for real.
     */
    const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      await toCanvas(node, { ...sharedOpts, pixelRatio: 1 }).catch(() => {});
    }

    // 5. Render to canvas
    const canvas = await toCanvas(node, sharedOpts);

    // 6. Verify result is not blank by sampling header, content, and footer bands
    const blankCheck = verifyCanvasNotBlank(canvas);
    if (!blankCheck.ok) {
      const blankErr = new Error('The exported file was blank. Please try again.');
      reportExportError(blankErr, {
        format,
        width,
        height,
        imageCount,
        missingImageCount: imagePrep.missing.length,
        pixelRatio,
        reason: blankCheck.reason,
      });
      throw blankErr;
    }

    // 7. Output according to requested format
    if (format === 'pdf') {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const { jsPDF } = await import('jspdf');
      const orientation = width >= height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], hotfixes: ['px_scaling'] });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);

      const blob = pdf.output('blob');
      downloadBlob(blob, `${safeName}.pdf`);
    } else if (format === 'jpg') {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeName}.jpg`);
    } else {
      // PNG
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeName}.png`);
    }

    return { ok: true, warnings, canvas };
  };

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Creating the file took too long. Please try again.'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([exportExecution(), timeoutPromise]);
    return result;
  } catch (err) {
    reportExportError(err, {
      format,
      width,
      height,
      imageCount,
      missingImageCount: imagePrep.missing?.length || 0,
      pixelRatio,
    });
    console.error('[exportPoster]', err);
    throw (err.message && (err.message.startsWith('The exported') || err.message.startsWith('Creating the file')))
      ? err
      : new Error("We couldn't create the file. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}
