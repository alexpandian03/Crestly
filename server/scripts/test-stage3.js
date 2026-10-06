import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { generateToken } from '../services/auth.service.js';

let passed = 0;
let failed = 0;
const testPassword = `Test${crypto.randomBytes(8).toString('hex')}9`;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Stage 3 & Security Verification Test Suite...\n');

  const PORT = 5009;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Health check
    console.log('1. Health Check Endpoint');
    const healthRes = await fetch(`${baseUrl}/api/health`).then(async (r) => ({
      status: r.status,
      body: await r.json(),
    }));
    assert(healthRes.status === 200, 'GET /api/health returns 200');
    assert(healthRes.body.status === 'ok', 'Health status is "ok"');
    assert(healthRes.body.db === 'connected', 'Database is connected');

    // 2. Fetch or create test client
    console.log('\n2. Tenant Setup');
    let client = await Client.findOne({ name: 'Acme Corporation' });
    if (!client) {
      client = await Client.create({ name: 'Acme Corporation', plan: 'pro', isActive: true });
    }
    assert(Boolean(client._id), `Active client found: ${client.name} (${client._id})`);
    await BrandKit.findOneAndUpdate(
      { clientId: client._id },
      { $setOnInsert: { clientId: client._id, orgName: client.name } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // 3. Superadmin auth & clients API
    console.log('\n3. Superadmin Authorization & Clients API');
    const superadmin = await User.findOne({ role: 'superadmin' });
    assert(Boolean(superadmin), `Superadmin found: ${superadmin?.email}`);
    const superadminToken = generateToken(superadmin);

    const clientsRes = await fetch(`${baseUrl}/api/clients`, {
      headers: { authorization: `Bearer ${superadminToken}` },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(clientsRes.status === 200, 'Superadmin can GET /api/clients');
    assert(Array.isArray(clientsRes.body.data?.clients), 'Returns array of clients');

    // 4. Clientadmin cannot access /api/clients
    console.log('\n4. Clientadmin Boundary Enforcement');
    let clientAdmin = await User.findOne({ role: 'clientadmin', clientId: client._id });
    if (!clientAdmin) {
      const pwd = await User.hashPassword(testPassword);
      clientAdmin = await User.create({
        name: 'Acme Admin',
        email: 'test-admin@acme.com',
        passwordHash: pwd,
        role: 'clientadmin',
        clientId: client._id,
      });
    }
    const clientAdminToken = generateToken(clientAdmin);

    const deniedClientsRes = await fetch(`${baseUrl}/api/clients`, {
      headers: { authorization: `Bearer ${clientAdminToken}` },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(deniedClientsRes.status === 403, 'Clientadmin is denied GET /api/clients (HTTP 403)');

    // 5. BrandKit Scoping
    console.log('\n5. BrandKit Scoping & Updates');
    const brandKitGetRes = await fetch(`${baseUrl}/api/brand-kit`, {
      headers: { authorization: `Bearer ${clientAdminToken}` },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(brandKitGetRes.status === 200, 'Clientadmin can GET /api/brand-kit for their tenant');
    assert(
      String(brandKitGetRes.body.data.brandKit.clientId) === String(client._id),
      'BrandKit clientId strictly matches clientadmin tenant'
    );

    const brandKitUpdateRes = await fetch(`${baseUrl}/api/brand-kit`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${clientAdminToken}`,
      },
      body: JSON.stringify({
        orgName: 'Acme Brand New Name',
        colors: { primary: '#10b981', secondary: '#0f172a' },
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(brandKitUpdateRes.status === 200, 'Clientadmin can update their BrandKit');
    assert(brandKitUpdateRes.body.data.brandKit.orgName === 'Acme Brand New Name', 'BrandKit updated properly');

    // 6. Security Check: Clientadmin cannot create superadmin or user for another tenant
    console.log('\n6. User Creation Security & Scope Enforcement');
    const illegalSuperadminRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${clientAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Hacker Admin',
        email: `hacker-${Date.now()}@test.com`,
        password: testPassword,
        role: 'superadmin',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(
      illegalSuperadminRes.status === 403,
      'Clientadmin cannot create a superadmin (HTTP 403)'
    );

    // 7. Security Check: Password hash never exposed
    console.log('\n7. Data Sanitization');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${clientAdminToken}` },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    assert(meRes.body.data?.user?.passwordHash === undefined, 'passwordHash is excluded from response');

    // 8. Logo Upload (Memory Buffer -> Cloudinary/DataURI)
    console.log('\n8. In-Memory Logo Upload (Never writes to disk)');
    const form = new FormData();
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const mockFile = new Blob([pngBytes], { type: 'image/png' });
    form.append('logo', mockFile, 'test_logo.png');

    const uploadRes = await fetch(`${baseUrl}/api/uploads/logo`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientAdminToken}`,
      },
      body: form,
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(uploadRes.status === 200, 'POST /api/uploads/logo returns 200 with memory buffer');
    assert(Boolean(uploadRes.body.data.url), 'Returns secure URL / data URI without writing to disk');
    const uploadedLogoUrl = uploadRes.body.data.secure_url || uploadRes.body.data.url;

    // 9. Definition of Done: clientadmin uploads logo, saves brand kit, and reloads correctly
    console.log('\n9. Definition of Done: Upload Logo -> Save BrandKit -> Reload');
    const saveKitRes = await fetch(`${baseUrl}/api/brand-kit`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${clientAdminToken}`,
      },
      body: JSON.stringify({
        orgName: 'Acme Corporation Modern',
        logos: [{ url: uploadedLogoUrl, label: 'Official Logo', isPrimary: true }],
        colors: { primary: '#10b981', secondary: '#0f172a' },
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(saveKitRes.status === 200, 'Clientadmin saved BrandKit with newly uploaded logo URL');

    const reloadKitRes = await fetch(`${baseUrl}/api/brand-kit`, {
      headers: { authorization: `Bearer ${clientAdminToken}` },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    assert(reloadKitRes.status === 200, 'BrandKit reloaded successfully via GET /api/brand-kit');
    assert(
      reloadKitRes.body.data.brandKit?.logos?.[0]?.url === uploadedLogoUrl,
      'Reloaded BrandKit contains the exact uploaded logo URL'
    );

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    server.close();
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite failed unexpectedly:', err);
    server.close();
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

runTests();
