import multer from 'multer';

// Memory storage ensures no file is ever saved to local disk (Vercel serverless rule)
const storage = multer.memoryStorage();

const allowedMimetypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

const posterImageMimetypes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file format. Only JPEG, PNG, WEBP, and SVG images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

const posterImageFilter = (req, file, cb) => {
  if (posterImageMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Only JPG, PNG or WebP images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

export const uploadLogoMiddleware = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
}).single('logo');

export const uploadPosterImageMiddleware = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: posterImageFilter,
}).single('image');

const thumbnailMimetypes = ['image/jpeg', 'image/webp'];
export const THUMBNAIL_MAX_BYTES = 300 * 1024;

const thumbnailFilter = (req, file, cb) => {
  if (thumbnailMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Thumbnail must be a JPEG or WebP image.');
    error.status = 400;
    cb(error, false);
  }
};

const thumbnailUploader = multer({
  storage,
  limits: { fileSize: THUMBNAIL_MAX_BYTES, files: 1 },
  fileFilter: thumbnailFilter,
}).single('image');

export function uploadThumbnailMiddleware(req, res, next) {
  thumbnailUploader(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      const error = new Error('Thumbnail must be 300 KB or smaller.');
      error.status = 413;
      return next(error);
    }
    next(err);
  });
}
