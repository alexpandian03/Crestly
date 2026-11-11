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

describe('Local-Level Roles and Company Setup Test Suite', () => {
  let mongod;
  let clientA;
  let clientB;
  let templateA;
  let templateB;
  let superadminUser;
  let adminAUser;
  let userAUser;
  let adminBUser;
  let superToken;
  let adminAToken;
  let userAToken;
  let adminBToken;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await connectDB();

    // 1. Create two tenant clients
    clientA = await Client.create({
      name: 'Alpha Company',
      contactEmail: 'alpha@local.test',
      isActive: true,
    });
    clientB = await Client.create({
      name: 'Beta Company',
      contactEmail: 'beta@local.test',
      isActive: true,
    });

    // 2. Create BrandKits for both
    await BrandKit.create({
      clientId: clientA._id,
      orgName: 'Alpha Local Company',
      primaryColor: '#1E40AF',
      header: { text: 'Alpha 2025 Header' },
    });
    await BrandKit.create({
      clientId: clientB._id,
      orgName: 'Beta Local Company',
      primaryColor: '#047857',
      header: { text: 'Beta 2025 Header' },
    });

    // 3. Create Templates
    templateA = await Template.create({
      clientId: clientA._id,
      name: 'Alpha Annual Poster Layout',
      category: 'Event',
      isActive: true,
      isDefault: true,
      editorVersion: 2,
      version: 1,
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
      name: 'Beta Showcase Layout',
      category: 'Event',
      isActive: true,
      isDefault: true,
      editorVersion: 2,
      version: 1,
      size: { width: 1080, height: 1350 },
      elements: [{ id: 'h2', kind: 'field', field: 'headline', text: 'Head B', x: 0, y: 150, w: 1000, h: 100, style: { size: 40 } }],
      zones: [
        { id: 'zh', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 'zc', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
        { id: 'zf', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
      ],
    });

    // 4. Create Users across roles
    const pw = 'Password123!';
    const hash = await User.hashPassword(pw);

    superadminUser = await User.create({
      name: 'Super Admin',
      email: 'super@local.test',
      passwordHash: hash,
      role: 'superadmin',
      isEmailVerified: true,
      isActive: true,
    });

    adminAUser = await User.create({
      name: 'Client Admin Alpha',
      email: 'admin@alpha.test',
      passwordHash: hash,
      role: 'clientadmin',
      clientId: clientA._id,
      isEmailVerified: true,
      isActive: true,
    });

    userAUser = await User.create({
      name: 'User Alpha',
      email: 'user@alpha.test',
      passwordHash: hash,
      role: 'user',
      clientId: clientA._id,
      isEmailVerified: true,
      isActive: true,
    });

    adminBUser = await User.create({
      name: 'Client Admin Beta',
      email: 'admin@beta.test',
      passwordHash: hash,
      role: 'clientadmin',
      clientId: clientB._id,
      isEmailVerified: true,
      isActive: true,
    });

    // 5. Generate Auth Tokens via login
    const superRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'super@local.test', password: pw });
    superToken = superRes.body.data.token;

    const adminARes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'admin@alpha.test', password: pw });
    adminAToken = adminARes.body.data.token;

    const userARes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user@alpha.test', password: pw });
    userAToken = userARes.body.data.token;

    const adminBRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'admin@beta.test', password: pw });
    adminBToken = adminBRes.body.data.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('1. Permissions Matrix (Server Enforced)', () => {
    it('Superadmin CAN write brand kits (200)', async () => {
      const res = await request(app)
        .put('/api/brand-kit')
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id))
        .send({ orgName: 'Alpha Local Company - Super Edited' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandKit.orgName).toBe('Alpha Local Company - Super Edited');
    });

    it('Superadmin CAN create, update, and manage templates (200/201)', async () => {
      // Create template
      const createRes = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id))
        .send({
          name: 'Alpha Promo Template',
        });
      expect(createRes.status).toBe(201);
      const newTemplateId = createRes.body.data.template._id;

      // Update template
      const updateRes = await request(app)
        .patch(`/api/templates/${newTemplateId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id))
        .send({ name: 'Alpha Promo Template Updated' });
      expect(updateRes.status).toBe(200);

      // Duplicate template
      const dupRes = await request(app)
        .post(`/api/templates/${templateA._id}/duplicate`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id));
      expect(dupRes.status).toBe(201);

      // Delete template
      await request(app)
        .post(`/api/templates/${newTemplateId}/deactivate`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id));

      const delRes = await request(app)
        .delete(`/api/templates/${newTemplateId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id));
      expect(delRes.status).toBe(200);
    });

    it('Superadmin CAN update company settings and activation status (200)', async () => {
      const res = await request(app)
        .patch(`/api/clients/${clientA._id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ sessionLength: '8h' });

      expect(res.status).toBe(200);
      expect(res.body.data.client.sessionLength).toBe('8h');
    });

    it('Clientadmin gets 403 on writing brand kits', async () => {
      const res = await request(app)
        .put('/api/brand-kit')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ orgName: 'Hacked Alpha' });

      expect(res.status).toBe(403);
    });

    it('Clientadmin gets 403 on creating or modifying templates', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Unauthorized Template',
          category: 'Event',
          size: { width: 1080, height: 1350 },
        });
      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .patch(`/api/templates/${templateA._id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Hacked Template' });
      expect(updateRes.status).toBe(403);

      const dupRes = await request(app)
        .post(`/api/templates/${templateA._id}/duplicate`)
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(dupRes.status).toBe(403);

      const delRes = await request(app)
        .delete(`/api/templates/${templateA._id}`)
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(delRes.status).toBe(403);
    });

    it('Clientadmin gets 403 on modifying company settings', async () => {
      const res = await request(app)
        .patch(`/api/clients/${clientA._id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ sessionLength: '24h' });

      expect(res.status).toBe(403);
    });

    it('User gets 403 on brand kit and template writes', async () => {
      const brandRes = await request(app)
        .put('/api/brand-kit')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ orgName: 'Hacked by User' });
      expect(brandRes.status).toBe(403);

      const tplRes = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'User Template' });
      expect(tplRes.status).toBe(403);
    });

    it('Clientadmin and User CAN read active templates and brand kit (200)', async () => {
      const brandRes = await request(app)
        .get('/api/brand-kit')
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(brandRes.status).toBe(200);

      const tplRes = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(tplRes.status).toBe(200);
      expect(Array.isArray(tplRes.body.data.templates)).toBe(true);

      const userBrandRes = await request(app)
        .get('/api/brand-kit')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(userBrandRes.status).toBe(200);

      const userTplRes = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(userTplRes.status).toBe(200);
    });
  });

  describe('2. Cross-Tenant Data Isolation (Returns 404)', () => {
    let posterB;

    beforeAll(async () => {
      // Create a poster in Client B
      posterB = await Poster.create({
        clientId: clientB._id,
        userId: adminBUser._id,
        templateId: templateB._id,
        templateVersion: 1,
        title: 'Beta Exclusive Event',
        prompt: 'Beta exclusive annual meeting',
        content: { title: 'Beta Exclusive Event' },
        design: {
          brandKit: { orgName: 'Beta Local Company' },
          template: { name: 'Beta Showcase Layout' },
          bands: { header: { text: 'Beta Header' } },
        },
      });
    });

    it('Clientadmin A accessing Client B template by ID returns 404', async () => {
      const res = await request(app)
        .get(`/api/templates/${templateB._id}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Clientadmin A accessing Client B poster by ID returns 404', async () => {
      const res = await request(app)
        .get(`/api/posters/${posterB._id}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Clientadmin A accessing Client B organization details returns 404', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientB._id}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('User A accessing Client B template or poster returns 404', async () => {
      const tplRes = await request(app)
        .get(`/api/templates/${templateB._id}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(tplRes.status).toBe(404);

      const posterRes = await request(app)
        .get(`/api/posters/${posterB._id}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(posterRes.status).toBe(404);
    });
  });

  describe('3. Poster Snapshot Immutability (Versioning)', () => {
    let savedPosterId;

    it('creates a poster with the company initial brand kit and template', async () => {
      const res = await request(app)
        .post('/api/posters')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          templateId: String(templateA._id),
          prompt: 'Annual Sports Festival for the local community',
          content: {
            title: 'Annual Sports Day 2025',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      savedPosterId = res.body.data.poster._id;

      const poster = res.body.data.poster;
      expect(poster.templateVersion).toBe(1);
      expect(poster.design).toBeDefined();
      expect(poster.design.brandKit.orgName).toBe('Alpha Local Company - Super Edited');
    });

    it('Super Admin updates Brand Kit and Template (creates version 2)', async () => {
      // 1. Super Admin updates Brand Kit with new org name and header
      const kitRes = await request(app)
        .put('/api/brand-kit')
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id))
        .send({
          orgName: 'Alpha Yearly Rebranded 2026',
          primaryColor: '#DC2626',
        });
      expect(kitRes.status).toBe(200);

      // 2. Super Admin updates Template (increments to version 2)
      const tplRes = await request(app)
        .patch(`/api/templates/${templateA._id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('X-Client-Id', String(clientA._id))
        .send({
          name: 'Alpha Annual Poster Layout - 2026 Edition',
          size: { width: 1080, height: 1350 },
        });
      expect(tplRes.status).toBe(200);
      expect(tplRes.body.data.template.version).toBe(2);
    });

    it('previously saved poster retains its original frozen snapshot', async () => {
      const res = await request(app)
        .get(`/api/posters/${savedPosterId}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const poster = res.body.data.poster;

      // The saved poster keeps version 1 snapshot and old brand kit details
      expect(poster.templateVersion).toBe(1);
      expect(poster.design.brandKit.orgName).toBe('Alpha Local Company - Super Edited');
      expect(poster.design.template.name).toBe('Alpha Annual Poster Layout');
    });

    it('a new poster created after the update uses the new version and brand kit snapshot', async () => {
      const res = await request(app)
        .post('/api/posters')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          templateId: String(templateA._id),
          prompt: 'New 2026 Gala Poster',
          content: {
            title: 'Gala Night 2026',
          },
        });

      expect(res.status).toBe(201);
      const newPoster = res.body.data.poster;

      // New poster captures version 2 and the updated brand kit
      expect(newPoster.templateVersion).toBe(2);
      expect(newPoster.design.brandKit.orgName).toBe('Alpha Yearly Rebranded 2026');
      expect(newPoster.design.template.name).toBe('Alpha Annual Poster Layout - 2026 Edition');
    });
  });

  describe('4. Company Settings Permissions', () => {
    it('Client admin cannot enable allowExtraLayouts directly', async () => {
      const res = await request(app)
        .put(`/api/clients/${clientA._id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Alpha Company Updated',
          allowExtraLayouts: true,
        });

      // Client admin cannot update company settings (403)
      expect(res.status).toBe(403);
      const dbClient = await Client.findById(clientA._id);
      expect(dbClient.allowExtraLayouts).toBe(false);
    });
  });
});
