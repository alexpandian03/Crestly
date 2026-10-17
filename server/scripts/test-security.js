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
import LoginAttempt from '../models/LoginAttempt.model.js';
import RateCounter from '../models/RateCounter.model.js';
import AuditEvent from '../models/AuditEvent.model.js';
import { sanitizeRedirect } from '../../shared/redirect.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Security tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `SecPass${crypto.randomBytes(6).toString('hex')}9!`;

const emails = {
  superadmin: `sec-super-${runId}@example.test`,
  adminA: `sec-admin-a-${runId}@example.test`,
  userA: `sec-user-a-${runId}@example.test`,
  userB: `sec-user-b-${runId}@example.test`,
  bruteTarget: `sec-brute-${runId}@example.test`,
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

async function login(email, candidate = password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password: candidate } });
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

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    const testUsers = await User.find({ email: { $in: Object.values(emails) } }).select('_id');
    const userIds = testUsers.map((u) => u._id);
    await Promise.all([
      Session.deleteMany({ userId: { $in: userIds } }),
      Token.deleteMany({
        $or: [{ email: { $in: Object.values(emails) } }, { userId: { $in: userIds } }],
      }),
      User.deleteMany({ email: { $in: Object.values(emails) } }),
      LoginAttempt.deleteMany({ email: { $in: Object.values(emails) } }),
      Poster.deleteMany({ clientId: { $in: createdClientIds } }),
      Asset.deleteMany({ clientId: { $in: createdClientIds } }),
      BrandKit.deleteMany({ clientId: { $in: createdClientIds } }),
      Template.deleteMany({ clientId: { $in: createdClientIds } }),
      Client.deleteMany({ _id: { $in: createdClientIds } }),
      AuditEvent.deleteMany({ clientId: { $in: createdClientIds } }),
    ]);
    await mongoose.connection.close();
  }
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for security tests.');
  await connectDB();

  console.log('--- AUTH 7: Automated Security Tests ---');

  // Setup Tenants & Users
  const [clientA, clientB] = await Client.create([
    { name: `Security A ${runId}`, plan: 'starter', isActive: true },
    { name: `Security B ${runId}`, plan: 'starter', isActive: true },
  ]);
  createdClientIds.push(clientA._id, clientB._id);

  await BrandKit.create([
    { clientId: clientA._id, orgName: `Brand A ${runId}` },
    { clientId: clientB._id, orgName: `Brand B ${runId}` },
  ]);

  const [tplA, tplB] = await Template.create([
    getDefaultTemplateData(clientA._id, `Tpl A ${runId}`),
    getDefaultTemplateData(clientB._id, `Tpl B ${runId}`),
  ]);

  const superAdmin = await directUser({ name: 'Superadmin', email: emails.superadmin, role: 'superadmin' });
  const adminA = await directUser({ name: 'Admin A', email: emails.adminA, role: 'clientadmin', clientId: clientA._id });
  const userA = await directUser({ name: 'User A', email: emails.userA, role: 'user', clientId: clientA._id });
  const userB = await directUser({ name: 'User B', email: emails.userB, role: 'user', clientId: clientB._id });

  const posterA = await Poster.create({
    clientId: clientA._id,
    userId: userA._id,
    templateId: tplA._id,
    title: `Poster Alpha ${runId}`,
    prompt: 'Promotional announcement poster',
    content: { title: `Poster Alpha ${runId}` },
    status: 'draft',
    currentVersion: 1,
    versions: [{ versionNumber: 1, content: { title: `Poster Alpha ${runId}` }, createdBy: userA._id }],
  });

  const assetB = await Asset.create({
    clientId: clientB._id,
    name: 'Confidential Asset B',
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    folder: `posters/${clientB._id}`,
    format: 'jpg',
    bytes: 2048,
    width: 600,
    height: 400,
    createdBy: userB._id,
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Log in users
  const superLogin = await login(emails.superadmin);
  const tokenSuper = superLogin.body.data.token;

  const adminALogin = await login(emails.adminA);
  const tokenAdminA = adminALogin.body.data.token;
  const cookieAdminA = extractCookies(adminALogin.headers).headerString;

  const userALogin = await login(emails.userA);
  const tokenUserA = userALogin.body.data.token;
  const cookieUserA = extractCookies(userALogin.headers).headerString;

  const userBLogin = await login(emails.userB);
  const tokenUserB = userBLogin.body.data.token;

  // 1. Token replay after logout
  console.log('\n1. Token Replay after Logout');
  const tempUser = await directUser({ name: 'Temp', email: `temp-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const tempLogin = await login(tempUser.email);
  const tempToken = tempLogin.body.data.token;
  const tempCookie = extractCookies(tempLogin.headers).headerString;

  const preLogout = await request('/api/auth/me', { token: tempToken, cookie: tempCookie });
  assert(preLogout.status === 200, 'active session can access /api/auth/me');

  const logoutRes = await request('/api/auth/logout', { method: 'POST', token: tempToken, cookie: tempCookie });
  assert(logoutRes.status === 200, 'logout succeeds');

  const postLogout = await request('/api/auth/me', { token: tempToken, cookie: tempCookie });
  assert(postLogout.status === 401, 'token replay after logout fails with 401');

  // 2. Refresh reuse
  console.log('\n2. Refresh Token Reuse & Family Revocation');
  const rLogin = await login(emails.userA);
  const initialCookies = extractCookies(rLogin.headers);
  const stolenRefreshToken = initialCookies.cookies.refreshToken;

  const rotateRes = await request('/api/auth/refresh', { method: 'POST', cookie: initialCookies.headerString });
  assert(rotateRes.status === 200, 'legitimate refresh rotates token');
  const rotatedCookies = extractCookies(rotateRes.headers);
  const newRefreshToken = rotatedCookies.cookies.refreshToken;
  assert(Boolean(newRefreshToken) && newRefreshToken !== stolenRefreshToken, 'new refresh token returned');

  const reuseRes = await request('/api/auth/refresh', { method: 'POST', cookie: `refreshToken=${stolenRefreshToken}` });
  assert(reuseRes.status === 401, 'reusing old refresh token fails with 401');

  const subsequentRes = await request('/api/auth/refresh', { method: 'POST', cookie: `refreshToken=${newRefreshToken}` });
  assert(subsequentRes.status === 401, 'entire session family is revoked after reuse');

  // 3. Session fixation
  console.log('\n3. Session Fixation Prevention');
  const fixLogin1 = await login(emails.userA);
  const fixCookies1 = extractCookies(fixLogin1.headers);
  const fixLogin2 = await login(emails.userA);
  const fixCookies2 = extractCookies(fixLogin2.headers);
  assert(
    fixCookies1.cookies.refreshToken !== fixCookies2.cookies.refreshToken,
    'consecutive logins issue distinct refresh tokens'
  );
  assert(fixLogin1.body.data.token !== fixLogin2.body.data.token, 'consecutive logins issue distinct access tokens');

  // 4. Missing CSRF header
  console.log('\n4. CSRF Protection');
  const noCsrfRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieUserA },
  });
  assert(noCsrfRes.status === 403, 'missing CSRF header returns 403');

  const badOriginRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      origin: 'https://evil-attacker.com',
      cookie: cookieUserA,
    },
  });
  assert(badOriginRes.status === 403, 'disallowed Origin returns 403');

  const safeGetRes = await request('/api/auth/me', { token: tokenUserA });
  assert(safeGetRes.status === 200, 'safe GET requests do not require CSRF header');

  // 5. IDOR across tenants
  console.log('\n5. IDOR Isolation across Tenants');
  const getOtherPoster = await request(`/api/posters/${posterA._id}`, { token: tokenUserB });
  assert(getOtherPoster.status === 404, 'IDOR: getting another tenant poster returns 404');

  const patchOtherPoster = await request(`/api/posters/${posterA._id}`, {
    method: 'PATCH',
    token: tokenUserB,
    body: { content: { title: 'Hacked' }, expectedVersion: 1 },
  });
  assert(patchOtherPoster.status === 404, 'IDOR: patching another tenant poster returns 404');

  const delOtherPoster = await request(`/api/posters/${posterA._id}`, { method: 'DELETE', token: tokenUserB });
  assert(delOtherPoster.status === 404, 'IDOR: deleting another tenant poster returns 404');

  const getOtherTpl = await request(`/api/templates/${tplB._id}`, { token: tokenUserA });
  assert(getOtherTpl.status === 404, 'IDOR: getting another tenant template returns 404');

  const patchOtherTpl = await request(`/api/templates/${tplB._id}`, {
    method: 'PATCH',
    token: tokenAdminA,
    body: { name: 'Hacked Template' },
  });
  assert(patchOtherTpl.status === 404, 'IDOR: patching another tenant template returns 404');

  const delOtherTpl = await request(`/api/templates/${tplB._id}`, { method: 'DELETE', token: tokenAdminA });
  assert(delOtherTpl.status === 404, 'IDOR: deleting another tenant template returns 404');

  const listAssets = await request('/api/assets', { token: tokenAdminA });
  const assetIds = (listAssets.body.data?.assets || []).map((a) => a._id);
  assert(!assetIds.includes(assetB._id.toString()), "IDOR: Tenant B's asset is not visible in Tenant A list");

  const delOtherAsset = await request(`/api/assets/${assetB._id}`, { method: 'DELETE', token: tokenAdminA });
  assert([403, 404].includes(delOtherAsset.status), 'IDOR: deleting another tenant asset is rejected');

  const getOtherUser = await request(`/api/users/${userB._id}`, { token: tokenAdminA });
  assert([403, 404].includes(getOtherUser.status), 'IDOR: accessing another tenant user returns 403 or 404');

  // 6. Role escalation through invites and role edits
  console.log('\n6. Role Escalation Prevention');
  const escalateInvite = await request('/api/users/invite', {
    method: 'POST',
    token: tokenAdminA,
    body: { email: `esc-${runId}@example.test`, role: 'superadmin' },
  });
  assert(escalateInvite.status === 403, 'clientadmin cannot invite a superadmin (403)');

  const userInvite = await request('/api/users/invite', {
    method: 'POST',
    token: tokenUserA,
    body: { email: `esc2-${runId}@example.test`, role: 'user' },
  });
  assert(userInvite.status === 403, 'plain user cannot send invites (403)');

  const promoteRes = await request(`/api/users/${userA._id}`, {
    method: 'PATCH',
    token: tokenAdminA,
    body: { role: 'superadmin' },
  });
  assert([400, 403].includes(promoteRes.status), 'clientadmin promoting to superadmin is rejected');

  const selfDemoteRes = await request(`/api/users/${adminA._id}`, {
    method: 'PATCH',
    token: tokenAdminA,
    body: { isActive: false },
  });
  assert(selfDemoteRes.status === 400, 'clientadmin deactivating own account returns 400');

  const lastAdminRes = await request(`/api/users/${adminA._id}`, {
    method: 'PATCH',
    token: tokenSuper,
    body: { isActive: false },
  });
  assert(lastAdminRes.status === 400, 'deactivating the last active clientadmin returns 400');

  // 7. Brute force and rate limiter
  console.log('\n7. Brute Force Protection & Limiter');
  const bruteEmail = emails.bruteTarget;
  const bruteIp = '198.51.100.22';
  await LoginAttempt.deleteMany({ email: bruteEmail });

  for (let i = 0; i < 5; i++) {
    const failed = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': bruteIp },
      body: { email: bruteEmail, password: 'WrongPassword99!' },
    });
    assert(failed.status === 401, `failed attempt ${i + 1} returns 401`);
  }
  const throttled = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': bruteIp },
    body: { email: bruteEmail, password: 'WrongPassword99!' },
  });
  assert(throttled.status === 429, '6th failed attempt triggers 429 rate limiter');

  // 8. Account enumeration on login, reset and invite
  console.log('\n8. Account Enumeration Prevention');
  const enumLoginUnknown = await login('totally-unknown@example.test', 'BadPass123!');
  const enumLoginKnown = await login(emails.userA, 'BadPass123!');
  assert(enumLoginUnknown.status === 401, 'unknown email login returns 401');
  assert(enumLoginKnown.status === 401, 'known email login returns 401');
  assert(
    enumLoginUnknown.body.error?.message === enumLoginKnown.body.error?.message,
    'login error message identical for known and unknown accounts'
  );

  const enumResetUnknown = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'unknown-reset@example.test' },
  });
  const enumResetKnown = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: emails.userA },
  });
  assert(enumResetUnknown.status === 200, 'unknown reset returns 200');
  assert(enumResetKnown.status === 200, 'known reset returns 200');
  assert(
    enumResetUnknown.body.data?.message === enumResetKnown.body.data?.message,
    'password reset message identical for known and unknown accounts'
  );

  const enumInviteProbe = await request('/api/users/invite', {
    method: 'POST',
    body: { email: emails.userA, role: 'user' },
  });
  assert(enumInviteProbe.status === 401, 'unauthorized invite probe blocked with 401');

  // 9. Open redirect in the login "next" parameter
  console.log('\n9. Open Redirect Prevention (Same-origin paths only)');
  assert(sanitizeRedirect('https://evil.com', '/fallback') === '/fallback', 'blocks absolute https:// URL');
  assert(sanitizeRedirect('http://evil.com', '/fallback') === '/fallback', 'blocks absolute http:// URL');
  assert(sanitizeRedirect('//evil.com', '/fallback') === '/fallback', 'blocks protocol-relative // URL');
  assert(sanitizeRedirect('/\\evil.com', '/fallback') === '/fallback', 'blocks backslash bypass /\\');
  assert(sanitizeRedirect('\\evil.com', '/fallback') === '/fallback', 'blocks leading backslash \\');
  assert(sanitizeRedirect('javascript:alert(1)', '/fallback') === '/fallback', 'blocks javascript: URI');
  assert(sanitizeRedirect('/login', '/fallback') === '/fallback', 'blocks redirect loop to /login');
  assert(sanitizeRedirect('/posters', '/fallback') === '/posters', 'allows valid same-origin /posters');
  assert(sanitizeRedirect('/create?mode=ai', '/fallback') === '/create?mode=ai', 'allows valid path with query');

  // 10. Mass assignment
  console.log('\n10. Mass Assignment Prevention');
  const massPoster = await request('/api/posters', {
    method: 'POST',
    token: tokenUserA,
    body: {
      templateId: tplA._id.toString(),
      clientId: clientB._id.toString(), // Attacker tries to inject client B
      prompt: 'Check mass assignment',
      content: { title: 'Safe Poster' },
    },
  });
  assert(massPoster.status === 201, 'poster creation succeeds');
  assert(
    String(massPoster.body.data.poster.clientId) === String(clientA._id),
    'injected clientId is ignored; poster created under caller tenant'
  );

  const massClient = await request(`/api/clients/${clientA._id}`, {
    method: 'PATCH',
    token: tokenAdminA,
    body: { plan: 'enterprise', isActive: false },
  });
  assert(massClient.status === 403, 'mass assignment of sensitive client fields rejected with 403');

  // 11. Over-large bodies
  console.log('\n11. Over-large Bodies');
  const hugeBody = 'X'.repeat(1024 * 1024 + 100);
  const largeRes = await request('/api/posters', {
    method: 'POST',
    token: tokenUserA,
    body: {
      templateId: tplA._id.toString(),
      prompt: hugeBody,
      content: { title: 'Big' },
    },
  });
  assert(largeRes.status === 413, 'over-large body (> 1MB) returns 413 Payload Too Large');

  // 12. Header checks (CSP, HSTS, no server banner)
  console.log('\n12. Header Checks');
  const healthRes = await request('/api/health');
  assert(!healthRes.headers.get('x-powered-by'), 'x-powered-by header is stripped (no server banner)');
  assert(Boolean(healthRes.headers.get('strict-transport-security')), 'strict-transport-security header is present');
  assert(Boolean(healthRes.headers.get('content-security-policy')), 'content-security-policy header is present');

  console.log('\n✅ All AUTH 7 security checks passed successfully.');
}

try {
  await run();
} catch (err) {
  console.error(`Security tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
