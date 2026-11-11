import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const [{ default: app }, { connectDB }, { getHuggingFaceConfig }] = await Promise.all([
  import('./app.js'),
  import('./config/db.js'),
  import('./controllers/huggingFace.controller.js'),
]);

const PORT = process.env.PORT || 5000;

async function startLocalServer() {
  try {
    if (process.env.DATABASE_URL || process.env.MONGODB_URI) {
      console.log('🔄 Initializing database connection...');
      await connectDB();
    } else {
      console.log('ℹ️ Running in local development mode without DATABASE_URL / MONGODB_URI.');
    }
  } catch (err) {
    console.warn('⚠️ MongoDB connection could not be established at startup:', err.message);
  }

  const { provider, model } = getHuggingFaceConfig();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [DEV SERVER] Express running locally at: http://localhost:${PORT} (http://127.0.0.1:${PORT})`);
    console.log(`🔌 Active AI provider: ${provider} (${model})`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  });
}

startLocalServer();
