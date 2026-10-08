import express from 'express';
import { isDbConnected } from '../config/db.js';
import { llmProviderName } from '../services/ai/index.js';
import { imageSearchProviderName } from '../services/images.js';
import { imageProviderName } from '../services/image/index.js';

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = !process.env.MONGODB_URI
    ? 'unconfigured'
    : isDbConnected()
    ? 'connected'
    : 'connecting_or_disconnected';

  const llm = llmProviderName();
  const imageSearch = imageSearchProviderName();

  res.status(200).json({
    status: 'ok',
    service: 'AI Poster Generator API',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    vercel: Boolean(process.env.VERCEL),
    providers: {
      llm,
      imageSearch,
      imageGeneration: imageProviderName(),
    },
    activeProviders: `LLM: ${llm}, image search: ${imageSearch}`,
  });
});

export default router;
