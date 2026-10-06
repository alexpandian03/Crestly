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

const app = express();
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration (enables local dev cross-origin if needed)
app.use(cors());

// Body parser with 4.5MB limit (respecting Vercel serverless request body constraints)
app.use(express.json({ limit: '4.5mb' }));
app.use(express.urlencoded({ extended: true, limit: '4.5mb' }));

// Middleware: Ensure cached Mongoose connection is ready before handling requests
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
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
app.use('/auth', authRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/clients', clientRoutes);
app.use('/clients', clientRoutes);

app.use('/api/brand-kit', brandKitRoutes);
app.use('/brand-kit', brandKitRoutes);

app.use('/api/uploads', uploadRoutes);
app.use('/uploads', uploadRoutes);

app.use('/api/templates', templateRoutes);
app.use('/templates', templateRoutes);

app.use('/api/posters', posterRoutes);
app.use('/posters', posterRoutes);

// 404 handler for unmatched API routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      status: 404,
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const duplicateEmail = err?.code === 11000 && err?.keyPattern?.email;
  const status = duplicateEmail ? 409 : err.status || err.statusCode || 500;
  if (status >= 500) console.error('Unhandled server error:', err);
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
