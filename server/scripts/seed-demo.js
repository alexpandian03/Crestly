import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Client from '../models/Client.model.js';
import User from '../models/User.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';

const fields = [
  'DEMO_CLIENT_NAME',
  'DEMO_CLIENT_ADMIN_NAME',
  'DEMO_CLIENT_ADMIN_EMAIL',
  'DEMO_CLIENT_ADMIN_PASSWORD',
  'DEMO_USER_NAME',
  'DEMO_USER_EMAIL',
  'DEMO_USER_PASSWORD',
];

function validPassword(value) {
  return value?.length >= 12 && value.length <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

async function upsertDemoUser({ name, email, password, role, clientId, createdBy }) {
  const passwordHash = await User.hashPassword(password);
  return User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role, clientId, isActive: true, mustChangePassword: false, createdBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
  if (!process.env.MONGODB_URI || fields.some((field) => !process.env[field])) {
    throw new Error(`MONGODB_URI and ${fields.join(', ')} are required.`);
  }
  if (!validPassword(process.env.DEMO_CLIENT_ADMIN_PASSWORD) || !validPassword(process.env.DEMO_USER_PASSWORD)) {
    throw new Error('Demo passwords must be 12-72 characters and include a letter and number.');
  }

  await connectDB();
  const client = await Client.findOneAndUpdate(
    { name: process.env.DEMO_CLIENT_NAME.trim() },
    { name: process.env.DEMO_CLIENT_NAME.trim(), plan: 'starter', isActive: true },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await BrandKit.findOneAndUpdate(
    { clientId: client._id },
    { $setOnInsert: { clientId: client._id, orgName: client.name } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!(await Template.exists({ clientId: client._id }))) {
    await Template.create(getDefaultTemplateData(client._id, client.name));
  }
  const creator = await User.findOne({ role: 'superadmin', isActive: true }).select('_id');
  await upsertDemoUser({
    name: process.env.DEMO_CLIENT_ADMIN_NAME,
    email: process.env.DEMO_CLIENT_ADMIN_EMAIL,
    password: process.env.DEMO_CLIENT_ADMIN_PASSWORD,
    role: 'clientadmin',
    clientId: client._id,
    createdBy: creator?._id || null,
  });
  await upsertDemoUser({
    name: process.env.DEMO_USER_NAME,
    email: process.env.DEMO_USER_EMAIL,
    password: process.env.DEMO_USER_PASSWORD,
    role: 'user',
    clientId: client._id,
    createdBy: creator?._id || null,
  });
  console.log('Demo seed completed.');
}

try {
  await run();
} catch (err) {
  console.error(`Demo seeding failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close().catch(() => {});
}
