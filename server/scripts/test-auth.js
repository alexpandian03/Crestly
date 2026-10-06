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
import LoginAttempt from '../models/LoginAttempt.model.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Authentication tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Auth${crypto.randomBytes(8).toString('hex')}9`;
const emails = {
  superadmin: `auth-super-${runId}@example.test`,
  adminA: `auth-admin-a-${runId}@example.test`,
  adminB: `auth-admin-b-${runId}@example.test`,
  userA: `auth-user-a-${runId}@example.test`,
  inactive: `auth-inactive-${runId}@example.test`,
  limited: `auth-limited-${runId}@example.test`,
  created: `auth-created-${runId}@example.test`,
};
const createdClientIds = [];
let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function request(path, { method = 'GET', token, headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { status: response.status, body: json };
}

async function directUser({ name, email, role, clientId = null, isActive = true }) {
  return User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
    isActive,
  });
}

async function login(email, candidate = password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password: candidate } });
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      User.deleteMany({ email: { $in: Object.values(emails) } }),
      LoginAttempt.deleteMany({ email: { $in: Object.values(emails) } }),
      BrandKit.deleteMany({ clientId: { $in: createdClientIds } }),
      Template.deleteMany({ clientId: { $in: createdClientIds } }),
      Client.deleteMany({ _id: { $in: createdClientIds } }),
    ]);
    await mongoose.connection.close();
  }
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for authentication tests.');
  await connectDB();
  await Promise.all([User.init(), LoginAttempt.init()]);

  const [clientA, clientB] = await Client.create([
    { name: `Auth A ${runId}`, plan: 'starter', isActive: true },
    { name: `Auth B ${runId}`, plan: 'starter', isActive: true },
  ]);
  createdClientIds.push(clientA._id, clientB._id);
  await BrandKit.create([
    { clientId: clientA._id, orgName: `Auth A ${runId}` },
    { clientId: clientB._id, orgName: `Auth B ${runId}` },
  ]);
  await Template.create([
    getDefaultTemplateData(clientA._id, `Auth A ${runId}`),
    getDefaultTemplateData(clientB._id, `Auth B ${runId}`),
  ]);

  const superadmin = await directUser({ name: 'Test Superadmin', email: emails.superadmin, role: 'superadmin' });
  const adminA = await directUser({ name: 'Admin A', email: emails.adminA, role: 'clientadmin', clientId: clientA._id });
  await directUser({ name: 'Admin B', email: emails.adminB, role: 'clientadmin', clientId: clientB._id });
  await directUser({ name: 'User A', email: emails.userA, role: 'user', clientId: clientA._id });
  await directUser({ name: 'Inactive', email: emails.inactive, role: 'user', clientId: clientA._id, isActive: false });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const successfulLogin = await login(emails.userA);
  assert(successfulLogin.status === 200 && successfulLogin.body.data?.token, 'login succeeds');
  const userToken = successfulLogin.body.data.token;

  const badLogin = await login(emails.userA, 'WrongPassword9');
  assert(badLogin.status === 401 && badLogin.body.error?.message === 'Invalid email or password', 'wrong password is generic');
  const missingLogin = await login(`missing-${runId}@example.test`, 'WrongPassword9');
  assert(missingLogin.status === 401 && missingLogin.body.error?.message === 'Invalid email or password', 'unknown email is generic');

  const inactiveLogin = await login(emails.inactive);
  assert(inactiveLogin.status === 403, 'inactive user is blocked');
  await Client.updateOne({ _id: clientB._id }, { $set: { isActive: false } });
  const inactiveClientLogin = await login(emails.adminB);
  assert(inactiveClientLogin.status === 403, 'user in an inactive client is blocked');
  await Client.updateOne({ _id: clientB._id }, { $set: { isActive: true } });

  for (let index = 0; index < 5; index += 1) {
    const failed = await login(emails.limited, 'WrongPassword9');
    assert(failed.status === 401, `failed login ${index + 1} is recorded`);
  }
  const limited = await login(emails.limited, 'WrongPassword9');
  assert(limited.status === 429 && limited.body.error?.message === 'Too many attempts. Try again in a few minutes.', 'sixth login attempt is limited');

  const deniedUsers = await request('/api/users', {
    method: 'POST',
    token: userToken,
    body: { name: 'No Access', email: emails.created, password, role: 'user', clientId: clientB._id.toString() },
  });
  const deniedClients = await request('/api/clients', {
    method: 'POST',
    token: userToken,
    body: { name: 'No Access Client' },
  });
  assert(deniedUsers.status === 403 && deniedClients.status === 403, 'user cannot create users or clients');

  const adminLogin = await login(emails.adminA);
  const adminToken = adminLogin.body.data.token;
  const superRole = await request('/api/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Forbidden Super', email: emails.created, password, role: 'superadmin' },
  });
  assert(superRole.status === 403, 'clientadmin cannot create superadmin');

  const foreignCreate = await request('/api/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Scoped User', email: emails.created, password, role: 'user', clientId: clientB._id.toString() },
  });
  assert(foreignCreate.status === 201 && foreignCreate.body.data.user.clientId === clientA._id.toString(), 'clientadmin cannot create in another client');

  const foreignUsers = await request(`/api/users?clientId=${clientB._id}`, { token: adminToken });
  assert(foreignUsers.status === 200 && foreignUsers.body.data.users.every((item) => item.clientId === clientA._id.toString()), 'clientadmin cannot list another client users');
  const foreignBrand = await request(`/api/brand-kit?clientId=${clientB._id}`, { token: adminToken });
  assert(foreignBrand.status === 200 && String(foreignBrand.body.data.brandKit.clientId) === clientA._id.toString(), 'clientadmin cannot read another brand kit');
  const foreignBrandWrite = await request('/api/brand-kit', {
    method: 'PUT',
    token: adminToken,
    body: { clientId: clientB._id.toString(), orgName: `Scoped A ${runId}` },
  });
  const untouchedBrand = await BrandKit.findOne({ clientId: clientB._id });
  assert(foreignBrandWrite.status === 200 && String(foreignBrandWrite.body.data.brandKit.clientId) === clientA._id.toString() && untouchedBrand.orgName === `Auth B ${runId}`, 'foreign clientId in brand-kit body is ignored');
  const foreignTemplates = await request(`/api/templates?clientId=${clientB._id}`, { token: adminToken });
  assert(foreignTemplates.status === 200 && foreignTemplates.body.data.templates.every((item) => String(item.clientId) === clientA._id.toString()), 'clientadmin cannot read another client templates');
  const templateData = getDefaultTemplateData(clientB._id, `Foreign ${runId}`);
  const foreignTemplateWrite = await request('/api/templates', {
    method: 'POST',
    token: adminToken,
    body: { clientId: clientB._id.toString(), name: templateData.name, category: templateData.category, size: templateData.size, zones: templateData.zones },
  });
  assert(foreignTemplateWrite.status === 201 && String(foreignTemplateWrite.body.data.template.clientId) === clientA._id.toString(), 'foreign clientId in template body is ignored');

  const superToken = (await login(emails.superadmin)).body.data.token;
  const selectedBrand = await request('/api/brand-kit', {
    token: superToken,
    headers: { 'x-client-id': clientB._id.toString() },
  });
  assert(selectedBrand.status === 200 && String(selectedBrand.body.data.brandKit.clientId) === clientB._id.toString(), 'superadmin can act on selected client');

  const lastAdmin = await request(`/api/users/${adminA._id}`, {
    method: 'PATCH',
    token: superToken,
    body: { isActive: false },
  });
  assert(lastAdmin.status === 400, 'last active clientadmin is protected');

  const me = await request('/api/auth/me', { token: userToken });
  const users = await request('/api/users', { token: superToken });
  assert(!JSON.stringify(me.body).includes('passwordHash') && !JSON.stringify(users.body).includes('passwordHash'), 'passwordHash never appears');

  await request(`/api/users/${successfulLogin.body.data.user.id}`, {
    method: 'PATCH',
    token: superToken,
    body: { isActive: false },
  });
  const staleToken = await request('/api/auth/me', { token: userToken });
  assert(staleToken.status === 401, 'deactivated user existing token stops working');
}

try {
  await run();
  console.log('Authentication tests passed.');
} catch (err) {
  console.error(`Authentication tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Authentication test cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
