import mongoose from 'mongoose';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and across serverless function invocations on Vercel.
 */
let cached = global.__mongoose;

if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    // If not configured, we do not throw here to allow health checks & offline dev testing
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log('✅ MongoDB connection established.');
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      console.error('❌ MongoDB connection error:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export default connectDB;
