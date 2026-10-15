import api from '../services/api';

/**
 * Checks an image file against type and size limits, resizes in browser using HTML canvas
 * if width or height exceeds 2000 px, and compresses to JPEG or PNG.
 *
 * @param {File} file
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function prepareImageForUpload(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!file || !allowed.includes(file.type)) {
    throw new Error('Please choose a JPG, PNG, or WebP photo.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Please choose a photo smaller than 5 MB.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 2000;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not process this photo in your browser.'));
      }
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = mimeType === 'image/jpeg' ? 0.88 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Could not prepare this photo for upload.'));
          }
          resolve({ blob, width, height });
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this photo. Please try another one.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Direct signed upload to Cloudinary and registration with the backend asset library.
 * Never passes image bytes through the Vercel server.
 *
 * @param {File} file
 * @returns {Promise<Object>} The registered asset object from the database
 */
export async function directUploadAsset(file) {
  const { blob, width, height } = await prepareImageForUpload(file);

  // 1. Get signed signature for this client tenant
  const signRes = await api.post('/assets/sign', { folder: 'posters' });
  const { signature, timestamp, apiKey, cloudName, folder } = signRes.data?.data || {};
  if (!signature || !cloudName) {
    throw new Error('Image storage is not connected. Please contact an administrator.');
  }

  // 2. Direct upload to Cloudinary
  const formData = new FormData();
  formData.append('file', blob, file.name);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error('Upload could not be completed. Please check your connection and try again.');
  }

  const uploadJson = await uploadRes.json();
  const secureUrl = uploadJson.secure_url;
  const publicId = uploadJson.public_id;
  const bytes = uploadJson.bytes || blob.size;

  // 3. Register asset with organization in database
  const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 100) || 'Uploaded photo';
  const registerRes = await api.post('/assets', {
    url: secureUrl,
    publicId,
    width: uploadJson.width || width,
    height: uploadJson.height || height,
    bytes,
    name,
  });

  return registerRes.data?.data;
}
