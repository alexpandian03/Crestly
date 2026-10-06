import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

async function migrate() {
  console.log('🔄 Running clientId migration script...');

  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // 1. Locate or create Acme Corporation client
    let acmeClient = await db.collection('clients').findOne({ name: 'Acme Corporation' });
    if (!acmeClient) {
      const result = await db.collection('clients').insertOne({
        name: 'Acme Corporation',
        plan: 'starter',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      acmeClient = { _id: result.insertedId, name: 'Acme Corporation' };
      console.log('Created Acme Corporation client:', acmeClient._id);
    } else {
      console.log('Found existing Acme Corporation client:', acmeClient._id);
    }

    // 2. Migrate users with string clientId
    const userUpdate = await db.collection('users').updateMany(
      { clientId: 'client_acme' },
      { $set: { clientId: acmeClient._id, updatedAt: new Date() } }
    );
    console.log(`Migrated ${userUpdate.modifiedCount} users from "client_acme" to ObjectId(${acmeClient._id})`);

    // 3. Migrate brandkits with string clientId
    const brandKitUpdate = await db.collection('brandkits').updateMany(
      { clientId: 'client_acme' },
      { $set: { clientId: acmeClient._id, updatedAt: new Date() } }
    );
    console.log(`Migrated ${brandKitUpdate.modifiedCount} brandkits from "client_acme" to ObjectId(${acmeClient._id})`);

    console.log('✅ Migration completed successfully.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

migrate();
