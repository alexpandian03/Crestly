import dotenv from 'dotenv';
dotenv.config();

process.env.LLM_PROVIDER = 'mock';
process.env.IMAGE_SEARCH_PROVIDER = 'unsplash';
process.env.UNSPLASH_API_KEY = 'test_mock_unsplash_key';

import http from 'http';
import crypto from 'crypto';
import assert from 'node:assert/strict';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { generateToken } from '../services/auth.service.js';

console.log('🧪 Starting User Photo Precedence & Unsplash Search Suppression Tests...\n');

async function runTests() {
  await connectDB();
  const PORT = 5031;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Setup Tenant & User
    let client = await Client.findOne({ name: 'Acme Corporation' });
    if (!client) {
      client = await Client.create({
        name: 'Acme Corporation',
        plan: 'starter',
        isActive: true,
        designModes: { ai: true, template: true },
      });
    }

    const testPassword = `Test${crypto.randomBytes(8).toString('hex')}9`;
    let user = await User.findOne({ email: 'photo-precedence-tester@acme.com' });
    if (!user) {
      user = await User.create({
        name: 'Photo Precedence Tester',
        email: 'photo-precedence-tester@acme.com',
        passwordHash: await User.hashPassword(testPassword),
        role: 'clientadmin',
        clientId: client._id,
      });
    }
    const token = generateToken(user);

    let template = await Template.findOne({ clientId: client._id, isActive: true });
    if (!template) {
      template = await Template.create(getDefaultTemplateData(client._id, 'Acme Default'));
    }

    let brandKit = await BrandKit.findOne({ clientId: client._id });
    if (!brandKit) {
      brandKit = await BrandKit.create({
        clientId: client._id,
        orgName: 'Acme Corporation',
        colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#3B82F6', background: '#FFFFFF', text: '#0F172A' },
        fonts: { heading: 'Outfit', body: 'Inter' },
        header: { height: 140 },
        footer: { height: 130 },
      });
    }

    // Spy on global fetch to catch any Unsplash API calls
    let unsplashFetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('unsplash.com')) {
        unsplashFetchCalls++;
        return new Response(
          JSON.stringify({
            results: [
              {
                urls: { regular: 'https://images.unsplash.com/photo-stock-default.jpg' },
                user: { name: 'Stock Photographer', links: { html: 'https://unsplash.com/@stock' } },
                links: { download_location: 'https://api.unsplash.com/photos/123/download' },
                description: 'Stock photo',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const userPhotoUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v1700000000/my-custom-photo.jpg';

    // Test 1: Mode template with user photo provided
    console.log('Test 1: Template mode WITH user photo provided');
    unsplashFetchCalls = 0;

    const resWithPhoto = await fetch(`${baseUrl}/api/posters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateId: String(template._id),
        prompt: 'Annual Sports Day on 15 Oct, 8 AM at School Ground',
        mode: 'template',
        imageUrl: userPhotoUrl,
      }),
    });

    const dataWithPhoto = await resWithPhoto.json();
    assert.equal(resWithPhoto.status, 200, `Expected 200, got ${resWithPhoto.status}: ${JSON.stringify(dataWithPhoto)}`);
    assert.ok(dataWithPhoto.success, 'Response must be success');

    // ASSERTION 1: Poster image must be the user's URL
    assert.equal(
      dataWithPhoto.data.content.imageUrl,
      userPhotoUrl,
      `Expected poster image to be user's URL "${userPhotoUrl}", got "${dataWithPhoto.data.content.imageUrl}"`
    );

    // ASSERTION 2: If template has image slots, it must also be set to the user's URL
    if (dataWithPhoto.data.imageSlots?.length > 0) {
      const slotKey = dataWithPhoto.data.imageSlots[0].key;
      assert.equal(
        dataWithPhoto.data.content.images?.[slotKey],
        userPhotoUrl,
        `Expected slot "${slotKey}" to receive user URL`
      );
    }

    // ASSERTION 3: Unsplash search must NOT be called
    assert.equal(
      unsplashFetchCalls,
      0,
      `Unsplash search was called ${unsplashFetchCalls} time(s) even though user photo was provided!`
    );
    console.log('  ✅ PASS: Unsplash search was NOT called; poster image is the user URL.\n');

    // Test 2: Mode AI designs it WITH user photo provided
    console.log('Test 2: AI mode WITH user photo provided');
    unsplashFetchCalls = 0;

    const resAiWithPhoto = await fetch(`${baseUrl}/api/posters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: 'Annual Sports Day on 15 Oct, 8 AM at School Ground',
        mode: 'ai',
        imageUrl: userPhotoUrl,
      }),
    });

    const dataAiWithPhoto = await resAiWithPhoto.json();
    assert.equal(resAiWithPhoto.status, 200, `Expected 200, got ${resAiWithPhoto.status}`);
    assert.ok(dataAiWithPhoto.success, 'Response must be success');

    assert.equal(
      dataAiWithPhoto.data.content.imageUrl,
      userPhotoUrl,
      `Expected AI poster image to be user's URL "${userPhotoUrl}", got "${dataAiWithPhoto.data.content.imageUrl}"`
    );
    assert.equal(
      unsplashFetchCalls,
      0,
      `Unsplash search was called ${unsplashFetchCalls} time(s) in AI mode even though user photo was provided!`
    );
    console.log('  ✅ PASS: Unsplash search was NOT called in AI mode; user URL preserved.\n');

    // Test 3: Mode template WITHOUT user photo (falls back to stock photo search)
    console.log('Test 3: Template mode WITHOUT user photo (stock search fallback)');
    unsplashFetchCalls = 0;

    const resNoPhoto = await fetch(`${baseUrl}/api/posters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateId: String(template._id),
        prompt: 'Diwali Night Market on 2 Nov, 5 PM at Town Square',
        mode: 'template',
      }),
    });

    const dataNoPhoto = await resNoPhoto.json();
    assert.equal(resNoPhoto.status, 200);
    assert.ok(dataNoPhoto.success);

    // Stock search should be invoked when no user photo is given
    assert.ok(
      unsplashFetchCalls > 0,
      'Expected Unsplash search to be called when no user photo is given'
    );
    assert.ok(
      typeof dataNoPhoto.data.content.imageUrl === 'string' && dataNoPhoto.data.content.imageUrl.length > 0,
      'Stock photo URL must be populated when user provides no photo'
    );
    console.log('  ✅ PASS: Stock photo search called when no user photo is provided.\n');

    // Restore fetch
    globalThis.fetch = originalFetch;

    // Cleanup test user
    await User.deleteOne({ _id: user._id });

    console.log('========================================');
    console.log('ALL USER PHOTO PRECEDENCE TESTS PASSED!');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
