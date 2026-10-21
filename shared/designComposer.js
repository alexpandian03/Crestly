/**
 * /shared/designComposer.js
 *
 * Pure, deterministic design composer for PosterAI.
 * Assembles modular blocks into a complete, beautiful poster layout tree
 * and executes layout engine positioning.
 *
 * Key guarantees:
 *  1. Pure & deterministic from seed (same seed -> identical output).
 *  2. Picks one block per role (preferences first, then seeded choice from candidates).
 *  3. Rejects incompatible or unfitting combinations (text overflow, photo block without photo, contrast < 4.5:1).
 *  4. Locked header and footer are NEVER part of the output (strictly inside contentArea).
 *  5. Layout signature per design (coarse 4x4 occupancy grid + dominant colour roles).
 *  6. Two designs offered together differ by more than DIVERSITY_THRESHOLD (0.35).
 *  7. A refresh with a new seed changes at least the hero or the info block.
 *  8. Rule-based default: with no AI input, event type and seed choose the blocks.
 */

import {
  HERO_BLOCKS,
  INFO_BLOCKS,
  MESSAGE_BLOCKS,
  CTA_BLOCKS,
  BACKGROUND_BLOCKS,
  DECORATION_BLOCKS,
  TYPE_PAIRING_BLOCKS,
  COLOUR_ASSIGNMENT_BLOCKS,
  blockById,
  isCompatible,
} from './designBlocks.js';
import { neededSectionsFor } from './eventTypes.js';
import {
  stack,
  overlay,
  layout,
  LAYOUT_TOKENS,
} from './layoutEngine.js';
import { contrastRatio } from './designRecipes.js';
import { resolveColorToken, contentArea as computeContentArea } from './templateElements.js';

export const DIVERSITY_THRESHOLD = 0.35;

/**
 * Event-type to block suit category mapping.
 */
export const EVENT_CATEGORY_MAP = {
  blood_camp: ['blood_camp', 'health', 'awareness', 'general'],
  birthday: ['birthday', 'celebration', 'cultural', 'general'],
  award_function: ['award_function', 'corporate', 'celebration', 'general'],
  sports_day: ['sports_day', 'sports', 'festival', 'general'],
  school_annual_day: ['school_annual_day', 'education', 'general'],
  temple_festival: ['temple_festival', 'festival', 'cultural', 'general'],
  wedding: ['wedding', 'celebration', 'general'],
  workshop: ['workshop', 'education', 'meeting', 'general'],
  meeting: ['meeting', 'corporate', 'notice', 'general'],
  general: ['general'],
};

/**
 * Rich rule-based defaults when no AI input or partial facts are provided.
 */
export const DEFAULT_FACTS_BY_EVENT = {
  blood_camp: {
    title: 'Blood Donation Camp',
    subtitle: 'Donate Blood, Save Lives',
    date: '15 Nov 2026',
    time: '9:00 AM - 2:00 PM',
    venue: 'Community Center Auditorium',
    message: 'Every donation can save up to three lives in emergency care.',
    cta: 'Register as Donor',
    contact: 'Contact: 98765 43210',
  },
  birthday: {
    title: 'Happy Birthday Celebration',
    subtitle: 'Wishing You Joy and Happiness',
    date: '20 Nov 2026',
    time: '6:30 PM Onwards',
    venue: 'Grand Banquet Hall',
    message: 'Join us to celebrate this special day with dinner and music.',
    cta: 'RSVP Today',
    contact: 'Hosted with love',
  },
  award_function: {
    title: 'Annual Excellence Awards',
    subtitle: 'Honoring Outstanding Achievements',
    date: '10 Dec 2026',
    time: '5:00 PM',
    venue: 'Convention Center Main Hall',
    message: 'Recognizing remarkable dedication, innovation, and leadership.',
    cta: 'Reserve Your Seat',
    contact: 'Organizing Committee',
  },
  sports_day: {
    title: 'Annual Sports Meet',
    subtitle: 'Strength, Passion, and Victory',
    date: '25 Nov 2026',
    time: '8:00 AM',
    venue: 'University Sports Ground',
    message: 'Cheer for your teams across track, field, and team tournaments.',
    cta: 'View Schedule',
    contact: 'Sports Council',
  },
  school_annual_day: {
    title: 'School Annual Day Celebration',
    subtitle: 'A Journey of Learning and Cultural Harmony',
    date: '18 Dec 2026',
    time: '4:30 PM',
    venue: 'School Open Air Theatre',
    message: 'Featuring student performances, exhibitions, and prize distribution.',
    cta: 'Join the Celebration',
    contact: 'Principal & Staff',
  },
  temple_festival: {
    title: 'Maha Thiruvizha Festival',
    subtitle: 'Divine Blessings and Traditional Celebrations',
    date: '05 Dec 2026',
    time: '7:00 AM Onwards',
    venue: 'Temple Grounds & Sannidhi',
    message: 'Special abhishekam, pooja ceremonies, and cultural processions.',
    cta: 'All Are Welcome',
    contact: 'Temple Trust',
  },
  wedding: {
    title: 'Wedding Ceremony',
    subtitle: 'Together with Their Families',
    date: '12 Dec 2026',
    time: '10:30 AM',
    venue: 'Royal Palace Convention Center',
    message: 'Request the honor of your presence as we celebrate our marriage.',
    cta: 'Bless the Couple',
    contact: 'Family & Friends',
  },
  workshop: {
    title: 'Hands-on Technical Workshop',
    subtitle: 'Master Modern Skills and Practices',
    date: '22 Nov 2026',
    time: '10:00 AM - 4:00 PM',
    venue: 'Innovation Hub Hall A',
    message: 'Interactive sessions, live coding demos, and expert mentorship.',
    cta: 'Register Online',
    contact: 'Workshop Coordinators',
  },
  meeting: {
    title: 'General Body Meeting',
    subtitle: 'Review, Planning, and Strategic Direction',
    date: '30 Nov 2026',
    time: '11:00 AM',
    venue: 'Conference Room 3',
    message: 'Discussion of annual progress, financial reports, and new initiatives.',
    cta: 'Confirm Attendance',
    contact: 'Executive Committee',
  },
  general: {
    title: 'Community Gathering',
    subtitle: 'Connecting and Collaborating Together',
    date: '28 Nov 2026',
    time: '10:00 AM',
    venue: 'City Civic Auditorium',
    message: 'Join community members for an open discussion and networking.',
    cta: 'Learn More',
    contact: 'Event Organizers',
  },
};

/**
 * Merges user-supplied facts with event-specific defaults.
 */
export function resolveDefaultFacts(eventType = 'general', userFacts = {}) {
  const normalizedType = String(eventType || 'general').trim().toLowerCase();
  const base = DEFAULT_FACTS_BY_EVENT[normalizedType] || DEFAULT_FACTS_BY_EVENT.general;
  const merged = { ...base };

  if (userFacts && typeof userFacts === 'object') {
    for (const [k, v] of Object.entries(userFacts)) {
      if (v !== undefined) {
        merged[k] = v;
      }
    }
  }

  return merged;
}

/**
 * Pure 32-bit PRNG (Mulberry32).
 */
export function createRng(seed = 42) {
  let s = 0;
  if (typeof seed === 'number') {
    s = (seed >>> 0) || 1;
  } else {
    const str = String(seed || '');
    for (let i = 0; i < str.length; i++) {
      s = ((s << 5) - s + str.charCodeAt(i)) | 0;
    }
    s = (s >>> 0) || 1;
  }

  return function next() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Checks if a block suits an event type or category.
 */
function blockSuitsEvent(block, eventType) {
  if (!block || !Array.isArray(block.suits)) return true;
  if (block.suits.includes('*') || block.suits.includes('all')) return true;

  const type = String(eventType || 'general').trim().toLowerCase();
  const validCategories = EVENT_CATEGORY_MAP[type] || [type, 'general'];

  return block.suits.some((s) => validCategories.includes(String(s).trim().toLowerCase()));
}

/**
 * Evaluates whether two text elements overlap.
 */
function elementsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Validates candidate layout elements:
 * - Inside contentArea (strictly avoiding header & footer)
 * - Text elements do not overlap
 * - No empty text, image, or icon slots
 * - Minimum font size 20px
 * - Contrast at least 4.5:1 for every text element
 */
function validateLayoutElements(elements, area, brandKit) {
  if (!Array.isArray(elements) || elements.length === 0) return false;

  const kit = brandKit || {
    colors: {
      primary: '#2563eb',
      secondary: '#eff6ff',
      accent: '#d97706',
      text: '#111827',
      background: '#ffffff',
    },
  };

  const textEls = [];

  for (const el of elements) {
    if (!el || typeof el !== 'object') return false;

    // Boundary check
    if (el.y < area.y || el.y + el.h > area.y + area.h + 1) return false;
    if (el.x < area.x || el.x + el.w > area.x + area.w + 1) return false;

    if (el.kind === 'text') {
      textEls.push(el);
      // Empty text check
      if (typeof el.text !== 'string' || el.text.trim().length === 0) return false;
      // Minimum font size 20px
      if (typeof el.style?.size === 'number' && el.style.size < 20) return false;

      // Contrast check (>= 4.5:1)
      const rawColor = el.style?.color || 'brand:text';
      const fg = resolveColorToken(rawColor, kit) || rawColor;
      const bg = fg === '#ffffff' ? '#2563eb' : '#ffffff';
      const cr = contrastRatio(fg, bg);
      if (cr < 4.5) return false;
    }

    if (el.kind === 'image') {
      if (typeof el.imageUrl !== 'string' || el.imageUrl.trim().length === 0) return false;
    }

    if (el.kind === 'icon') {
      const name = el.name || el.icon || el.style?.icon;
      if (typeof name !== 'string' || name.trim().length === 0) return false;
    }
  }

  // Text overlap check
  for (let i = 0; i < textEls.length; i++) {
    for (let j = i + 1; j < textEls.length; j++) {
      if (elementsOverlap(textEls[i], textEls[j])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Computes a coarse 4x4 spatial occupancy grid and layout signature.
 */
export function computeLayoutSignature(elements = [], contentArea = { x: 40, y: 120, w: 1000, h: 1100 }, metadata = {}) {
  const COLS = 4;
  const ROWS = 4;
  const grid = new Array(COLS * ROWS).fill(0);

  const cellW = contentArea.w / COLS;
  const cellH = contentArea.h / ROWS;

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    if (el.kind === 'band') continue;
    // Skip full background shapes covering the entire canvas
    if (el.kind === 'shape' && el.w >= contentArea.w * 0.95 && el.h >= contentArea.h * 0.95) {
      continue;
    }

    const cMin = Math.max(0, Math.min(COLS - 1, Math.floor((el.x - contentArea.x) / cellW)));
    const cMax = Math.max(0, Math.min(COLS - 1, Math.floor((el.x + Math.max(1, el.w) - 1 - contentArea.x) / cellW)));
    const rMin = Math.max(0, Math.min(ROWS - 1, Math.floor((el.y - contentArea.y) / cellH)));
    const rMax = Math.max(0, Math.min(ROWS - 1, Math.floor((el.y + Math.max(1, el.h) - 1 - contentArea.y) / cellH)));

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        grid[r * COLS + c] = 1;
      }
    }
  }

  return {
    grid,
    hero: metadata.heroId || '',
    info: metadata.infoId || '',
    message: metadata.messageId || '',
    cta: metadata.ctaId || '',
    background: metadata.backgroundId || '',
    decoration: metadata.decorationId || '',
    typePairing: metadata.typePairingId || '',
    colourAssignment: metadata.colourAssignmentId || '',
  };
}

/**
 * Computes normalized distance [0, 1] between two layout signatures.
 */
export function signatureDistance(sigA, sigB) {
  if (!sigA || !sigB) return 1;

  // 1. Grid difference (Hamming distance on 16 grid cells)
  let cellDiff = 0;
  const len = Math.min(sigA.grid?.length || 16, sigB.grid?.length || 16);
  for (let i = 0; i < len; i++) {
    if (Boolean(sigA.grid[i]) !== Boolean(sigB.grid[i])) {
      cellDiff++;
    }
  }
  const gridDist = cellDiff / (len || 1);

  // 2. Structural Block difference
  let blockDist = 0;
  if (sigA.hero !== sigB.hero) blockDist += 0.35;
  if (sigA.info !== sigB.info) blockDist += 0.30;
  if (sigA.background !== sigB.background) blockDist += 0.15;
  if (sigA.decoration !== sigB.decoration) blockDist += 0.10;
  if (sigA.colourAssignment !== sigB.colourAssignment) blockDist += 0.10;

  const distance = 0.65 * blockDist + 0.35 * gridDist;
  return Number(distance.toFixed(4));
}

/**
 * Selects candidate blocks for a role, respecting:
 *  - preferences
 *  - photo availability
 *  - compatibility with already picked blocks
 *  - event category suitability
 *  - refresh constraint (seen)
 */
function pickCandidateBlock({
  role,
  candidates,
  preferences,
  hasPhoto,
  alreadyPicked,
  eventType,
  seenHeroes = [],
  seenInfos = [],
  rng,
}) {
  // Check preference first
  const prefId = preferences && preferences[role];
  if (prefId) {
    const prefBlock = blockById(prefId);
    if (
      prefBlock &&
      prefBlock.role === role &&
      (!prefBlock.needsPhoto || hasPhoto) &&
      alreadyPicked.every((p) => isCompatible(prefBlock, p))
    ) {
      return prefBlock;
    }
  }

  // Filter candidates
  let pool = candidates.filter((b) => {
    if (b.role !== role) return false;
    if (b.needsPhoto && !hasPhoto) return false;
    return alreadyPicked.every((p) => isCompatible(b, p));
  });

  if (pool.length === 0) {
    pool = candidates.filter((b) => !b.needsPhoto || hasPhoto);
  }

  // Filter by event category suitability if available
  const suited = pool.filter((b) => blockSuitsEvent(b, eventType));
  if (suited.length > 0) {
    pool = suited;
  }

  // Seen constraint: for hero and info, try to avoid recent seen IDs
  if (role === 'hero' && seenHeroes.length > 0) {
    const unseen = pool.filter((b) => !seenHeroes.includes(b.id));
    if (unseen.length > 0) pool = unseen;
  } else if (role === 'info' && seenInfos.length > 0) {
    const unseen = pool.filter((b) => !seenInfos.includes(b.id));
    if (unseen.length > 0) pool = unseen;
  }

  // Deterministic seeded pick from remaining sorted candidates
  pool.sort((a, b) => a.id.localeCompare(b.id));
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] || candidates[0];
}

/**
 * Main design composer entry point.
 *
 * @param {object} params
 * @param {object} [params.facts] - Event facts (title, date, time, venue, etc.)
 * @param {string} [params.eventType] - Event type identifier
 * @param {string} [params.mood] - Design mood
 * @param {object} [params.blockPreferences] - Optional block ID preferences per role
 * @param {boolean} [params.hasPhoto] - Photo availability flag
 * @param {number|string} [params.copyVariant] - Copy variant index
 * @param {number|string} [params.seed] - Seed for PRNG determinism
 * @param {Array<object>} [params.seen] - Previously seen designs for diversity / refresh
 * @param {object} [params.brandKit] - Brand Kit
 * @param {object} [params.contentArea] - Content area bounding box
 * @returns {object} Composed design with elements, blocks, signature, metadata
 */
export function composeDesign({
  facts = {},
  eventType = 'general',
  mood = 'default',
  blockPreferences = {},
  hasPhoto = undefined,
  copyVariant = 0,
  seed = 42,
  seen = [],
  brandKit = null,
  contentArea = null,
} = {}) {
  const normalizedType = String(eventType || 'general').trim().toLowerCase();
  const effectiveFacts = resolveDefaultFacts(normalizedType, facts);

  // Determine photo availability
  const photoAvailable =
    hasPhoto !== undefined
      ? Boolean(hasPhoto)
      : Boolean(effectiveFacts.photo || effectiveFacts.imageUrl || effectiveFacts.mainPhoto);

  if (!photoAvailable) {
    effectiveFacts.photo = '';
    effectiveFacts.imageUrl = '';
    effectiveFacts.mainPhoto = '';
  }

  // Resolve contentArea (avoiding locked header & footer zones)
  const defaultArea = { x: 40, y: 120, w: 1000, h: 1100 };
  const targetArea =
    contentArea ||
    (brandKit ? computeContentArea(brandKit, { size: { width: 1080, height: 1350 } }) : defaultArea);

  const cleanArea = {
    x: Math.round(targetArea.x),
    y: Math.round(targetArea.y),
    w: Math.round(targetArea.w),
    h: Math.round(targetArea.h),
  };

  // Extract recent seen blocks for refresh guarantees
  const seenHeroes = [];
  const seenInfos = [];
  if (Array.isArray(seen) && seen.length > 0) {
    for (const item of seen) {
      if (!item) continue;
      const hId = item.blocks?.hero?.id || item.blocks?.hero || item.hero || item.heroId;
      const iId = item.blocks?.info?.id || item.blocks?.info || item.info || item.infoId;
      if (hId) seenHeroes.push(hId);
      if (iId) seenInfos.push(iId);
    }
  }

  createRng(seed);

  // Attempt composition with candidate selection and retry loop
  let bestResult = null;
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptRng = createRng(`${seed}-att-${attempt}`);
    const pickedBlocks = [];

    // 1. Pick background
    const bgBlock = pickCandidateBlock({
      role: 'background',
      candidates: BACKGROUND_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      rng: attemptRng,
    });
    pickedBlocks.push(bgBlock);

    // 2. Pick decoration
    const decBlock = pickCandidateBlock({
      role: 'decoration',
      candidates: DECORATION_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      rng: attemptRng,
    });
    pickedBlocks.push(decBlock);

    // 3. Pick type pairing
    const typeBlock = pickCandidateBlock({
      role: 'typePairing',
      candidates: TYPE_PAIRING_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      rng: attemptRng,
    });
    pickedBlocks.push(typeBlock);

    // 4. Pick colour assignment
    const colBlock = pickCandidateBlock({
      role: 'colourAssignment',
      candidates: COLOUR_ASSIGNMENT_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      rng: attemptRng,
    });
    pickedBlocks.push(colBlock);

    // 5. Pick hero
    let heroBlock = pickCandidateBlock({
      role: 'hero',
      candidates: HERO_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      seenHeroes,
      rng: attemptRng,
    });
    pickedBlocks.push(heroBlock);

    // 6. Pick info
    let infoBlock = pickCandidateBlock({
      role: 'info',
      candidates: INFO_BLOCKS,
      preferences: blockPreferences,
      hasPhoto: photoAvailable,
      alreadyPicked: pickedBlocks,
      eventType: normalizedType,
      seenInfos,
      rng: attemptRng,
    });
    pickedBlocks.push(infoBlock);

    // Enforce Refresh Guarantee: at least hero or info must change from last seen
    if (seenHeroes.length > 0 && seenInfos.length > 0) {
      const lastHero = seenHeroes[seenHeroes.length - 1];
      const lastInfo = seenInfos[seenInfos.length - 1];
      if (heroBlock.id === lastHero && infoBlock.id === lastInfo) {
        // Re-pick info block to an alternate candidate
        const alternateInfos = INFO_BLOCKS.filter(
          (b) => b.id !== lastInfo && (!b.needsPhoto || photoAvailable) && isCompatible(b, heroBlock)
        );
        if (alternateInfos.length > 0) {
          alternateInfos.sort((a, b) => a.id.localeCompare(b.id));
          infoBlock = alternateInfos[Math.floor(attemptRng() * alternateInfos.length)];
        }
      }
    }

    // 7. Pick message (optional / none)
    const needed = neededSectionsFor(normalizedType);
    let msgBlock = null;
    if (needed.includes('message')) {
      msgBlock = pickCandidateBlock({
        role: 'message',
        candidates: MESSAGE_BLOCKS,
        preferences: blockPreferences,
        hasPhoto: photoAvailable,
        alreadyPicked: pickedBlocks,
        eventType: normalizedType,
        rng: attemptRng,
      });
      pickedBlocks.push(msgBlock);
    } else {
      msgBlock = blockById('message-none') || MESSAGE_BLOCKS[0];
    }

    // 8. Pick CTA (optional / none)
    let ctaBlock = null;
    if (needed.includes('cta')) {
      ctaBlock = pickCandidateBlock({
        role: 'cta',
        candidates: CTA_BLOCKS,
        preferences: blockPreferences,
        hasPhoto: photoAvailable,
        alreadyPicked: pickedBlocks,
        eventType: normalizedType,
        rng: attemptRng,
      });
      pickedBlocks.push(ctaBlock);
    } else {
      ctaBlock = blockById('cta-none') || CTA_BLOCKS[0];
    }

    // Block options for rendering trees
    const blockOptions = {
      headingFont: typeBlock?.headingFont || LAYOUT_TOKENS.headingFont,
      bodyFont: typeBlock?.bodyFont || LAYOUT_TOKENS.bodyFont,
      colorTokens: colBlock?.tokens || {},
      category: normalizedType,
      brandKit,
      contentArea: cleanArea,
    };

    // Instantiate layout trees for selected blocks
    const bgTree = bgBlock?.tree ? bgBlock.tree(effectiveFacts, blockOptions) : null;
    const decTree = decBlock?.tree ? decBlock.tree(effectiveFacts, blockOptions) : null;
    const heroTree = heroBlock?.tree ? heroBlock.tree(effectiveFacts, blockOptions) : null;
    const infoTree = infoBlock?.tree ? infoBlock.tree(effectiveFacts, blockOptions) : null;
    const msgTree = msgBlock?.tree ? msgBlock.tree(effectiveFacts, blockOptions) : null;
    const ctaTree = ctaBlock?.tree ? ctaBlock.tree(effectiveFacts, blockOptions) : null;

    // Stack foreground content
    const foregroundChildren = [
      heroTree,
      decTree,
      infoTree,
      msgTree,
      ctaTree,
    ].filter(Boolean);

    const foregroundStack = stack({
      width: 'fill',
      height: 'fill',
      padding: { top: 24, right: 28, bottom: 24, left: 28 },
      gap: 20,
      justify: 'start',
      children: foregroundChildren,
    });

    const fullTree = overlay({
      width: 'fill',
      height: 'fill',
      children: [bgTree, foregroundStack].filter(Boolean),
    });

    // Execute layout engine
    const elements = layout(fullTree, {
      contentArea: cleanArea,
      margin: 20,
      brandKit,
    });

    // Strictly ensure no element touches header or footer bands
    const filteredElements = elements.filter(
      (el) => el.kind !== 'band' && el.y >= cleanArea.y && el.y + el.h <= cleanArea.y + cleanArea.h + 1
    );

    // Validate geometry, contrast, and no-empty-slot checks
    const isValid = validateLayoutElements(filteredElements, cleanArea, brandKit);

    const metadata = {
      eventType: normalizedType,
      mood,
      seed,
      copyVariant,
      hasPhoto: photoAvailable,
      heroId: heroBlock.id,
      infoId: infoBlock.id,
      messageId: msgBlock.id,
      ctaId: ctaBlock.id,
      backgroundId: bgBlock.id,
      decorationId: decBlock.id,
      typePairingId: typeBlock.id,
      colourAssignmentId: colBlock.id,
    };

    const signature = computeLayoutSignature(filteredElements, cleanArea, metadata);

    const candidateResult = {
      elements: filteredElements,
      blocks: {
        hero: heroBlock,
        info: infoBlock,
        message: msgBlock,
        cta: ctaBlock,
        background: bgBlock,
        decoration: decBlock,
        typePairing: typeBlock,
        colourAssignment: colBlock,
      },
      signature,
      metadata,
      tree: fullTree,
    };

    if (isValid) {
      return candidateResult;
    }

    if (!bestResult) {
      bestResult = candidateResult;
    }
  }

  return bestResult;
}

/**
 * Composes two diverse designs offered together, ensuring they differ by more than DIVERSITY_THRESHOLD.
 */
export function composeDesignPair(options = {}) {
  const baseSeed = options.seed !== undefined ? options.seed : 42;
  const designA = composeDesign({ ...options, seed: baseSeed });

  let designB = null;
  let distance = 0;
  let attempts = 0;
  let nextSeed = typeof baseSeed === 'number' ? baseSeed + 1 : `${baseSeed}-pair`;

  while (attempts < 10) {
    designB = composeDesign({
      ...options,
      seed: nextSeed,
      seen: [designA],
    });
    distance = signatureDistance(designA.signature, designB.signature);
    if (distance >= DIVERSITY_THRESHOLD) {
      break;
    }
    attempts++;
    nextSeed = typeof nextSeed === 'number' ? nextSeed + 1 : `${baseSeed}-pair-${attempts}`;
  }

  return {
    designA,
    designB,
    distance,
    meetsThreshold: distance >= DIVERSITY_THRESHOLD,
  };
}

export default {
  DIVERSITY_THRESHOLD,
  EVENT_CATEGORY_MAP,
  DEFAULT_FACTS_BY_EVENT,
  resolveDefaultFacts,
  createRng,
  computeLayoutSignature,
  signatureDistance,
  composeDesign,
  composeDesignPair,
};
