import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function runSeed() {
  const name = process.env.SEED_ADMIN_NAME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!process.env.MONGODB_URI || !name || !email || !password) {
    fail('MONGODB_URI and all SEED_ADMIN_* variables are required.');
    return;
  }
  if (password.length < 12 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail('SEED_ADMIN_PASSWORD must be 12-72 characters and include a letter and number.');
    return;
  }

  try {
    await connectDB();
    const existing = await User.findOne({ role: 'superadmin' }).select('+passwordHash');
    const passwordHash = await User.hashPassword(password);
    if (existing) {
      existing.name = name;
      existing.email = email;
      existing.passwordHash = passwordHash;
      existing.clientId = null;
      existing.isActive = true;
      existing.mustChangePassword = false;
      await existing.save();
    } else {
      await User.create({
        name,
        email,
        passwordHash,
        role: 'superadmin',
        clientId: null,
        isActive: true,
        mustChangePassword: false,
      });
    }
    console.log('Superadmin seed completed.');
  } catch (err) {
    fail(`Seeding failed: ${err.message}`);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

await runSeed();
