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
import Session from '../models/Session.model.js';
import Token from '../models/Token.model.js';
import RateCounter from '../models/RateCounter.model.js';
import AuditEvent from '../models/AuditEvent.model.js';
import { audit } from '../services/audit.service.js';
import { formatAuditSentence } from '../../shared/auditSentences.js';
import { createToken } from '../services/token.service.js';
import { assertAllRoutesHavePolicy, generatePermissionMatrix } from '../utils/routePolicies.js';
import { can, PERMISSIONS, ROLE_PERMISSIONS } from '../../shared/permissions.js';
import {
  generateMfaSecret,
  encryptMfaSecret,
  decryptMfaSecret,
  generateTOTP,
  verifyTotpCode,
  generateRecoveryCodes,
} from '../services/mfa.service.js';

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
  sessionUser: `auth-session-${runId}@example.test`,
  inactive: `auth-inactive-${runId}@example.test`,
  limited: `auth-limited-${runId}@example.test`,
  created: `auth-created-${runId}@example.test`,
  invited: `auth-invited-${runId}@example.test`,
  tamperInvite: `auth-tamper-${runId}@example.test`,
  rateLimitEmail: `auth-rate-pw-${runId}@example.test`,
};
const createdClientIds = [];
let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

function extractCookies(headers) {
  let raw = [];
  if (headers.getSetCookie) {
    raw = headers.getSetCookie();
  } else if (headers.raw && headers.raw()['set-cookie']) {
    raw = headers.raw()['set-cookie'];
  } else {
    const header = headers.get('set-cookie');
    if (header) raw = [header];
  }

  const cookies = {};
  raw.forEach((line) => {
    const parts = line.split(';');
    const [name, val] = parts[0].split('=');
    if (name) cookies[name.trim()] = val ? val.trim() : '';
  });
  return {
    raw,
    cookies,
    headerString: Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; '),
  };
}

async function request(path, { method = 'GET', token, headers = {}, body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text().catch(() => '');
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, headers: response.headers, body: json, text };
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
    const testUsers = await User.find({ email: { $in: Object.values(emails) } }).select('_id');
    const userIds = testUsers.map((u) => u._id);
    await Promise.all([
      Session.deleteMany({ userId: { $in: userIds } }),
      Token.deleteMany({
        $or: [
          { email: { $in: Object.values(emails) } },
          { userId: { $in: userIds } },
          { email: new RegExp(`-${runId}@example\\.test$`) },
        ],
      }),
      User.deleteMany({
        $or: [{ email: { $in: Object.values(emails) } }, { email: new RegExp(`-${runId}@example\\.test$`) }],
      }),
      LoginAttempt.deleteMany({
        $or: [{ email: { $in: Object.values(emails) } }, { email: new RegExp(`-${runId}@example\\.test$`) }],
      }),
      BrandKit.deleteMany({ clientId: { $in: createdClientIds } }),
      Template.deleteMany({ clientId: { $in: createdClientIds } }),
      Client.deleteMany({ _id: { $in: createdClientIds } }),
      RateCounter.deleteMany({}),
      AuditEvent.deleteMany({ clientId: { $in: createdClientIds } }),
    ]);
    await mongoose.connection.close();
  }
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for authentication tests.');
  await connectDB();
  await Promise.all([User.init(), LoginAttempt.init(), Session.init(), Token.init(), RateCounter.init(), AuditEvent.init()]);
  await RateCounter.deleteMany({});

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
  await directUser({ name: 'Session User', email: emails.sessionUser, role: 'user', clientId: clientA._id });
  await directUser({ name: 'Inactive', email: emails.inactive, role: 'user', clientId: clientA._id, isActive: false });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const successfulLogin = await login(emails.userA);
  assert(successfulLogin.status === 200 && successfulLogin.body.data?.token, 'login succeeds');
  const userToken = successfulLogin.body.data.token;

  // Session user tests for cookie flags, JS unreadability, rotation, reuse, logout, and idle expiry
  const sessionLogin = await login(emails.sessionUser);
  const loginCookies = extractCookies(sessionLogin.headers);
  assert(
    loginCookies.cookies.accessToken && loginCookies.cookies.refreshToken,
    'login sets accessToken and refreshToken cookies'
  );
  assert(
    loginCookies.raw.every(
      (c) => c.toLowerCase().includes('httponly') && c.toLowerCase().includes('samesite=lax')
    ),
    'cookies have the right flags'
  );
  assert(
    loginCookies.raw.every((c) => c.toLowerCase().includes('httponly')),
    'the token is never readable by JavaScript'
  );

  // Verify CSRF protection: state-changing request without custom header returns 403
  const noCsrfReq = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: loginCookies.headerString,
    },
  });
  assert(noCsrfReq.status === 403, 'CSRF header missing returns 403');

  // Verify Refresh Token rotation
  const refreshRes = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: loginCookies.headerString,
  });
  assert(refreshRes.status === 200 && refreshRes.body.data?.token, 'refresh rotates token');
  const rotatedCookies = extractCookies(refreshRes.headers);
  assert(rotatedCookies.cookies.refreshToken, 'new refresh token returned in cookie');

  // Verify reuse of old refresh token revokes entire family
  const reuseRes = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: `refreshToken=${loginCookies.cookies.refreshToken}`,
  });
  assert(reuseRes.status === 401, 'a stolen old refresh token fails and revokes the family');

  // Verify that legitimate user using the rotated token is now blocked because family was revoked
  const postRevokeRes = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: `refreshToken=${rotatedCookies.cookies.refreshToken}`,
  });
  assert(postRevokeRes.status === 401, 'revoked session family prevents any further refreshes');

  // Verify Logout works
  const loginForLogout = await login(emails.sessionUser);
  const logoutCookies = extractCookies(loginForLogout.headers);
  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    cookie: logoutCookies.headerString,
  });
  assert(logoutRes.status === 200, 'logout works');
  const postLogoutMe = await request('/api/auth/me', { cookie: logoutCookies.headerString });
  assert(postLogoutMe.status === 401, 'revoked session cannot access protected routes');

  // Verify Logout-all works
  const dev1 = await login(emails.sessionUser);
  const dev1Cookies = extractCookies(dev1.headers);
  const dev2 = await login(emails.sessionUser);
  const dev2Cookies = extractCookies(dev2.headers);

  assert((await request('/api/auth/me', { cookie: dev1Cookies.headerString })).status === 200, 'device 1 session is active');
  assert((await request('/api/auth/me', { cookie: dev2Cookies.headerString })).status === 200, 'device 2 session is active');

  const logoutAllRes = await request('/api/auth/logout-all', {
    method: 'POST',
    cookie: dev1Cookies.headerString,
  });
  assert(logoutAllRes.status === 200, 'logout-all works');
  assert((await request('/api/auth/me', { cookie: dev1Cookies.headerString })).status === 401, 'device 1 session revoked after logout-all');
  assert((await request('/api/auth/me', { cookie: dev2Cookies.headerString })).status === 401, 'device 2 session revoked after logout-all');

  // Verify Expired idle session
  const loginForIdle = await login(emails.sessionUser);
  const idleCookies = extractCookies(loginForIdle.headers);
  const idleHash = crypto.createHash('sha256').update(idleCookies.cookies.refreshToken).digest('hex');
  await Session.updateOne(
    { tokenHash: idleHash },
    { $set: { lastUsedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
  );
  const idleRefreshRes = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: `refreshToken=${idleCookies.cookies.refreshToken}`,
  });
  assert(idleRefreshRes.status === 401, 'expired idle session');

  // Continue with existing baseline tests
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

  // ==========================================
  // AUTH 2: EMAIL & TOKEN TESTS
  // ==========================================

  // 1. Same response for unknown emails in forgot-password
  const knownForgot = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: emails.userA },
  });
  const unknownForgot = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: `nonexistent-${runId}@example.test` },
  });
  assert(
    knownForgot.status === 200 &&
      unknownForgot.status === 200 &&
      knownForgot.body.data?.message === unknownForgot.body.data?.message,
    'same response for unknown emails'
  );

  // 2. Forgot-password rate limiting per email in MongoDB
  for (let i = 0; i < 4; i++) {
    await request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: emails.rateLimitEmail },
    });
  }
  const fifthAttempt = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: emails.rateLimitEmail },
  });
  const sixthAttempt = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: emails.rateLimitEmail },
  });
  assert(sixthAttempt.status === 429, 'rate limits enforced for forgot-password requests');

  // 3. Invites: clientadmin and superadmin invite by email with server-stored role
  const inviteRes = await request('/api/users/invite', {
    method: 'POST',
    token: adminToken,
    body: { email: emails.invited, role: 'user' },
  });
  assert(inviteRes.status === 201 && inviteRes.body.data?.invite?.rawToken, 'invite user succeeds');
  const rawInviteToken = inviteRes.body.data.invite.rawToken;

  // 3a. Invite role cannot be changed by editing the link or body
  const tamperInviteRes = await request('/api/users/invite', {
    method: 'POST',
    token: adminToken,
    body: { email: emails.tamperInvite, role: 'user' },
  });
  const rawTamperToken = tamperInviteRes.body.data.invite.rawToken;
  const tamperAcceptRes = await request('/api/auth/accept-invite', {
    method: 'POST',
    body: {
      token: rawTamperToken,
      name: 'Tamper Target',
      password: `${password}Secure1`,
      role: 'superadmin',
      clientId: clientB._id.toString(),
    },
  });
  assert(tamperAcceptRes.status === 201, 'accept invite succeeds');
  const createdTamperUser = await User.findOne({ email: emails.tamperInvite });
  assert(
    createdTamperUser &&
      createdTamperUser.role === 'user' &&
      String(createdTamperUser.clientId) === clientA._id.toString(),
    'invite role cannot be changed by editing the link'
  );

  // 4. Each token type works once & reused tokens fail
  // - Invite token works once:
  const acceptRes = await request('/api/auth/accept-invite', {
    method: 'POST',
    body: { token: rawInviteToken, name: 'Legit Invitee', password: `${password}Secure1` },
  });
  assert(acceptRes.status === 201, 'invite token works once');
  const reuseInviteRes = await request('/api/auth/accept-invite', {
    method: 'POST',
    body: { token: rawInviteToken, name: 'Legit Invitee', password: `${password}Secure1` },
  });
  assert(reuseInviteRes.status === 400, 'reused invite token fails');

  // - Reset token works once:
  const userForReset = await directUser({
    name: 'Reset Target',
    email: `reset-target-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
  });
  const { rawToken: rawResetToken } = await createToken({
    type: 'reset',
    userId: userForReset._id,
    email: userForReset.email,
  });
  const resetRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: rawResetToken, password: `${password}NewPass1` },
  });
  assert(resetRes.status === 200, 'reset token works once');
  const reuseResetRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: rawResetToken, password: `${password}NewPass2` },
  });
  assert(reuseResetRes.status === 400, 'reused reset token fails');

  // - Verify token works once:
  const { rawToken: rawVerifyToken } = await createToken({
    type: 'verify',
    userId: userForReset._id,
    email: userForReset.email,
  });
  const verifyRes = await request('/api/auth/verify-email', {
    method: 'POST',
    body: { token: rawVerifyToken },
  });
  assert(verifyRes.status === 200, 'verify token works once');
  const reuseVerifyRes = await request('/api/auth/verify-email', {
    method: 'POST',
    body: { token: rawVerifyToken },
  });
  assert(reuseVerifyRes.status === 400, 'reused verify token fails');

  // - Email-change token works once:
  const { rawToken: rawChangeToken } = await createToken({
    type: 'email-change',
    userId: userForReset._id,
    email: `new-email-${runId}@example.test`,
  });
  const changeRes = await request('/api/auth/confirm-email-change', {
    method: 'POST',
    body: { token: rawChangeToken },
  });
  assert(changeRes.status === 200, 'email-change token works once');
  const reuseChangeRes = await request('/api/auth/confirm-email-change', {
    method: 'POST',
    body: { token: rawChangeToken },
  });
  assert(reuseChangeRes.status === 400, 'reused email-change token fails');

  // 5. Expired or tampered tokens fail
  const { rawToken: expiredRawToken } = await createToken({
    type: 'reset',
    userId: userForReset._id,
    email: userForReset.email,
  });
  const expHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
  await Token.updateOne({ tokenHash: expHash }, { $set: { expiresAt: new Date(Date.now() - 60000) } });
  const expiredRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: expiredRawToken, password: `${password}Expired1` },
  });
  assert(expiredRes.status === 400, 'expired token fails');

  const tamperedRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: 'tampered-invalid-hex-token-string-999', password: `${password}Tamper1` },
  });
  assert(tamperedRes.status === 400, 'tampered token fails');

  // 6. Sessions revoked after reset
  const userForSessionReset = await directUser({
    name: 'Session Reset User',
    email: `sess-reset-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
  });
  const loginBeforeReset = await login(userForSessionReset.email);
  const cookiesBeforeReset = extractCookies(loginBeforeReset.headers);
  assert(
    (await request('/api/auth/me', { cookie: cookiesBeforeReset.headerString })).status === 200,
    'session active before reset'
  );

  const { rawToken: resetSessToken } = await createToken({
    type: 'reset',
    userId: userForSessionReset._id,
    email: userForSessionReset.email,
  });
  const resetPassRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: resetSessToken, password: `${password}ResetPass1` },
  });
  assert(resetPassRes.status === 200, 'password reset succeeded');

  const postResetMeCheck = await request('/api/auth/me', { cookie: cookiesBeforeReset.headerString });
  assert(postResetMeCheck.status === 401, 'sessions revoked after reset');

  // 7. Unverified users cannot create posters (setting)
  const unverifiedUser = await directUser({
    name: 'Unverified Creator',
    email: `unverified-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
    isActive: true,
  });
  await User.updateOne({ _id: unverifiedUser._id }, { $set: { isEmailVerified: false } });
  const unverifiedLogin = await login(unverifiedUser.email);
  const unverifiedToken = unverifiedLogin.body.data.token;

  await Client.updateOne({ _id: clientA._id }, { $set: { requireEmailVerification: true } });
  const sampleTemplate = await Template.findOne({ clientId: clientA._id });
  const blockedPosterCreate = await request('/api/posters', {
    method: 'POST',
    token: unverifiedToken,
    body: {
      templateId: sampleTemplate._id.toString(),
      prompt: 'Blood donation camp',
      content: { title: 'Blood Donation' },
    },
  });
  assert(blockedPosterCreate.status === 403, 'unverified users cannot create posters when setting enabled');

  await Client.updateOne({ _id: clientA._id }, { $set: { requireEmailVerification: false } });

  // -------------------------------------------------------------
  // AUTH 3: AUTHORIZATION & PERMISSIONS
  // -------------------------------------------------------------
  console.log('\n--- Running AUTH 3 Authorization Tests ---');

  // 1. Startup verification: every registered route has an authorization policy
  const registeredRoutes = assertAllRoutesHavePolicy(app);
  assert(registeredRoutes.length > 0, 'every registered route has an authorization policy');

  // 2. Permission matrix generation from policy
  const matrix = generatePermissionMatrix();
  assert(matrix.length > 0, 'permission matrix generated successfully');
  assert(
    matrix.every((row) => row.superadmin && row.clientadmin && row.user && row.anonymous),
    'permission matrix covers all four actor states'
  );

  // 3. GET /api/auth/me returns permissions array reflecting user role
  await User.updateOne({ email: emails.userA }, { $set: { isActive: true } });
  const superLoginRes = await login(emails.superadmin);
  const superTokenAuth3 = superLoginRes.body.data.token;
  const superMe = await request('/api/auth/me', { token: superTokenAuth3 });
  assert(superMe.status === 200, 'superadmin can request /api/auth/me');
  assert(Array.isArray(superMe.body.data?.permissions), 'superadmin has permissions list');
  assert(superMe.body.data.permissions.includes('clients:manage'), 'superadmin permissions include clients:manage');
  assert(superMe.body.data.permissions.includes('users:invite'), 'superadmin permissions include users:invite');

  const adminALoginRes = await login(emails.adminA);
  const adminTokenAuth3 = adminALoginRes.body.data.token;
  const adminMe = await request('/api/auth/me', { token: adminTokenAuth3 });
  assert(adminMe.status === 200, 'clientadmin can request /api/auth/me');
  assert(Array.isArray(adminMe.body.data?.permissions), 'clientadmin has permissions list');
  assert(adminMe.body.data.permissions.includes('brandkit:write'), 'clientadmin permissions include brandkit:write');
  assert(adminMe.body.data.permissions.includes('templates:write'), 'clientadmin permissions include templates:write');
  assert(!adminMe.body.data.permissions.includes('clients:manage'), 'clientadmin cannot have clients:manage');

  const userLoginRes = await login(emails.userA);
  const userTokenAuth3 = userLoginRes.body.data.token;
  const userMe = await request('/api/auth/me', { token: userTokenAuth3 });
  assert(userMe.status === 200, 'user can request /api/auth/me');
  assert(Array.isArray(userMe.body.data?.permissions), 'user has permissions list');
  assert(userMe.body.data.permissions.includes('posters:create'), 'user permissions include posters:create');
  assert(!userMe.body.data.permissions.includes('brandkit:write'), 'user cannot have brandkit:write');
  assert(!userMe.body.data.permissions.includes('users:read'), 'user cannot have users:read');
  assert(!userMe.body.data.permissions.includes('clients:manage'), 'user cannot have clients:manage');

  // 4. Route policy responses for each role
  // 4a. Anonymous requests (401 on protected, 200 on public)
  const anonHealth = await request('/api/health');
  assert(anonHealth.status === 200, 'public route allows anonymous (200)');
  const anonBrandKit = await request('/api/brand-kit');
  assert(anonBrandKit.status === 401, 'protected route denies anonymous (401)');
  const anonUsers = await request('/api/users');
  assert(anonUsers.status === 401, 'admin route denies anonymous (401)');
  const anonClients = await request('/api/clients');
  assert(anonClients.status === 401, 'superadmin route denies anonymous (401)');

  // 4b. Regular User requests (403 on admin/superadmin, 200 on user permitted)
  const userBrandKit = await request('/api/brand-kit', { token: userTokenAuth3 });
  assert(userBrandKit.status === 200, 'user has brandkit:read (200)');
  const userBrandKitWrite = await request('/api/brand-kit', {
    method: 'PUT',
    token: userTokenAuth3,
    body: { orgName: 'Hacked Org' },
  });
  assert(userBrandKitWrite.status === 403, 'user denied brandkit:write (403)');
  const userUsersRead = await request('/api/users', { token: userTokenAuth3 });
  assert(userUsersRead.status === 403, 'user denied users:read (403)');
  const userTemplatesWrite = await request('/api/templates', {
    method: 'POST',
    token: userTokenAuth3,
    body: getDefaultTemplateData(clientA._id, 'Hacked Template'),
  });
  assert(userTemplatesWrite.status === 403, 'user denied templates:write (403)');
  const userClientsManage = await request('/api/clients', { token: userTokenAuth3 });
  assert(userClientsManage.status === 403, 'user denied clients:manage (403)');

  // 4c. Client Admin requests (200 on admin permitted, 403 on superadmin only)
  const adminUsersRead = await request('/api/users', { token: adminTokenAuth3 });
  assert(adminUsersRead.status === 200, 'clientadmin has users:read (200)');
  const adminClientsManage = await request('/api/clients', { token: adminTokenAuth3 });
  assert(adminClientsManage.status === 403, 'clientadmin denied clients:manage (403)');

  // 4d. Superadmin requests
  const superClientsManage = await request('/api/clients', { token: superTokenAuth3 });
  assert(superClientsManage.status === 200, 'superadmin has clients:manage (200)');

  // 5. Privilege escalation attempts
  // 5a. Clientadmin attempts to invite a superadmin -> 403
  const inviteSuperRes = await request('/api/users/invite', {
    method: 'POST',
    token: adminTokenAuth3,
    body: { email: `super-escalate-${runId}@example.test`, role: 'superadmin' },
  });
  assert(inviteSuperRes.status === 403, 'clientadmin cannot invite superadmin (403)');

  // 5b. Clientadmin attempts to create a superadmin -> 403
  const createSuperRes = await request('/api/users', {
    method: 'POST',
    token: adminTokenAuth3,
    body: {
      name: 'Fake Super',
      email: `super-create-${runId}@example.test`,
      role: 'superadmin',
      password: `${password}Esc1`,
    },
  });
  assert(createSuperRes.status === 403, 'clientadmin cannot create superadmin (403)');

  // 5c. User attempts to invite or create users -> 403
  const userInviteRes = await request('/api/users/invite', {
    method: 'POST',
    token: userTokenAuth3,
    body: { email: `user-inv-${runId}@example.test`, role: 'user' },
  });
  assert(userInviteRes.status === 403, 'user cannot invite users (403)');
  const userCreateRes = await request('/api/users', {
    method: 'POST',
    token: userTokenAuth3,
    body: {
      name: 'User Escalate',
      email: `user-cre-${runId}@example.test`,
      role: 'user',
      password: `${password}User1`,
    },
  });
  assert(userCreateRes.status === 403, 'user cannot create users (403)');

  // 5d. Clientadmin attempts to deactivate own account -> 400
  const deactSelfRes = await request(`/api/users/${adminA._id}`, {
    method: 'DELETE',
    token: adminTokenAuth3,
  });
  assert(deactSelfRes.status === 400, 'clientadmin cannot deactivate own account (400)');

  // 5e. Superadmin attempts to demote last active clientadmin -> 400
  const demoteLastAdminRes = await request(`/api/users/${adminA._id}`, {
    method: 'PATCH',
    token: superTokenAuth3,
    body: { role: 'user' },
  });
  assert(demoteLastAdminRes.status === 400, 'last active clientadmin cannot be demoted (400)');

  // 5f. Superadmin attempts to deactivate last active clientadmin -> 400
  const deactLastAdminRes = await request(`/api/users/${adminA._id}`, {
    method: 'DELETE',
    token: superTokenAuth3,
  });
  assert(deactLastAdminRes.status === 400, 'last active clientadmin cannot be deactivated (400)');

  // 6. Tenant isolation: cross-tenant access returns 404
  const templateB = await Template.findOne({ clientId: clientB._id });
  assert(templateB, 'template for clientB exists');
  const crossTenantTemplate = await request(`/api/templates/${templateB._id}`, {
    token: adminTokenAuth3,
  });
  assert(crossTenantTemplate.status === 404, 'another tenant template returns 404');

  const crossTenantClient = await request(`/api/clients/${clientB._id}`, {
    token: adminTokenAuth3,
  });
  assert(crossTenantClient.status === 404, 'another tenant client record returns 404');

  // 7. Pure can(user, permission, resource) validation
  assert(
    can({ role: 'user', clientId: clientA._id, _id: 'u1' }, 'posters:read:own', {
      clientId: clientA._id,
      createdBy: 'u1',
    }) === true,
    'can() allows user to read own resource in tenant'
  );
  assert(
    can({ role: 'user', clientId: clientA._id, _id: 'u1' }, 'posters:read:own', {
      clientId: clientA._id,
      createdBy: 'u2',
    }) === false,
    'can() denies user reading another user own-resource'
  );
  assert(
    can({ role: 'user', clientId: clientA._id, _id: 'u1' }, 'posters:read:own', {
      clientId: clientB._id,
      createdBy: 'u1',
    }) === false,
    'can() denies user accessing own-resource in different tenant'
  );
  assert(
    can({ role: 'clientadmin', clientId: clientA._id }, 'templates:write', { clientId: clientA._id }) === true,
    'can() allows clientadmin writing in own tenant'
  );
  assert(
    can({ role: 'clientadmin', clientId: clientA._id }, 'templates:write', { clientId: clientB._id }) === false,
    'can() denies clientadmin writing in different tenant'
  );
  assert(
    can({ role: 'superadmin' }, 'templates:write', { clientId: clientB._id }) === true,
    'can() allows superadmin writing in any tenant'
  );

  // -------------------------------------------------------------
  // AUTH 4: AUDIT LOGGING & SECURITY TRAIL
  // -------------------------------------------------------------
  console.log('\n--- Running AUTH 4 Audit Tests ---');

  // 1. brandkit.update audit
  const brandKitUpdateRes = await request('/api/brand-kit', {
    method: 'PUT',
    token: adminTokenAuth3,
    body: { orgName: `Updated Auth A ${runId}` },
  });
  assert(brandKitUpdateRes.status === 200, 'brandkit update succeeds');

  // 2. template.create, update, delete audit
  const tplCreateRes = await request('/api/templates', {
    method: 'POST',
    token: adminTokenAuth3,
    body: { name: `Audit Template ${runId}` },
  });
  assert(tplCreateRes.status === 201, 'template create succeeds');
  const auditTplId = tplCreateRes.body.data.template._id;

  const tplUpdateRes = await request(`/api/templates/${auditTplId}`, {
    method: 'PATCH',
    token: adminTokenAuth3,
    body: { name: `Audit Template Updated ${runId}` },
  });
  assert(tplUpdateRes.status === 200, 'template update succeeds');

  await request(`/api/templates/${auditTplId}/deactivate`, {
    method: 'POST',
    token: adminTokenAuth3,
  });
  const tplDeleteRes = await request(`/api/templates/${auditTplId}`, {
    method: 'DELETE',
    token: adminTokenAuth3,
  });
  assert(tplDeleteRes.status === 200, 'template delete succeeds');

  // 3. Password change audit
  const pwUser = await directUser({
    name: `PW User ${runId}`,
    email: `auth-pw-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
  });
  const pwLogin = await login(pwUser.email);
  const changePassRes = await request('/api/auth/change-password', {
    method: 'POST',
    token: pwLogin.body.data.token,
    body: {
      currentPassword: password,
      newPassword: `${password}New9`,
    },
  });
  assert(changePassRes.status === 200, 'password change succeeds');

  // Trigger role change & deactivate
  const roleChangeUser = await directUser({
    name: `Role User ${runId}`,
    email: `auth-role-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
  });
  const promoteRes = await request(`/api/users/${roleChangeUser._id}`, {
    method: 'PATCH',
    token: superTokenAuth3,
    body: { role: 'clientadmin' },
  });
  assert(promoteRes.status === 200, 'superadmin can change user role');

  const deactRes = await request(`/api/users/${roleChangeUser._id}`, {
    method: 'DELETE',
    token: superTokenAuth3,
  });
  assert(deactRes.status === 200, 'user deactivation succeeds');

  // 4. Repeated permission denials trigger auth.permission_denied audit
  for (let i = 0; i < 3; i++) {
    await request('/api/clients', {
      token: adminTokenAuth3,
    });
  }
  await new Promise((r) => setTimeout(r, 200));

  // 5. Verify events written for each action
  const actionsToCheck = [
    'auth.login',
    'auth.logout',
    'auth.token_reuse',
    'auth.password_change',
    'auth.password_reset',
    'user.invite',
    'user.accept_invite',
    'user.role_change',
    'user.deactivate',
    'brandkit.update',
    'template.create',
    'template.update',
    'template.delete',
    'auth.permission_denied',
  ];

  for (const act of actionsToCheck) {
    const exists = await AuditEvent.exists({ action: act });
    assert(Boolean(exists), `AuditEvent written for action: ${act}`);
  }

  // 5. No secrets in meta
  const allAuditEvents = await AuditEvent.find({ clientId: { $in: createdClientIds } }).lean();
  assert(allAuditEvents.length > 0, 'audit events exist for test clients');
  const secretKeyTerms = ['password', 'passwordhash', 'rawtoken', 'refreshtoken', 'accesstoken', 'secret'];
  for (const ev of allAuditEvents) {
    if (ev.meta) {
      for (const k of Object.keys(ev.meta)) {
        assert(
          !secretKeyTerms.includes(k.toLowerCase()),
          `meta key "${k}" in event ${ev._id} must not be a secret`
        );
      }
      const metaJson = JSON.stringify(ev.meta).toLowerCase();
      assert(!metaJson.includes('password123'), `meta in event ${ev._id} must not leak test passwords`);
      assert(!metaJson.includes(password.toLowerCase()), `meta in event ${ev._id} must not leak plain passwords`);
    }
  }

  // 6. Tenant isolation: another client's events invisible
  const clientBAdmin = await directUser({
    name: `Admin B Audit ${runId}`,
    email: `audit-b-${runId}@example.test`,
    role: 'clientadmin',
    clientId: clientB._id,
  });
  const clientBLogin = await login(clientBAdmin.email);
  const clientBToken = clientBLogin.body.data.token;

  const adminAAuditRes = await request('/api/audit', {
    token: adminTokenAuth3,
  });
  assert(adminAAuditRes.status === 200, 'admin A can read audit logs');
  const adminAEvents = adminAAuditRes.body.data.events;
  assert(adminAEvents.length > 0, 'admin A receives audit events');
  assert(
    adminAEvents.every((e) => String(e.clientId?._id || e.clientId) === String(clientA._id)),
    "admin A only sees client A's audit events (tenant isolation)"
  );
  assert(
    !adminAEvents.some((e) => String(e.clientId?._id || e.clientId) === String(clientB._id)),
    'client B events are completely invisible to client A'
  );

  // Superadmin can see all or filter by client
  const superAuditRes = await request('/api/audit', {
    token: superTokenAuth3,
  });
  assert(superAuditRes.status === 200, 'superadmin can read audit logs');
  const superAuditFiltered = await request(`/api/audit?clientId=${clientB._id}`, {
    token: superTokenAuth3,
  });
  assert(superAuditFiltered.status === 200, 'superadmin can filter audit logs by clientId');
  assert(
    superAuditFiltered.body.data.events.every((e) => String(e.clientId?._id || e.clientId) === String(clientB._id)),
    'superadmin filtered audit logs only contain client B'
  );

  // 7. Users get 403
  const userAuditRes = await request('/api/audit', {
    token: userTokenAuth3,
  });
  assert(userAuditRes.status === 403, 'standard user receives 403 on GET /api/audit');

  const userExportRes = await request('/api/audit/export', {
    token: userTokenAuth3,
  });
  assert(userExportRes.status === 403, 'standard user receives 403 on GET /api/audit/export');

  // 8. Append-only: mutating routes return 404
  const postAuditRes = await request('/api/audit', { method: 'POST', token: superTokenAuth3, body: {} });
  assert(postAuditRes.status === 404, 'POST /api/audit returns 404 (append-only)');

  const putAuditRes = await request('/api/audit', { method: 'PUT', token: superTokenAuth3, body: {} });
  assert(putAuditRes.status === 404, 'PUT /api/audit returns 404 (append-only)');

  const patchAuditRes = await request('/api/audit', { method: 'PATCH', token: superTokenAuth3, body: {} });
  assert(patchAuditRes.status === 404, 'PATCH /api/audit returns 404 (append-only)');

  const deleteAuditRes = await request('/api/audit', { method: 'DELETE', token: superTokenAuth3 });
  assert(deleteAuditRes.status === 404, 'DELETE /api/audit returns 404 (append-only)');

  const deleteSingleAuditRes = await request(`/api/audit/${allAuditEvents[0]._id}`, {
    method: 'DELETE',
    token: superTokenAuth3,
  });
  assert(deleteSingleAuditRes.status === 404, 'DELETE /api/audit/:id returns 404 (append-only)');

  // 9. CSV export
  const csvRes = await request('/api/audit/export', {
    token: adminTokenAuth3,
  });
  assert(csvRes.status === 200, 'CSV export returns 200');
  assert(
    csvRes.headers.get('content-type')?.includes('text/csv'),
    'CSV export returns text/csv header'
  );
  assert(
    csvRes.text.includes('Timestamp,Organization,Actor Name,Actor Email,Action,Result,Activity Description'),
    'CSV export contains correct header columns'
  );
  assert(
    csvRes.text.includes('signed in') || csvRes.text.includes('updated the brand kit'),
    'CSV export contains readable sentences'
  );

  // -------------------------------------------------------------
  // AUTH 5: MFA REMOVED - Direct login succeeds without MFA
  // -------------------------------------------------------------
  console.log('\n--- Running AUTH 5 MFA Removed Verification ---');
  const mfaUserEmail = `mfa-user-${runId}@example.test`;
  await directUser({
    name: 'MFA User',
    email: mfaUserEmail,
    role: 'user',
    clientId: clientA._id,
  });
  const mfaDirectLogin = await login(mfaUserEmail);
  assert(mfaDirectLogin.status === 200, 'direct login returns 200');
  assert(!mfaDirectLogin.body.data.mfaRequired, 'mfaRequired is not present on login');
  assert(Boolean(mfaDirectLogin.body.data.token), 'login returns token directly');

  // =========================================================================
  // AUTH 6: SECURITY UI & ORGANISATION SETTINGS TESTS
  // =========================================================================
  console.log('\n--- AUTH 6: Security UI & Organisation Settings ---');

  // 1. GET /api/auth/security
  const secUserRes = await login(emails.adminA);
  const secUserToken = secUserRes.body.data.token;
  const secCookie = extractCookies(secUserRes.headers).headerString;

  const securityInfoRes = await request('/api/auth/security', {
    token: secUserToken,
    cookie: secCookie,
  });
  assert(securityInfoRes.status === 200, 'GET /api/auth/security returns 200');
  assert(Array.isArray(securityInfoRes.body.data.sessions), 'security info contains sessions list');
  assert(Array.isArray(securityInfoRes.body.data.recentSignIns), 'security info contains recentSignIns list');
  assert(typeof securityInfoRes.body.data.mfaEnabled === 'boolean', 'security info contains mfaEnabled');
  const currentSession = securityInfoRes.body.data.sessions.find((s) => s.isCurrent);
  assert(Boolean(currentSession), 'current session has isCurrent: true badge');

  // 2. Individual session revocation: DELETE /api/auth/sessions/:id
  // Create another session for the same user
  const secondSessionRes = await login(emails.adminA);
  const secondCookie = extractCookies(secondSessionRes.headers).headerString;
  const secondSecInfo = await request('/api/auth/security', {
    cookie: secondCookie,
  });
  assert(secondSecInfo.body.data.sessions.length >= 2, 'user has at least two active sessions');
  const sessionToRevoke = secondSecInfo.body.data.sessions.find((s) => !s.isCurrent);
  assert(Boolean(sessionToRevoke), 'found non-current session to revoke');

  const revokeRes = await request(`/api/auth/sessions/${sessionToRevoke.id}`, {
    method: 'DELETE',
    cookie: secondCookie,
  });
  assert(revokeRes.status === 200, 'DELETE /api/auth/sessions/:id returns 200');

  // Verify revoked session is marked in DB
  const revokedDbSession = await Session.findById(sessionToRevoke.id);
  assert(Boolean(revokedDbSession.revokedAt), 'session revokedAt is set in database');

  // Verify auth.session_revoke audit event was logged
  const revokeAuditEvent = await AuditEvent.findOne({
    action: 'auth.session_revoke',
    targetId: sessionToRevoke.id,
  });
  assert(Boolean(revokeAuditEvent), 'auth.session_revoke audit event recorded');

  // 3. Organisation settings update via PATCH /api/clients/:id
  const orgSettingsRes = await request(`/api/clients/${clientA._id}`, {
    method: 'PATCH',
    token: adminTokenAuth3,
    body: {
      sessionLength: '8h',
      allowedEmailDomains: ['allowed-domain.org'],
      minPasswordLength: 12,
      requireMfaForAdmins: true,
      requireApprovalForPosters: true,
    },
  });
  assert(orgSettingsRes.status === 200, 'PATCH /api/clients/:id updates security settings');
  const clientData = orgSettingsRes.body.data.client || orgSettingsRes.body.data;
  assert(clientData.sessionLength === '8h', 'sessionLength updated to 8h');
  assert(clientData.minPasswordLength === 12, 'minPasswordLength updated to 12');
  assert(clientData.requireMfaForAdmins === true, 'requireMfaForAdmins updated to true');

  // Verify client.settings_update audit event was logged
  const orgAuditEvent = await AuditEvent.findOne({
    action: 'client.settings_update',
    clientId: clientA._id,
  });
  assert(Boolean(orgAuditEvent), 'client.settings_update audit event recorded');

  // 4. Invite user with non-allowed domain is rejected
  const rejectedInvite = await request('/api/users/invite', {
    method: 'POST',
    token: adminTokenAuth3,
    body: {
      email: `unapproved@randomdomain.com`,
      role: 'user',
    },
  });
  assert(rejectedInvite.status === 400, 'invite with unapproved email domain returns 400');
  assert(
    String(rejectedInvite.body.error?.message || '').toLowerCase().includes('domain'),
    'error message mentions domain requirement'
  );

  // Invite user with allowed domain succeeds
  const allowedInvite = await request('/api/users/invite', {
    method: 'POST',
    token: adminTokenAuth3,
    body: {
      email: `valid-invite-${runId}@allowed-domain.org`,
      role: 'user',
    },
  });
  assert(allowedInvite.status === 201 || allowedInvite.status === 200, 'invite with allowed email domain succeeds');

  // 5. Password length enforcement: change password with < minPasswordLength (12) fails
  const shortPwRes = await request('/api/auth/change-password', {
    method: 'POST',
    token: adminTokenAuth3,
    body: {
      currentPassword: password,
      newPassword: 'short10pass', // 10 chars, less than client min 12
    },
  });
  assert(shortPwRes.status === 400, 'password change below minimum length returns 400');
  assert(
    String(shortPwRes.body.error?.message || '').includes('12'),
    'error message reflects client minPasswordLength'
  );

  // 6. Admin Password Reset RBAC isolation:
  const adminAUser = await User.findOne({ email: emails.adminA });
  const peerAdminA = await directUser({
    name: `Peer Admin A ${runId}`,
    email: `auth-peer-admin-${runId}@example.test`,
    role: 'clientadmin',
    clientId: clientA._id,
  });
  const normalUserA = await directUser({
    name: `Normal User A ${runId}`,
    email: `auth-normal-user-${runId}@example.test`,
    role: 'user',
    clientId: clientA._id,
  });

  const peerResetRes = await request(`/api/users/${peerAdminA._id}/reset-password`, {
    method: 'POST',
    token: adminTokenAuth3,
  });
  assert(peerResetRes.status === 403, 'clientadmin cannot reset peer clientadmin password (403)');

  const selfResetRes = await request(`/api/users/${adminAUser._id}/reset-password`, {
    method: 'POST',
    token: adminTokenAuth3,
  });
  assert(selfResetRes.status === 400, 'clientadmin cannot reset own password via admin reset (400)');

  const userResetRes = await request(`/api/users/${normalUserA._id}/reset-password`, {
    method: 'POST',
    token: adminTokenAuth3,
  });
  assert(userResetRes.status === 200, 'clientadmin can reset standard user password (200)');
  assert(Boolean(userResetRes.body.data?.temporaryPassword), 'reset returns temporaryPassword');

  const superResetPeerRes = await request(`/api/users/${peerAdminA._id}/reset-password`, {
    method: 'POST',
    token: superTokenAuth3,
  });
  assert(superResetPeerRes.status === 200, 'superadmin can reset clientadmin password (200)');
  assert(Boolean(superResetPeerRes.body.data?.temporaryPassword), 'superadmin reset returns temporaryPassword');
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
