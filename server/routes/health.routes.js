import express from 'express';
import { isDbConnected } from '../config/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = !process.env.MONGODB_URI
    ? 'unconfigured'
    : isDbConnected()
    ? 'connected'
    : 'connecting_or_disconnected';

  res.status(200).json({
    status: 'ok',
    service: 'AI Poster Generator API',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    vercel: Boolean(process.env.VERCEL),
  });
});

export default router;
