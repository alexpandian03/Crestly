/**
 * Brand artwork goes from the browser straight to Cloudinary: the file is
 * checked, shrunk and re-encoded here, then uploaded with a short-lived
 * signature from POST /api/uploads/brand-image/sign. No image bytes pass
 * through the server.
 */
import api from '../services/api';

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_EDGE = 2000;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const QUALITY = 0.82;

let webpSupport;

function canvasSupportsWebP() {
  if (webpSupport === undefined) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Plain-language reason, or null when the file can be processed. */
export function checkBrandFile(file) {
  if (!file) return 'Choose an image file.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > MAX_INPUT_BYTES) {
    return `That image is ${formatBytes(file.size)}. Please choose one under 5 MB.`;
  }
  if (file.size === 0) return 'That file appears to be empty.';
  return null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("We couldn't read that image. Try a different file."));
    img.src = url;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, QUALITY);
  });
}

/**
 * Returns { blob, width, height, resized } for any JPG/PNG/WebP file. The image
 * is scaled down to at most 2000 px on its longest side; small files that would
 * grow when re-encoded are uploaded unchanged.
 */
export async function prepareBrandImage(file) {
  const problem = checkBrandFile(file);
  if (problem) throw new Error(problem);

  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const source = { blob: file, width: img.naturalWidth, height: img.naturalHeight, resized: false };
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const type = canvasSupportsWebP() ? 'image/webp' : file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, type);
  if (!blob) return source;
  /* Re-encoding only helps when it makes the file lighter. */
  if (scale === 1 && blob.size >= file.size) return source;
  return { blob, width, height, resized: scale !== 1 };
}

function uploadFailure(status, body) {
  const raw = String(body?.error?.message || '');
  if (/signature/i.test(raw)) return 'This upload link expired. Please try again.';
  if (/format/i.test(raw)) return 'That file type is not allowed. Use a JPG, PNG or WebP image.';
  if (/size|exceed/i.test(raw)) return 'That image is too large for the image library. Try a smaller one.';
  if (status === 401 || status === 403) return 'Your session expired. Log in again and retry the upload.';
  return 'The image library rejected the upload. Please try again.';
}

/** POST the prepared file straight to Cloudinary, reporting upload progress. */
function postToCloudinary(endpoint, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      const url = body?.secure_url;
      if (xhr.status >= 200 && xhr.status < 300 && typeof url === 'string' && url.startsWith('https://')) {
        resolve(url);
        return;
      }
      reject(new Error(uploadFailure(xhr.status, body)));
    };
    xhr.onerror = () =>
      reject(new Error('The upload could not reach the image library. Check your connection and try again.'));
    xhr.send(form);
  });
}

/**
 * Resize + upload one brand image.
 * @returns {Promise<{ url: string, bytes: number, width: number, height: number, resized: boolean }>}
 */
export async function uploadBrandImage({ file, kind = 'default', onProgress }) {
  onProgress?.(4);
  const prepared = await prepareBrandImage(file);
  onProgress?.(12);

  const signResponse = await api.post('/uploads/brand-image/sign', { kind });
  const sign = signResponse.data?.data;
  if (!signResponse.data?.success || !sign?.cloudName || !sign?.signature) {
    throw new Error('Image storage is not connected yet. Please contact an administrator.');
  }
  onProgress?.(20);

  const extension = prepared.blob.type === 'image/png' ? 'png' : prepared.blob.type === 'image/webp' ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('file', prepared.blob, `brand-${kind}-${Date.now()}.${extension}`);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', sign.timestamp);
  form.append('folder', sign.folder);
  form.append('signature', sign.signature);
  form.append('allowed_formats', sign.allowedFormats || 'jpg,png,webp');

  const url = await postToCloudinary(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
    form,
    (value) => onProgress?.(20 + Math.round(value * 0.75))
  );
  onProgress?.(100);

  return { url, bytes: prepared.blob.size, width: prepared.width, height: prepared.height, resized: prepared.resized };
}

/** Turn an API or network error into something a non-technical user can act on. */
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  const message = err?.response?.data?.error?.message || err?.message || '';
  if (!message) return fallback;
  if (/Validation failed/i.test(message)) {
    return (
      message
        .replace(/^.*Validation failed:\s*/i, '')
        .split(';')
        .map((part) => part.replace(/^[^:]*:\s*/, '').trim())
        .filter(Boolean)
        .join(' ') || fallback
    );
  }
  if (/Network Error|timeout|ECONN/i.test(message)) return 'The connection dropped. Please try again.';
  return message;
}
