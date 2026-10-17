import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a_very_secret_jwt_key_that_is_at_least_32_chars_long';

import { connectDB } from '../../server/config/db.js';
import app from '../../server/app.js';
import User from '../../server/models/User.model.js';
import Client from '../../server/models/Client.model.js';
import BrandKit from '../../server/models/BrandKit.model.js';
import Template from '../../server/models/Template.model.js';
import Poster from '../../server/models/Poster.model.js';
import Session from '../../server/models/Session.model.js';
import Asset from '../../server/models/Asset.model.js';
import LoginAttempt from '../../server/models/LoginAttempt.model.js';
import { sanitizeRedirect } from '../../shared/redirect.js';

describe('AUTH 7: Security Automated Test Suite', () => {
  let mongod;
  let clientA;
  let clientB;
  let adminA;
  let userA;
  let userB;
  let templateA;
  let templateB;
  let posterA;
  let assetB;
  let tokenAdminA;
  let tokenUserA;
  let tokenUserB;
  let tokenSuperAdmin;
  let cookiesAdminA;
  let cookiesUserA;

  function parseCookies(res) {
    const raw = res.headers['set-cookie'] || [];
    const cookies = {};
    raw.forEach((header) => {
      const parts = header.split(';');
      const [name, val] = parts[0].split('=');
      if (name) cookies[name.trim()] = val ? val.trim() : '';
    });
    return {
      raw,
      cookies,
      cookieString: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    };
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await connectDB();

    // Setup 2 isolated clients
    clientA = await Client.create({ name: 'Security Client A', plan: 'starter', isActive: true });
    clientB = await Client.create({ name: 'Security Client B', plan: 'starter', isActive: true });

    await BrandKit.create({ clientId: clientA._id, orgName: 'Brand A' });
    await BrandKit.create({ clientId: clientB._id, orgName: 'Brand B' });

    const pw = 'SecurePassword123!';
    const hash = await User.hashPassword(pw);

    adminA = await User.create({
      name: 'Admin Alpha',
      email: 'admin-alpha@sec.test',
      passwordHash: hash,
      role: 'clientadmin',
      clientId: clientA._id,
      isActive: true,
    });

    userA = await User.create({
      name: 'User Alpha',
      email: 'user-alpha@sec.test',
      passwordHash: hash,
      role: 'user',
      clientId: clientA._id,
      isActive: true,
    });

    userB = await User.create({
      name: 'User Beta',
      email: 'user-beta@sec.test',
      passwordHash: hash,
      role: 'user',
      clientId: clientB._id,
      isActive: true,
    });

    // Create templates
    templateA = await Template.create({
      clientId: clientA._id,
      name: 'Template A',
      category: 'Event',
      isActive: true,
      editorVersion: 2,
      size: { width: 1080, height: 1350 },
      elements: [{ id: 'h1', kind: 'field', field: 'headline', text: 'Head', x: 0, y: 150, w: 1000, h: 100, style: { size: 40 } }],
      zones: [
        { id: 'zh', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 'zc', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
        { id: 'zf', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
      ],
    });

    templateB = await Template.create({
      clientId: clientB._id,
      name: 'Template B Private',
      category: 'Event',
      isActive: true,
      editorVersion: 2,
      size: { width: 1080, height: 1350 },
      elements: [{ id: 'h2', kind: 'field', field: 'headline', text: 'Head B', x: 0, y: 150, w: 1000, h: 100, style: { size: 40 } }],
      zones: [
        { id: 'zh', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 'zc', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
        { id: 'zf', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
      ],
    });

    // Create a poster for Tenant A
    posterA = await Poster.create({
      clientId: clientA._id,
      userId: userA._id,
      templateId: templateA._id,
      title: 'Poster Alpha',
      prompt: 'A test poster prompt for Alpha',
      content: { title: 'Poster Alpha' },
      status: 'draft',
      currentVersion: 1,
      versions: [{ versionNumber: 1, content: { title: 'Poster Alpha' }, createdBy: userA._id }],
    });

    // Create an asset for Tenant B
    assetB = await Asset.create({
      clientId: clientB._id,
      name: 'Secret Asset Beta',
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      folder: `posters/${clientB._id}`,
      format: 'jpg',
      bytes: 1234,
      width: 800,
      height: 600,
      createdBy: userB._id,
    });

    // Log in Admin A
    const resLoginAdminA = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'admin-alpha@sec.test', password: pw });
    tokenAdminA = resLoginAdminA.body.data.token;
    cookiesAdminA = parseCookies(resLoginAdminA);

    // Log in User A
    const resLoginUserA = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: pw });
    tokenUserA = resLoginUserA.body.data.token;
    cookiesUserA = parseCookies(resLoginUserA);

    // Log in User B
    const resLoginUserB = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-beta@sec.test', password: pw });
    tokenUserB = resLoginUserB.body.data.token;

    // Create & log in Superadmin
    await User.create({
      name: 'Super Admin',
      email: 'super@sec.test',
      passwordHash: hash,
      role: 'superadmin',
      isActive: true,
    });
    const resLoginSuper = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'super@sec.test', password: pw });
    tokenSuperAdmin = resLoginSuper.body.data.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (global.__mongoose) {
      global.__mongoose = { conn: null, promise: null };
    }
    if (mongod) await mongod.stop();
  });

  // -------------------------------------------------------------------------
  // 1. TOKEN REPLAY AFTER LOGOUT
  // -------------------------------------------------------------------------
  it('1. Token replay after logout fails (session revoked)', async () => {
    // Perform a fresh login to test logout
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: 'SecurePassword123!' });
    const replayToken = loginRes.body.data.token;
    const replayCookies = parseCookies(loginRes);

    // Verify token works before logout
    const preLogoutRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${replayToken}`)
      .set('Cookie', replayCookies.cookieString);
    expect(preLogoutRes.status).toBe(200);

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${replayToken}`)
      .set('Cookie', replayCookies.cookieString);
    expect(logoutRes.status).toBe(200);

    // Replay token / cookie after logout -> must be rejected with 401
    const postLogoutRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${replayToken}`)
      .set('Cookie', replayCookies.cookieString);
    expect(postLogoutRes.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 2. REFRESH REUSE DETECTION & FAMILY REVOCATION
  // -------------------------------------------------------------------------
  it('2. Refresh reuse revokes the token family and blocks legitimate user', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: 'SecurePassword123!' });
    const initialCookies = parseCookies(loginRes);
    const stolenRefreshToken = initialCookies.cookies.refreshToken;

    // Legitimate rotation
    const rotateRes = await request(app)
      .post('/api/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', initialCookies.cookieString);
    expect(rotateRes.status).toBe(200);
    const rotatedCookies = parseCookies(rotateRes);
    const newRefreshToken = rotatedCookies.cookies.refreshToken;
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(stolenRefreshToken);

    // Attacker tries to reuse old refresh token -> fails and revokes family
    const attackerRes = await request(app)
      .post('/api/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', `refreshToken=${stolenRefreshToken}`);
    expect(attackerRes.status).toBe(401);

    // Legitimate user now tries their rotated token -> fails because family was revoked
    const legitSubsequentRes = await request(app)
      .post('/api/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', `refreshToken=${newRefreshToken}`);
    expect(legitSubsequentRes.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 3. SESSION FIXATION
  // -------------------------------------------------------------------------
  it('3. Session fixation: login generates fresh session and rotates tokens', async () => {
    // 1st login
    const login1 = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: 'SecurePassword123!' });
    const session1 = parseCookies(login1);

    // 2nd login creates a separate independent session with different refresh token
    const login2 = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: 'SecurePassword123!' });
    const session2 = parseCookies(login2);

    expect(session1.cookies.refreshToken).not.toBe(session2.cookies.refreshToken);
    expect(login1.body.data.token).not.toBe(login2.body.data.token);
  });

  // -------------------------------------------------------------------------
  // 4. MISSING CSRF HEADER
  // -------------------------------------------------------------------------
  it('4. Missing CSRF header on state-changing requests returns 403', async () => {
    // Request without X-Requested-With and without Origin
    const noCsrfRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookiesUserA.cookieString)
      .send({});
    expect(noCsrfRes.status).toBe(403);
    expect(noCsrfRes.body.error.message).toMatch(/CSRF|Requested-With/i);

    // Disallowed origin returns 403
    const evilOriginRes = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.evil.com')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', cookiesUserA.cookieString)
      .send({});
    expect(evilOriginRes.status).toBe(403);

    // GET requests do not require CSRF header
    const getRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenUserA}`);
    expect(getRes.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 5. IDOR ACROSS TENANTS (Posters, Templates, Assets, Users)
  // -------------------------------------------------------------------------
  it("5a. IDOR - Tenant B cannot read, update, or delete Tenant A's poster", async () => {
    // GET
    const getRes = await request(app)
      .get(`/api/posters/${posterA._id}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    expect(getRes.status).toBe(404);

    // PATCH
    const patchRes = await request(app)
      .patch(`/api/posters/${posterA._id}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ content: { title: 'Hacked Title' }, expectedVersion: 1 });
    expect(patchRes.status).toBe(404);

    // DELETE
    const delRes = await request(app)
      .delete(`/api/posters/${posterA._id}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(delRes.status).toBe(404);
  });

  it("5b. IDOR - Tenant A cannot read, update, or delete Tenant B's private template", async () => {
    // GET
    const getRes = await request(app)
      .get(`/api/templates/${templateB._id}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    expect(getRes.status).toBe(404);

    // PATCH
    const patchRes = await request(app)
      .patch(`/api/templates/${templateB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Hacked Template' });
    expect(patchRes.status).toBe(404);

    // DELETE
    const delRes = await request(app)
      .delete(`/api/templates/${templateB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(delRes.status).toBe(404);
  });

  it("5c. IDOR - Tenant A cannot see or delete Tenant B's asset", async () => {
    // Listing assets only returns Tenant A assets
    const listRes = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(listRes.status).toBe(200);
    const ids = (listRes.body.data.assets || []).map((a) => a._id);
    expect(ids).not.toContain(assetB._id.toString());

    // Deleting Tenant B asset
    const delRes = await request(app)
      .delete(`/api/assets/${assetB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect([403, 404]).toContain(delRes.status);
  });

  it("5d. IDOR - Tenant A clientadmin cannot access Tenant B's user", async () => {
    const getRes = await request(app)
      .get(`/api/users/${userB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect([403, 404]).toContain(getRes.status);

    const patchRes = await request(app)
      .patch(`/api/users/${userB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Malicious Change' });
    expect([403, 404]).toContain(patchRes.status);
  });

  // -------------------------------------------------------------------------
  // 6. ROLE ESCALATION THROUGH INVITES AND ROLE EDITS
  // -------------------------------------------------------------------------
  it('6a. Role escalation: clientadmin cannot invite superadmin', async () => {
    const res = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: 'attacker-super@sec.test',
        role: 'superadmin',
      });
    expect(res.status).toBe(403);
  });

  it('6b. Role escalation: plain user cannot invite anyone', async () => {
    const res = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: 'invited@sec.test',
        role: 'user',
      });
    expect(res.status).toBe(403);
  });

  it('6c. Role escalation: clientadmin cannot promote anyone to superadmin', async () => {
    const res = await request(app)
      .patch(`/api/users/${userA._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ role: 'superadmin' });
    expect([400, 403]).toContain(res.status);
  });

  it('6d. Last clientadmin cannot be removed or demoted', async () => {
    // Clientadmin cannot deactivate self
    const selfDeact = await request(app)
      .patch(`/api/users/${adminA._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(selfDeact.status).toBe(400);
    expect(selfDeact.body.error.message).toMatch(/cannot deactivate your own account/i);

    // Superadmin attempting to deactivate the last clientadmin of Client A is blocked
    const superDemote = await request(app)
      .patch(`/api/users/${adminA._id}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ isActive: false });
    expect(superDemote.status).toBe(400);
    expect(superDemote.body.error.message).toMatch(/last active client administrator cannot be removed or demoted/i);
  });

  // -------------------------------------------------------------------------
  // 7. BRUTE FORCE AND THE LIMITER
  // -------------------------------------------------------------------------
  it('7. Brute force protection locks out repeated failed login attempts (429)', async () => {
    const bruteEmail = 'brute-target@sec.test';
    const ip = '192.0.2.45';

    // Clear any prior attempts for test isolation
    await LoginAttempt.deleteMany({ email: bruteEmail });

    // 5 attempts fail with 401
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('X-Forwarded-For', ip)
        .send({ email: bruteEmail, password: 'WrongPassword!' });
      expect(res.status).toBe(401);
    }

    // 6th attempt is throttled with 429
    const lockRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('X-Forwarded-For', ip)
      .send({ email: bruteEmail, password: 'WrongPassword!' });
    expect(lockRes.status).toBe(429);
    expect(lockRes.body.error.message).toMatch(/too many attempts/i);
  });

  // -------------------------------------------------------------------------
  // 8. ACCOUNT ENUMERATION ON LOGIN, RESET AND INVITE
  // -------------------------------------------------------------------------
  it('8a. Login returns identical 401 error for unknown and known emails', async () => {
    const unknownRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'nonexistent-user@sec.test', password: 'WrongPassword123!' });

    const knownRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', password: 'WrongPassword123!' });

    expect(unknownRes.status).toBe(401);
    expect(knownRes.status).toBe(401);
    expect(unknownRes.body.error.message).toBe(knownRes.body.error.message);
    expect(unknownRes.body.error.message).toBe('Invalid email or password');
  });

  it('8b. Forgot-password returns identical 200 message for unknown and known emails', async () => {
    const unknownRes = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'nonexistent-reset@sec.test' });

    const knownRes = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test' });

    expect(unknownRes.status).toBe(200);
    expect(knownRes.status).toBe(200);
    expect(unknownRes.body.data.message).toBe(knownRes.body.data.message);
  });

  it('8c. Unauthorized callers cannot enumerate accounts via invites', async () => {
    const probeRes = await request(app)
      .post('/api/users/invite')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user-alpha@sec.test', role: 'user' });
    expect(probeRes.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 9. OPEN REDIRECT IN LOGIN "NEXT" PARAMETER
  // -------------------------------------------------------------------------
  it('9. Open redirect prevention: only same-origin relative paths are allowed', () => {
    // Disallowed external schemes and domains
    expect(sanitizeRedirect('https://evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirect('http://evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirect('//evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirect('/\\evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirect('\\evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirect('javascript:alert(1)', '/default')).toBe('/default');
    expect(sanitizeRedirect('data:text/html,<script>alert(1)</script>', '/default')).toBe('/default');

    // Prevent redirect loops back to login
    expect(sanitizeRedirect('/login', '/default')).toBe('/default');
    expect(sanitizeRedirect('/login?next=/evil', '/default')).toBe('/default');

    // Allowed legitimate application paths
    expect(sanitizeRedirect('/posters', '/default')).toBe('/posters');
    expect(sanitizeRedirect('/create?template=event', '/default')).toBe('/create?template=event');
    expect(sanitizeRedirect('/templates/123/edit', '/default')).toBe('/templates/123/edit');
    expect(sanitizeRedirect('/brand-kit', '/default')).toBe('/brand-kit');
  });

  // -------------------------------------------------------------------------
  // 10. MASS ASSIGNMENT (extra fields ignored or rejected)
  // -------------------------------------------------------------------------
  it('10a. Mass assignment in poster creation ignores injected clientId', async () => {
    const res = await request(app)
      .post('/api/posters')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        templateId: templateA._id.toString(),
        clientId: clientB._id.toString(), // Attacker tries to inject client B ID
        prompt: 'Mass assignment check',
        content: { title: 'Safe Poster' },
      });

    expect(res.status).toBe(201);
    // Poster must belong to Client A, not Client B
    expect(res.body.data.poster.clientId.toString()).toBe(clientA._id.toString());
  });

  it('10b. Mass assignment in client settings rejects non-settings fields', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientA._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        plan: 'enterprise', // Clientadmin cannot change plan
        isActive: false,
      });

    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 11. OVER-LARGE BODIES
  // -------------------------------------------------------------------------
  it('11. Over-large bodies return 413 Payload Too Large', async () => {
    // Generate an oversized payload (> 1MB)
    const hugeString = 'A'.repeat(1024 * 1024 + 100);
    const res = await request(app)
      .post('/api/posters')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        templateId: templateA._id.toString(),
        prompt: hugeString,
        content: { title: 'Big' },
      });

    expect(res.status).toBe(413);
  });

  // -------------------------------------------------------------------------
  // 12. HEADER CHECKS (CSP, HSTS, No Server Banner)
  // -------------------------------------------------------------------------
  it('12. Security header checks: CSP, HSTS present and no server banner', async () => {
    const res = await request(app).get('/api/health');

    // 1. No server banner (X-Powered-By is omitted)
    expect(res.headers['x-powered-by']).toBeUndefined();

    // 2. Strict-Transport-Security is present
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);

    // 3. Content-Security-Policy is present
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toMatch(/default-src/);
  });
});
