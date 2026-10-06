import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import BrandKit from '../models/BrandKit.model.js';
import { BRAND_KIT_DEFAULTS, collectMissingDefaultPaths } from '../services/brand/style.js';

/**
 * Brand kit upgrade 1 migration. Safe to run repeatedly:
 * - turns an old color-string background into the new background shape
 * - gives any background that lost its color the default one back
 * - adds every new style block (textStyle, header/logo/tagline/border, content,
 *   footer contacts, preset) with its default value
 *
 * Stored text, colors, fonts, logos and image URLs are never rewritten.
 */

let backgroundsConverted = 0;
let colorsRepaired = 0;
let defaultsAdded = 0;

async function repairBlankBackgroundColors() {
  for (const section of ['header', 'footer']) {
    const path = `${section}.background.color`;
    const kits = await BrandKit.collection
      .find({ [path]: { $in: [null, ''] } }, { projection: { _id: 1 } })
      .toArray();
    for (const kit of kits) {
      await BrandKit.collection.updateOne(
        { _id: kit._id },
        { $set: { [path]: BRAND_KIT_DEFAULTS[section].background.color } }
      );
      colorsRepaired += 1;
    }
  }
  console.log(`Backgrounds given their default color back: ${colorsRepaired}`);
}

async function convertLegacyBackgrounds() {
  for (const section of ['header', 'footer']) {
    const path = `${section}.background`;
    const kits = await BrandKit.collection
      .find({ [path]: { $type: 'string' } }, { projection: { [section]: 1 } })
      .toArray();
    for (const kit of kits) {
      const color = kit?.[section]?.background;
      await BrandKit.collection.updateOne(
        { _id: kit._id },
        { $set: { [path]: { type: 'color', color } } }
      );
      backgroundsConverted += 1;
    }
  }
  console.log(`Backgrounds moved into the new shape: ${backgroundsConverted}`);
}

async function addMissingDefaults() {
  const needsDefaults = {
    $or: ['preset', 'textStyle', 'header.logo', 'header.orgName', 'header.tagline', 'header.border', 'content', 'footer.layout', 'footer.style', 'footer.divider'].map(
      (path) => ({ [path]: { $exists: false } })
    ),
  };

  const cursor = BrandKit.collection.find(needsDefaults, { projection: { orgName: 1, header: 1, footer: 1, content: 1, fonts: 1 } });
  for await (const kit of cursor) {
    const missing = collectMissingDefaultPaths(kit);
    if (Object.keys(missing).length === 0) continue;
    await BrandKit.collection.updateOne({ _id: kit._id }, { $set: missing });
    defaultsAdded += 1;
  }
  console.log(`Brand kits given new style blocks: ${defaultsAdded}`);
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to migrate brand kits.');
  await connectDB();

  const total = await BrandKit.countDocuments({});
  console.log(`Brand kits in the database: ${total}`);
  if (total === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  await convertLegacyBackgrounds();
  await repairBlankBackgroundColors();
  await addMissingDefaults();
  console.log('Brand kit migration finished.');
}

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`Brand kit migration failed: ${err.message}`);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
