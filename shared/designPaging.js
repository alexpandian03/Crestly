/**
 * /shared/designPaging.js
 *
 * Stateless paging and batch design composition for PosterAI.
 * Isomorphic, pure ESM, zero external dependencies.
 *
 * Rules:
 *  1. Composes up to 12 candidate designs from seed.
 *  2. Pairs each design with the copy variant best suited to its blocks
 *     (quote block gets quote, ribbon block gets ribbonText, etc.).
 *  3. Accepts pageSize (default 2), seed, and seen[] (serialized design signatures).
 *  4. Client sends seen[] and the same seed to get the next page; later pages
 *     reuse the small copyVariants payload so "Show more designs" costs NO AI call.
 *  5. When remaining is 0, recomposes with a new seed and fresh copy variants,
 *     guaranteeing no design whose signature is in seen[] is returned.
 *  6. No preset names returned: display label is strictly "Design N".
 */

import { composeDesign, resolveDefaultFacts } from './designComposer.js';
import { createRuleBasedCopyVariants, createRuleBasedChoices } from './aiChoices.js';
import { extractEventFacts } from './fallbackParser.js';

export const TOTAL_PAGING_DESIGNS = 12;

/**
 * Serializes a design signature into a compact, deterministic string for seen[] tracking.
 */
export function serializeSignature(sig) {
  if (!sig || typeof sig !== 'object') return '';
  const hero = sig.hero || '';
  const info = sig.info || '';
  const bg = sig.background || '';
  const dec = sig.decoration || '';
  const color = sig.colourAssignment || '';
  const type = sig.typePairing || '';
  const gridStr = Array.isArray(sig.grid) ? sig.grid.map((c) => (c ? '1' : '0')).join('') : '';
  return `${hero}|${info}|${bg}|${dec}|${color}|${type}|${gridStr}`;
}

/**
 * Derives a deterministic sub-seed for design index i from a base seed.
 */
export function deriveSeedForIndex(baseSeed = 42, index = 0) {
  if (typeof baseSeed === 'number') {
    return (baseSeed + index * 1337 + 7) >>> 0;
  }
  return `${baseSeed}-sub-${index}`;
}

/**
 * Derives a new distinct base seed when previous pool is exhausted.
 */
export function deriveNextSeed(currentSeed = 42) {
  if (typeof currentSeed === 'number') {
    return (currentSeed + 99991) >>> 0;
  }
  return `${currentSeed}-refresh-${Date.now().toString(36)}`;
}

/**
 * Pairs a composed design with the copy variant that best suits its blocks:
 *  - Quote block (message-quote-card) gets non-empty quote / emotional/formal angle.
 *  - Ribbon block (decoration-divider-wave, decoration-corner-accents, hero-badge-medallion) gets ribbonText.
 *  - Bullets block (message-highlights-bullets) gets bullets.
 *  - Impact / strip block (hero-impact-strip, cta-banner-strip) gets urgent angle.
 */
export function pairDesignWithVariant(design, copyVariants = [], facts = {}, designIndex = 0) {
  const variants = Array.isArray(copyVariants) && copyVariants.length > 0
    ? copyVariants
    : createRuleBasedCopyVariants(facts, 5);

  const blocks = design.blocks || {};
  let bestScore = -1;
  let bestVariant = variants[0];

  for (let vi = 0; vi < variants.length; vi++) {
    const v = variants[vi];
    let score = 0;

    // Quote block preference
    if (blocks.message?.id === 'message-quote-card') {
      if (v.quote && v.quote.trim().length > 0) score += 12;
      if (v.angle === 'emotional' || v.angle === 'formal') score += 4;
    }

    // Ribbon / badge block preference
    if (
      blocks.decoration?.id === 'decoration-divider-wave' ||
      blocks.decoration?.id === 'decoration-corner-accents' ||
      blocks.hero?.id === 'hero-badge-medallion'
    ) {
      if (v.ribbonText && v.ribbonText.trim().length > 0) score += 10;
    }

    // Bullets block preference
    if (blocks.message?.id === 'message-highlights-bullets') {
      if (Array.isArray(v.bullets) && v.bullets.length > 0) score += 8;
    }

    // Urgent / strip preference
    if (blocks.hero?.id === 'hero-impact-strip' || blocks.cta?.id === 'cta-banner-strip') {
      if (v.angle === 'urgent' || v.angle === 'short') score += 6;
    }

    // Diversity distribution across designs
    score += ((vi + designIndex) % variants.length) * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestVariant = v;
    }
  }

  const pairedContent = {
    title: facts.title || 'Event Title',
    subtitle: bestVariant.subtitle || facts.subtitle || '',
    date: facts.date || '',
    time: facts.time || '',
    venue: facts.venue || '',
    details: Array.isArray(bestVariant.bullets) && bestVariant.bullets.length > 0
      ? bestVariant.bullets
      : (facts.details || []),
    contact: facts.contact || '',
    slogan: bestVariant.slogan || { line1: '', line2: '' },
    quote: bestVariant.quote || '',
    cta: bestVariant.cta || { line: '', button: 'Register Now' },
    ribbonText: bestVariant.ribbonText || '',
    language: facts.language || 'en',
    eventType: facts.eventType || 'general',
  };

  return {
    variant: bestVariant,
    content: pairedContent,
  };
}

/**
 * Composes a candidate batch of up to 12 designs from a seed.
 * Each design is paired with its best matching copy variant.
 */
export function composeDesignBatch({
  facts = {},
  eventType = 'general',
  mood = 'default',
  blockPreferences = {},
  copyVariants = [],
  seed = 42,
  totalCount = TOTAL_PAGING_DESIGNS,
  brandKit = null,
  contentArea = null,
} = {}) {
  const cleanFacts = resolveDefaultFacts(eventType, facts);
  const variants = Array.isArray(copyVariants) && copyVariants.length > 0
    ? copyVariants
    : createRuleBasedCopyVariants(cleanFacts, 5);

  const candidates = [];
  const seenInBatch = new Set();

  let i = 0;
  let attempts = 0;
  const maxAttempts = Math.max(100, totalCount * 10);

  while (candidates.length < totalCount && attempts < maxAttempts) {
    const subSeed = deriveSeedForIndex(seed, attempts);
    attempts++;

    // Candidate 0 honors full preferences; subsequent candidates explore structural variations
    const candidatePrefs = i === 0
      ? blockPreferences
      : (i % 3 === 0
          ? { ...blockPreferences, hero: undefined }
          : (i % 2 === 0 ? { ...blockPreferences, info: undefined } : { ...blockPreferences, hero: undefined, info: undefined }));

    const composed = composeDesign({
      facts: cleanFacts,
      eventType,
      mood,
      blockPreferences: candidatePrefs,
      seed: subSeed,
      brandKit,
      contentArea,
    });

    const sigStr = serializeSignature(composed.signature);
    if (!seenInBatch.has(sigStr)) {
      seenInBatch.add(sigStr);
      const paired = pairDesignWithVariant(composed, variants, cleanFacts, i);
      candidates.push({
        design: composed,
        sigStr,
        variant: paired.variant,
        pairedContent: paired.content,
        batchIndex: i,
      });
      i++;
    }
  }

  return candidates;
}

/**
 * Resolves paged options against seen[] signatures:
 *  - Skips any design whose signature is in seen[].
 *  - Returns pageSize items with display label "Design N".
 *  - Calculates remaining count.
 */
export function resolvePagedOptions({
  candidates = [],
  pageSize = 2,
  seen = [],
  mood = 'modern',
  reason = 'Selected based on event details and design structure.',
  seenCount = 0,
} = {}) {
  const seenSet = new Set(Array.isArray(seen) ? seen : []);
  const size = Math.max(1, Math.min(12, Number(pageSize) || 2));

  // Filter candidates not yet seen
  const unseen = candidates.filter((c) => !seenSet.has(c.sigStr));

  // Pick up to pageSize items
  const picked = unseen.slice(0, size);
  const remaining = Math.max(0, unseen.length - picked.length);

  const options = picked.map((item, idx) => {
    const displayNum = seenCount + idx + 1;
    return {
      id: `design-${displayNum}`,
      label: `Design ${displayNum}`,
      design: {
        elements: item.design.elements,
        signature: item.sigStr,
        blocks: {
          hero: item.design.blocks?.hero?.id,
          info: item.design.blocks?.info?.id,
          message: item.design.blocks?.message?.id,
          cta: item.design.blocks?.cta?.id,
          background: item.design.blocks?.background?.id,
          decoration: item.design.blocks?.decoration?.id,
          typePairing: item.design.blocks?.typePairing?.id,
          colourAssignment: item.design.blocks?.colourAssignment?.id,
        },
      },
      content: item.pairedContent,
      mood: mood || 'modern',
      reason: reason || 'Selected based on event details and design structure.',
      angle: item.variant?.angle || 'formal',
    };
  });

  return {
    options,
    total: TOTAL_PAGING_DESIGNS,
    remaining,
    unseenCount: unseen.length,
  };
}

export default {
  TOTAL_PAGING_DESIGNS,
  serializeSignature,
  deriveSeedForIndex,
  deriveNextSeed,
  pairDesignWithVariant,
  composeDesignBatch,
  resolvePagedOptions,
};
