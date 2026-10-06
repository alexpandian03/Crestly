import { ELEMENT_LIMITS, clampRectToArea } from '../../../shared/templateElements.js';

/* ------------------------------------------------------------------ *
 * Smart guides for the editor canvas.
 *
 * Everything here works in poster pixels. The canvas only ever hands over the box it is
 * drawing, the list of items, and how far a point may reach, so the numbers a drag commits
 * are the same whether the guide fired or not.
 * ------------------------------------------------------------------ */

/** How close an edge has to get, in poster pixels, before it sticks. */
export const SNAP_PX = 6;

/** The two grid spacings: a fine one to place by, and a bold one every fifth line. */
export const GRID_STEP = 10;
export const GRID_MAJOR = 50;

const GRID_FINE = 'rgba(100,116,139,0.18)';
const GRID_BOLD = 'rgba(71,85,105,0.30)';

function whole(value) {
  return Math.round(Number(value) || 0);
}

/** Keeps a list of poster pixels sorted, with no two lines a pixel apart. */
function only(values) {
  const seen = new Set();
  const list = [];
  values.forEach((value) => {
    if (!Number.isFinite(value)) return;
    const px = whole(value);
    if (seen.has(px)) return;
    seen.add(px);
    list.push(px);
  });
  return list.sort((a, b) => a - b);
}

function edges(lo, span) {
  return [lo, lo + span / 2, lo + span];
}

/**
 * Every line a drag may stick to: the poster down the middle, the four edges and the middle
 * of the space the brand leaves for the poster's own words, and the edges and centres of every
 * other item that is currently visible.
 */
export function guideTargets(area, items, excludeId, { width, height, hidden } = {}) {
  const vertical = [];
  const horizontal = [];

  if (Number.isFinite(width)) vertical.push(whole(width / 2));
  if (Number.isFinite(height)) horizontal.push(whole(height / 2));

  if (area) {
    vertical.push(...edges(area.x, area.w));
    horizontal.push(...edges(area.y, area.h));
  }

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || item.id === excludeId) return;
    if (hidden?.has?.(item.id)) return;
    vertical.push(...edges(item.x, item.w));
    horizontal.push(...edges(item.y, item.h));
  });

  return { vertical: only(vertical), horizontal: only(horizontal), bounds: area || null };
}

/** The nearest value in `list` to `point`, or null when nothing is within reach. */
function reach(point, list, limit) {
  if (!(list && list.length) || !(limit > 0)) return null;
  let best = null;
  let bestBy = limit + 1;
  for (let i = 0; i < list.length; i += 1) {
    const by = Math.abs(list[i] - point);
    if (by < bestBy) {
      bestBy = by;
      best = list[i];
    }
  }
  return bestBy <= limit ? best : null;
}

/**
 * Bring the box onto a guide and hand back the lines it used so the canvas can draw them.
 *
 * While a box is being moved the whole thing slides, so its left edge, its middle and its
 * right edge all count. While an edge is being pulled only that edge is free, so only it may
 * jump and the opposite one stays exactly where the pointer left it.
 */
export function nearestSnap(rect, targets, limitPx = SNAP_PX, gesture = null) {
  const guides = { vertical: [], horizontal: [] };
  if (!rect) return { rect, guides };
  const list = targets || {};
  const vertical = list.vertical || [];
  const horizontal = list.horizontal || [];
  const next = { x: whole(rect.x), y: whole(rect.y), w: whole(rect.w), h: whole(rect.h) };
  if (!(limitPx > 0)) return { rect: next, guides };

  const resizing = gesture?.mode === 'resize' ? gesture.handle || '' : '';
  const pull = (point, lines) => reach(point, lines, limitPx);

  if (resizing) {
    const right = rect.x + rect.w;
    const bottom = rect.y + rect.h;
    if (resizing.includes('w')) {
      const hit = pull(next.x, vertical);
      if (hit !== null && right - hit >= ELEMENT_LIMITS.minWidth) {
        next.x = hit;
        next.w = whole(right - hit);
        guides.vertical.push(hit);
      }
    } else if (resizing.includes('e')) {
      const hit = pull(right, vertical);
      if (hit !== null && hit - next.x >= ELEMENT_LIMITS.minWidth) {
        next.w = whole(hit - next.x);
        guides.vertical.push(hit);
      }
    }
    if (resizing.includes('n')) {
      const hit = pull(next.y, horizontal);
      if (hit !== null && bottom - hit >= ELEMENT_LIMITS.minHeight) {
        next.y = hit;
        next.h = whole(bottom - hit);
        guides.horizontal.push(hit);
      }
    } else if (resizing.includes('s')) {
      const hit = pull(bottom, horizontal);
      if (hit !== null && hit - next.y >= ELEMENT_LIMITS.minHeight) {
        next.h = whole(hit - next.y);
        guides.horizontal.push(hit);
      }
    }
  } else {
    let sideways = null;
    let downward = null;
    [0, next.w / 2, next.w].forEach((offset) => {
      const point = next.x + offset;
      const hit = pull(point, vertical);
      if (hit === null) return;
      const move = hit - point;
      if (sideways === null || Math.abs(move) < Math.abs(sideways.move)) sideways = { move, hit };
    });
    if (sideways) {
      next.x = whole(next.x + sideways.move);
      guides.vertical.push(sideways.hit);
    }
    [0, next.h / 2, next.h].forEach((offset) => {
      const point = next.y + offset;
      const hit = pull(point, horizontal);
      if (hit === null) return;
      const move = hit - point;
      if (downward === null || Math.abs(move) < Math.abs(downward.move)) downward = { move, hit };
    });
    if (downward) {
      next.y = whole(next.y + downward.move);
      guides.horizontal.push(downward.hit);
    }
  }

  /* A guide can pull a box a few pixels past the edge of the space items live in; that wins. */
  if (list.bounds) {
    const boxed = clampRectToArea(next, list.bounds);
    const moved = boxed.x !== next.x || boxed.y !== next.y || boxed.w !== next.w || boxed.h !== next.h;
    if (moved) {
      Object.assign(next, boxed);
      guides.vertical = guides.vertical.filter((v) => v >= next.x && v <= next.x + next.w);
      guides.horizontal = guides.horizontal.filter((v) => v >= next.y && v <= next.y + next.h);
    }
  }
  return { rect: next, guides };
}

/** A 10 px grid with a bold line every 50 px, drawn at whatever zoom is on screen. */
export function gridBackgroundImage(size, scale) {
  const fine = Math.max(1, GRID_STEP * scale);
  const major = Math.max(1, GRID_MAJOR * scale);
  const line = (color) => `linear-gradient(to right, ${color} 1px, transparent 1px)`;
  const row = (color) => `linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
  return {
    backgroundImage: `${row(GRID_FINE)}, ${line(GRID_FINE)}, ${row(GRID_BOLD)}, ${line(GRID_BOLD)}`,
    backgroundSize: `${fine}px ${fine}px, ${fine}px ${fine}px, ${major}px ${major}px, ${major}px ${major}px`,
  };
}
