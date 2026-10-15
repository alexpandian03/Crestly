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

describe('Server API Flow - Auth, Posters, RBAC and Tenant Isolation', () => {
  let mongod;
  let clientA;
  let clientB;
  let templateA;
  let tokenA;
  let tokenB;
  let createdPosterId;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await connectDB();

    // Create two isolated clients
    clientA = await Client.create({ name: 'Client Alpha', contactEmail: 'alpha@test.com' });
    clientB = await Client.create({ name: 'Client Beta', contactEmail: 'beta@test.com' });

    // Create BrandKits
    await BrandKit.create({ clientId: clientA._id, orgName: 'Alpha Org' });
    await BrandKit.create({ clientId: clientB._id, orgName: 'Beta Org' });

    // Create an active template for Client A
    templateA = await Template.create({
      clientId: clientA._id,
      name: 'Default Event Template',
      category: 'Event',
      isActive: true,
      editorVersion: 2,
      size: { width: 1080, height: 1350 },
      elements: [
        {
          id: 'head-1',
          kind: 'field',
          field: 'headline',
          text: 'Title Here',
          x: 60,
          y: 200,
          w: 960,
          h: 120,
          style: { size: 64, color: '#000000' },
        },
      ],
      zones: [
        { id: 'z-hdr', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 'z-cnt', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
        { id: 'z-ftr', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
      ],
    });

    // Create User in Client A (normal user)
    const passwordHashA = await User.hashPassword('Pass12345678!');
    await User.create({
      name: 'User Alpha',
      email: 'user-alpha@test.com',
      passwordHash: passwordHashA,
      role: 'user',
      clientId: clientA._id,
      isActive: true,
    });

    // Create User in Client B (normal user)
    const passwordHashB = await User.hashPassword('Pass12345678!');
    await User.create({
      name: 'User Beta',
      email: 'user-beta@test.com',
      passwordHash: passwordHashB,
      role: 'user',
      clientId: clientB._id,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (global.__mongoose) {
      global.__mongoose = { conn: null, promise: null };
    }
    if (mongod) await mongod.stop();
  });

  it('1. logs in successfully and returns JWT token', async () => {
    const resA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user-alpha@test.com', password: 'Pass12345678!' });

    expect(resA.status).toBe(200);
    expect(resA.body.success).toBe(true);
    expect(resA.body.data.token).toBeDefined();
    tokenA = resA.body.data.token;

    const resB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user-beta@test.com', password: 'Pass12345678!' });

    expect(resB.status).toBe(200);
    expect(resB.body.success).toBe(true);
    expect(resB.body.data.token).toBeDefined();
    tokenB = resB.body.data.token;
  });

  it('2. creates a poster as a normal user', async () => {
    const res = await request(app)
      .post('/api/posters')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        templateId: templateA._id.toString(),
        prompt: 'Annual inter-college design hackathon event',
        content: {
          title: 'Designathon 2026',
          tagline: 'Create impactful designs',
          date: 'Nov 15, 2026',
          time: '10:00 AM',
          venue: 'Campus Auditorium',
          details: ['Prizes worth 50k', 'Mentors from top firms'],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.poster).toBeDefined();
    expect(res.body.data.poster.title).toBe('Designathon 2026');
    createdPosterId = res.body.data.poster._id;
  });

  it('3. a normal user cannot call an admin route (returns 403)', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/permission|access|denied|forbidden/i);
  });

  it("4. another client's user receives 404 when requesting this poster", async () => {
    const res = await request(app)
      .get(`/api/posters/${createdPosterId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
