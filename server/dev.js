import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

async function startLocalServer() {
  try {
    if (process.env.MONGODB_URI) {
      console.log('🔄 Initializing database connection...');
      await connectDB();
    } else {
      console.log('ℹ️ Running in local development mode without MONGODB_URI.');
    }
  } catch (err) {
    console.warn('⚠️ MongoDB connection could not be established at startup:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [DEV SERVER] Express running locally at: http://localhost:${PORT} (http://127.0.0.1:${PORT})`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  });
}

startLocalServer();
