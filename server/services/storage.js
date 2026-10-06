import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary if credentials are present
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Storage Service Wrapper
 * Allows swapping Cloudinary for S3, GCS, or other providers without modifying controllers.
 */
class StorageService {
  /**
   * Upload an in-memory buffer to Cloudinary (never writes to local disk)
   * @param {Buffer} buffer - File buffer from multer memory storage
   * @param {Object} options - Upload options (folder, filename, tags, etc.)
   * @returns {Promise<{ url: string, public_id: string, format: string, width: number, height: number }>}
   */
  async uploadBuffer(buffer, options = {}) {
    const { folder = 'poster-generator/logos', filename, mimetype = 'image/png' } = options;

    if (!isCloudinaryConfigured) {
      console.warn('⚠️ Cloudinary not fully configured with production keys; generating inline data URI for local dev.');
      const base64Data = buffer.toString('base64');
      const dataUri = `data:${mimetype};base64,${base64Data}`;
      return {
        url: dataUri,
        secure_url: dataUri,
        public_id: `dev_${filename || Date.now()}`,
        format: mimetype.split('/')[1] || 'png',
        bytes: buffer.length,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: 'image',
        public_id:
          options.publicId ?? (filename ? `${filename}_${Date.now()}` : undefined),
        overwrite: true,
      };

      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return reject(new Error(error.message || 'Cloudinary upload failed'));
        }
        resolve({
          url: result.secure_url || result.url,
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      });

      stream.end(buffer);
    });
  }

  /**
   * Sign a browser-to-Cloudinary upload so no image bytes pass through Vercel.
   * The folder and the accepted formats are inside the signature, so the browser
   * cannot aim the upload at another tenant or another file type.
   * @returns {Promise<{ cloudName: string, apiKey: string, timestamp: number, folder: string, allowedFormats: string, signature: string } | null>}
   */
  async signDirectUpload({ folder, allowedFormats = 'jpg,png,webp' }) {
    if (!isCloudinaryConfigured) return null;
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { timestamp, folder, allowed_formats: allowedFormats };
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      allowedFormats,
      signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET),
    };
  }

  /**
   * Delete an asset by its public_id
   */
  async deleteAsset(publicId) {
    if (!isCloudinaryConfigured) return true;
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (err) {
      console.error('Failed to delete asset from Cloudinary:', err);
      return false;
    }
  }
}

const storageService = new StorageService();
export default storageService;
export { storageService, isCloudinaryConfigured };
