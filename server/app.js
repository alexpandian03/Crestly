import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectDB } from './config/db.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import clientRoutes from './routes/client.routes.js';
import brandKitRoutes from './routes/brandKit.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import templateRoutes from './routes/template.routes.js';
import posterRoutes from './routes/poster.routes.js';
import assetRoutes from './routes/asset.routes.js';
import auditRoutes from './routes/audit.routes.js';

import { initServerSentry, captureServerException } from './config/sentry.js';
import { httpLogger } from './utils/logger.js';

import { cookieParser } from './middleware/cookies.middleware.js';
import { csrfProtection } from './middleware/csrf.middleware.js';

initServerSentry();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// HTTP logging via pino-http (attaches request ID, strips secrets/tokens/bodies)
app.use(httpLogger);
app.use((req, res, next) => {
  if (req.id) res.setHeader('x-request-id', req.id);
  res.removeHeader('X-Powered-By');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://images.unsplash.com',
          'https://images.pexels.com',
        ],
        connectSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Restricted CORS: same-origin and approved local dev origins with credentials (no open CORS wildcard)
const allowedOrigins = new Set(
  [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.CLIENT_URL,
  ].filter(Boolean)
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const parsed = new URL(origin);
        if (
          allowedOrigins.has(origin) ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1'
        ) {
          return callback(null, true);
        }
      } catch {}
      const corsErr = new Error('Not allowed by CORS');
      corsErr.status = 403;
      return callback(corsErr);
    },
    credentials: true,
  })
);

// Cookie parser (pure zero-dependency)
app.use(cookieParser);

// CSRF Protection for state-changing requests
app.use(csrfProtection);

// Body parser with 4.5MB limit (respecting Vercel serverless request body constraints)
app.use(express.json({ limit: '4.5mb' }));
app.use(express.urlencoded({ extended: true, limit: '4.5mb' }));

// Middleware: Ensure cached Mongoose connection is ready before handling requests
app.use(async (req, res, next) => {
  try {
    if (process.env.DATABASE_URL || process.env.MONGODB_URI) {
      await connectDB();
    }
  } catch (err) {
    console.error('Database connection middleware warning:', err.message);
  }
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Direct routes: POST /api/login, POST /api/logout, GET /api/me

app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/brand-kit', brandKitRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/posters', posterRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/audit', auditRoutes);

// 404 handler for unmatched API routes
app.use((req, res, _next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      status: 404,
    },
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  const duplicateEmail = err?.code === 11000 && err?.keyPattern?.email;
  const status = duplicateEmail ? 409 : err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('Unhandled server error:', err);
    captureServerException(err);
  }
  const message = duplicateEmail
    ? 'That email is already in use'
    : status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';
  res.status(status).json({
    success: false,
    error: { message, status },
  });
});

export default app;
