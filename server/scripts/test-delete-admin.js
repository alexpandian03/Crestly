import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import Poster from '../models/Poster.model.js';
import Session from '../models/Session.model.js';
import Token from '../models/Token.model.js';
import Asset from '../models/Asset.model.js';
import AuditEvent from '../models/AuditEvent.model.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Test cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `DelPass${crypto.randomBytes(6).toString('hex')}9!`;

const emails = {
  superadmin: `del-super-${runId}@example.test`,
  adminA: `del-admin-a-${runId}@example.test`,
  userA: `del-user-a-${runId}@example.test`,
  userToDelete: `del-victim-${runId}@example.test`,
};

let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  if (!options.omitCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    headers['x-csrf-token'] = '1';
    headers.Origin = baseUrl;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function login(email) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

async function run() {
  console.log('\n--- Superadmin User & Organization Deletion Tests ---');
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 1. Seed test client and users
  const testClient = await Client.create({ name: `Del-Client-${runId}`, plan: 'starter', isActive: true });
  await BrandKit.create({ clientId: testClient._id, orgName: testClient.name });
  const tplData = getDefaultTemplateData(testClient._id);
  const tpl = await Template.create(tplData);
  const passwordHash = await User.hashPassword(password);
  const superadmin = await User.create({
    name: 'Super Admin',
    email: emails.superadmin,
    passwordHash,
    role: 'superadmin',
    isActive: true,
  });
  const adminA = await User.create({
    name: 'Admin A',
    email: emails.adminA,
    passwordHash,
    role: 'clientadmin',
    clientId: testClient._id,
    isActive: true,
  });
  const userA = await User.create({
    name: 'User A',
    email: emails.userA,
    passwordHash,
    role: 'user',
    clientId: testClient._id,
    isActive: true,
  });
  const userToDelete = await User.create({
    name: 'User Victim',
    email: emails.userToDelete,
    passwordHash,
    role: 'user',
    clientId: testClient._id,
    isActive: true,
  });

  const poster = await Poster.create({
    clientId: testClient._id,
    userId: userA._id,
    templateId: tpl._id,
    title: 'Test Poster',
    prompt: 'A poster for annual sports gala',
    content: { title: 'Test Poster' },
    status: 'draft',
  });

  await Asset.create({
    clientId: testClient._id,
    name: 'Logo Asset',
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  });

  // Login tokens
  const superRes = await login(emails.superadmin);
  const superToken = superRes.body.data.token;
  const adminRes = await login(emails.adminA);
  const adminToken = adminRes.body.data.token;
  const userDelRes = await login(emails.userToDelete);
  const userDelToken = userDelRes.body.data.token;

  // 2. Clientadmin cannot permanently delete users
  const clientAdminDelRes = await request(`/api/users/${userToDelete._id}?permanent=true`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert(clientAdminDelRes.status === 403, 'clientadmin cannot permanently delete user (403)');

  // 3. Superadmin cannot delete own account
  const superDelSelfRes = await request(`/api/users/${superadmin._id}?permanent=true`, {
    method: 'DELETE',
    token: superToken,
  });
  assert(superDelSelfRes.status === 400, 'superadmin cannot delete own account (400)');

  // 4. Clientadmin cannot delete organization
  const clientAdminDelOrg = await request(`/api/clients/${testClient._id}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert(clientAdminDelOrg.status === 403, 'clientadmin cannot delete organization (403)');

  // 5. Superadmin CAN delete a clientadmin
  const adminDelRes = await request(`/api/users/${adminA._id}?permanent=true`, {
    method: 'DELETE',
    token: superToken,
  });
  assert(adminDelRes.status === 200, 'superadmin can delete a clientadmin (200)');
  assert(adminDelRes.body.data.deleted === true, 'response contains deleted: true for clientadmin');

  // Verify clientadmin is gone from database
  const adminInDb = await User.findById(adminA._id);
  assert(!adminInDb, 'deleted clientadmin no longer exists in database');

  // 6. Superadmin CAN permanently delete a user
  const userDelSuccessRes = await request(`/api/users/${userToDelete._id}?permanent=true`, {
    method: 'DELETE',
    token: superToken,
  });
  assert(userDelSuccessRes.status === 200, 'superadmin deletes user successfully (200)');
  assert(userDelSuccessRes.body.data.deleted === true, 'response contains deleted: true');

  // Verify user is gone from database
  const userInDb = await User.findById(userToDelete._id);
  assert(!userInDb, 'deleted user no longer exists in database');

  // Verify deleted user sessions are terminated
  const sessionsInDb = await Session.find({ userId: userToDelete._id });
  assert(sessionsInDb.length === 0, 'sessions for deleted user are terminated');

  // Verify token cannot be used anymore
  const meWithDelToken = await request('/api/auth/me', { token: userDelToken });
  assert(meWithDelToken.status === 401, 'deleted user token is immediately rejected with 401');

  // Verify audit event written
  const userDelAudit = await AuditEvent.findOne({ action: 'user.delete', targetId: String(userToDelete._id) });
  assert(Boolean(userDelAudit), 'user.delete audit event recorded');

  // 7. Superadmin CAN delete organization (with cascade)
  const superDelOrg = await request(`/api/clients/${testClient._id}`, {
    method: 'DELETE',
    token: superToken,
  });
  assert(superDelOrg.status === 200, 'superadmin deletes organization successfully (200)');
  assert(superDelOrg.body.data.deleted === true, 'response contains deleted: true for client');

  // Verify client is gone
  const clientInDb = await Client.findById(testClient._id);
  assert(!clientInDb, 'deleted client no longer exists in database');

  // Verify cascade deletion of associated entities
  const remainingUsers = await User.find({ clientId: testClient._id });
  assert(remainingUsers.length === 0, 'all users belonging to organization are cascade deleted');

  const remainingPosters = await Poster.find({ clientId: testClient._id });
  assert(remainingPosters.length === 0, 'all posters belonging to organization are cascade deleted');

  const remainingTemplates = await Template.find({ clientId: testClient._id });
  assert(remainingTemplates.length === 0, 'all templates belonging to organization are cascade deleted');

  const remainingBrandKits = await BrandKit.find({ clientId: testClient._id });
  assert(remainingBrandKits.length === 0, 'brand kit belonging to organization is cascade deleted');

  const remainingAssets = await Asset.find({ clientId: testClient._id });
  assert(remainingAssets.length === 0, 'assets belonging to organization are cascade deleted');

  // Verify client.delete audit event
  const clientDelAudit = await AuditEvent.findOne({ action: 'client.delete', targetId: String(testClient._id) });
  assert(Boolean(clientDelAudit), 'client.delete audit event recorded');

  // Clean up superadmin
  await User.findByIdAndDelete(superadmin._id);

  console.log('\nAll Superadmin User & Organization Deletion tests passed successfully!');
  await mongoose.disconnect();
  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('\nTest failed:', err);
  if (server) server.close();
  mongoose.disconnect().finally(() => process.exit(1));
});
