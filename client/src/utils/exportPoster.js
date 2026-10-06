/**
 * exportPoster(node, format, filename, { width, height }, backgroundColor)
 *
 * Captures a full-resolution DOM node and downloads it as PNG, JPG, or PDF.
 *
 * Returns { ok: true, warnings: string[] }
 * Throws a friendly Error string on hard failure.
 */

// Google CSS per family and font bytes per file url, so repeat exports are cheap
const familyCssCache = new Map();
const fontFileCache = new Map();
const FONT_WEIGHTS = 'wght@300;400;500;600;700;800';

async function fetchFamilyCSS(family) {
  if (familyCssCache.has(family)) return familyCssCache.get(family);
  let css = null;
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${FONT_WEIGHTS}&display=swap`
    );
    if (res.ok) css = await res.text();
  } catch {
    css = null;
  }
  familyCssCache.set(family, css);
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
async function inlineGoogleFontCSS(families, text) {
  try {
    const points = usedCodePoints(text);
    const raws = await Promise.all(families.map((f) => fetchFamilyCSS(f)));
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
 * Wait for all <img> elements inside `node` to fully load.
 * Times out after 8 s per image. Never throws — returns list of failed src strings.
 */
async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'));
  const failed = [];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          const timer = setTimeout(() => {
            failed.push(img.src);
            resolve();
          }, 8000);
          img.onload = () => { clearTimeout(timer); resolve(); };
          img.onerror = () => { clearTimeout(timer); failed.push(img.src); resolve(); };
          // Trigger re-load in case browser gave up
          if (img.complete) { img.src = img.src; } // eslint-disable-line no-self-assign
        })
    )
  );
  return failed;
}

/**
 * Compute a safe pixel ratio: cap at 1 on mobile or when canvas would exceed
 * the ~16.7M pixel browser limit (some browsers allow more, but this is safe).
 */
function safePixelRatio(width, height, desired = 2) {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) return 1;
  const totalPixels = width * height * desired * desired;
  if (totalPixels > 16_000_000) return 1;
  return desired;
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
 * Collect Google Font CSS used by the page and inline it as base64.
 * Returns { css: string|null, hadFamilies: boolean }.
 */
async function collectFontEmbedCSS(node) {
  try {
    const linkEls = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"]'));
    const families = [];
    linkEls.forEach((el) => {
      const m = el.href.match(/family=([^&]+)/g);
      if (m) m.forEach((fam) => families.push(decodeURIComponent(fam.replace('family=', '').split(':')[0])));
    });
    const unique = [...new Set(families)];
    if (unique.length === 0) return { css: null, hadFamilies: false };
    const css = await inlineGoogleFontCSS(unique, node?.textContent);
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
 * @returns {Promise<{ ok: boolean, warnings: string[] }>}
 */
export async function exportPoster(node, format, filename, templateSize, backgroundColor) {
  if (!node) throw new Error("We couldn't create the file. Please try again.");

  const warnings = [];
  const { width = 1080, height = 1350 } = templateSize || {};
  const pixelRatio = safePixelRatio(width, height, 2);
  const safeName = sanitizeFilename(filename);

  // 1. Wait for fonts
  await document.fonts.ready;

  // 2. Wait for images (never fail export on broken images)
  const failedImages = await waitForImages(node);
  if (failedImages.length > 0) {
    warnings.push('The image could not be included in the export.');
  }

  // 3. Inline Google Fonts CSS (collect font families from loaded stylesheets)
  let fontEmbedCSS;
  const fontResult = await collectFontEmbedCSS(node);
  fontEmbedCSS = fontResult.css;
  if (!fontEmbedCSS && fontResult.hadFamilies) {
    warnings.push('Custom fonts could not be embedded; system fonts used instead.');
  }

  // 4. Dynamic import — keeps libraries out of main bundle
  const { toPng, toJpeg } = await import('html-to-image');

  const bgColor = backgroundColor || '#0b0f17';

  const sharedOpts = {
    pixelRatio,
    cacheBust: true,
    filter: exportFilter,
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
  };

  /**
   * Safari renders cross-origin images blank on the first call.
   * Warm up by calling once and discarding, then capture for real.
   */
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  try {
    if (format === 'pdf') {
      // PDF: capture as JPEG to keep file small
      if (isSafari) await toJpeg(node, { ...sharedOpts, backgroundColor: bgColor, quality: 0.5 }).catch(() => {});
      const dataUrl = await toJpeg(node, { ...sharedOpts, backgroundColor: bgColor, quality: 0.92 });

      const { jsPDF } = await import('jspdf');
      const orientation = width >= height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], hotfixes: ['px_scaling'] });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);

      const blob = pdf.output('blob');
      downloadBlob(blob, `${safeName}.pdf`);

    } else if (format === 'jpg') {
      if (isSafari) await toJpeg(node, { ...sharedOpts, backgroundColor: bgColor, quality: 0.5 }).catch(() => {});
      const dataUrl = await toJpeg(node, { ...sharedOpts, backgroundColor: bgColor, quality: 0.92 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeName}.jpg`);

    } else {
      // PNG
      if (isSafari) await toPng(node, sharedOpts).catch(() => {});
      const dataUrl = await toPng(node, sharedOpts);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeName}.png`);
    }
  } catch (err) {
    console.error('[exportPoster]', err);
    throw new Error("We couldn't create the file. Please try again.");
  }

  return { ok: true, warnings };
}
