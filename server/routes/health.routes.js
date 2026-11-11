import express from 'express';
import { allowAnonymous } from '../middleware/auth.middleware.js';
import { isDbConnected } from '../config/db.js';
import { getHuggingFaceConfig } from '../controllers/huggingFace.controller.js';

const router = express.Router();

router.get('/', allowAnonymous(), (req, res) => {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  const dbStatus = !uri
    ? 'unconfigured'
    : isDbConnected()
    ? 'connected'
    : 'connecting_or_disconnected';
  const { provider, model } = getHuggingFaceConfig();
  const activeLabel = `${provider} (${model})`;

  res.status(200).json({
    status: 'ok',
    service: 'AI Poster Generator API',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    vercel: Boolean(process.env.VERCEL),
    providers: {
      imageGeneration: activeLabel,
    },
    activeProviders: activeLabel,
    imageModel: model,
  });
});

export default router;
