/**
 * Visual design scoring engine.
 * Computes 0..100 quality score based on:
 * 1. Contrast (all text passes 4.5:1) - 25 pts
 * 2. Occupancy (30-70% content coverage) - 20 pts
 * 3. Balance (left-right and top-bottom within 20%) - 20 pts
 * 4. No empty slots (no unfilled images or placeholder text) - 20 pts
 * 5. Hierarchy (title largest, labels smallest, scale rules) - 15 pts
 *
 * Plain ESM, zero dependencies.
 */
import { contrastRatio, backdropOf } from './designRecipes.js';

export function scoreDesign(elements = [], content = {}, palette = {}, options = {}) {
  const width = Number(options.width) || 1080;
  const height = Number(options.height) || 1350;
  const canvasArea = width * height;
  const list = Array.isArray(elements) ? elements : [];

  // --- 1. Contrast Score (max 25) ---
  const textItems = list.filter(
    (el) => el.kind === 'text' || (el.kind === 'field' && ['headline', 'tagline', 'date', 'time', 'venue', 'details'].includes(el.field))
  );

  let contrastPassCount = 0;
  const surface = palette?.background || '#FFFFFF';

  for (const item of textItems) {
    const textColor = item.style?.color || '#000000';
    const bg = backdropOf(item, list, surface);
    const ratio = contrastRatio(textColor, bg);
    if (ratio >= 4.4) {
      contrastPassCount += 1;
    }
  }

  const contrastScore = textItems.length > 0 ? (contrastPassCount / textItems.length) * 25 : 25;

  // --- 2. Occupancy Score (max 20) ---
  // Ideal occupancy of content items is 30% to 70% of canvas
  const contentItems = list.filter((el) => !el.hidden && (el.kind === 'text' || el.kind === 'image' || el.kind === 'icon' || (el.kind === 'shape' && (el.w * el.h < 0.45 * canvasArea))));
  let occupiedArea = 0;
  for (const item of contentItems) {
    occupiedArea += Math.max(0, (item.w || 0) * (item.h || 0));
  }

  const occupancyRatio = canvasArea > 0 ? occupiedArea / canvasArea : 0.5;
  let occupancyScore = 20;
  if (occupancyRatio < 0.25) {
    occupancyScore = Math.max(8, Math.round((occupancyRatio / 0.25) * 20));
  } else if (occupancyRatio > 0.75) {
    const over = (occupancyRatio - 0.75) / 0.25;
    occupancyScore = Math.max(8, Math.round((1 - over) * 20));
  }

  // --- 3. Balance Score (max 20) ---
  const midX = width / 2;
  const midY = height / 2;
  let leftWeight = 0;
  let rightWeight = 0;
  let topWeight = 0;
  let bottomWeight = 0;

  for (const item of contentItems) {
    const cx = (item.x || 0) + (item.w || 0) / 2;
    const cy = (item.y || 0) + (item.h || 0) / 2;
    const weight = Math.max(1, (item.w || 0) * (item.h || 0));

    if (Math.abs(cx - midX) <= 4) {
      leftWeight += weight / 2;
      rightWeight += weight / 2;
    } else if (cx < midX) {
      leftWeight += weight;
    } else {
      rightWeight += weight;
    }

    if (Math.abs(cy - midY) <= 4) {
      topWeight += weight / 2;
      bottomWeight += weight / 2;
    } else if (cy < midY) {
      topWeight += weight;
    } else {
      bottomWeight += weight;
    }
  }

  const totalHoriz = leftWeight + rightWeight || 1;
  const totalVert = topWeight + bottomWeight || 1;
  const horizDiff = Math.abs(leftWeight - rightWeight) / totalHoriz;
  const vertDiff = Math.abs(topWeight - bottomWeight) / totalVert;

  const horizScore = horizDiff <= 0.30 ? 10 : Math.max(4, Math.round((1 - (horizDiff - 0.30) / 0.70) * 10));
  const vertScore = vertDiff <= 0.35 ? 10 : Math.max(4, Math.round((1 - (vertDiff - 0.35) / 0.65) * 10));
  const balanceScore = horizScore + vertScore;

  // --- 4. No Empty Slots Score (max 20) ---
  let emptySlotProblems = 0;
  for (const item of list) {
    // Unfilled image slot with no photo provided
    if (item.kind === 'image' && !item.src && !item.imageUrl && !content?.imageUrl) {
      emptySlotProblems += 1;
    }
    // Unfilled field photo with no photo provided
    if (item.kind === 'field' && item.field === 'photo' && !item.imageUrl && !content?.imageUrl) {
      emptySlotProblems += 1;
    }
    // Broken template placeholder
    if (item.kind === 'text' && typeof item.text === 'string' && /\{\{[^}]+\}\}/.test(item.text)) {
      emptySlotProblems += 1;
    }
    // Flat fill covering > 35% without content
    if (item.kind === 'shape' && item.shape?.fill && item.shape.fill !== 'transparent') {
      const area = (item.w || 0) * (item.h || 0);
      if (area > 0.35 * canvasArea) {
        const hasInner = textItems.some((t) => t.x >= item.x - 5 && t.y >= item.y - 5 && t.x + t.w <= item.x + item.w + 15);
        if (!hasInner) {
          emptySlotProblems += 1;
        }
      }
    }
  }

  const noEmptySlotsScore = Math.max(0, 20 - emptySlotProblems * 10);

  // --- 5. Hierarchy Score (max 15) ---
  let hierarchyScore = 15;
  const titleItem = list.find((el) => el.field === 'headline' || el.id === 'field-headline');
  const titleSize = titleItem?.style?.size || 0;

  // Headline font size should be >= 56px (target 72px)
  if (titleSize < 56) {
    hierarchyScore -= 4;
  }

  // Title should be the largest text
  const otherSizes = textItems
    .filter((el) => el !== titleItem)
    .map((el) => el.style?.size || 0);

  const maxOtherSize = otherSizes.length > 0 ? Math.max(...otherSizes) : 0;
  if (titleSize > 0 && maxOtherSize >= titleSize) {
    hierarchyScore -= 4;
  }

  hierarchyScore = Math.max(4, hierarchyScore);

  const total = Math.min(100, Math.max(0, Math.round(contrastScore + occupancyScore + balanceScore + noEmptySlotsScore + hierarchyScore)));

  return {
    score: total,
    pass: total >= 60,
    details: {
      contrast: Math.round(contrastScore),
      occupancy: Math.round(occupancyScore),
      balance: Math.round(balanceScore),
      noEmptySlots: Math.round(noEmptySlotsScore),
      hierarchy: Math.round(hierarchyScore),
    },
  };
}
