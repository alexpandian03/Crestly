/**
 * /shared/layoutEngine.js
 *
 * Pure, deterministic layout engine for PosterAI.
 * Generates absolute poster element arrays within the content area and brand margins.
 *
 * Containers:
 *  - stack (vertical column layout)
 *  - row (horizontal row layout)
 *  - grid (multi-column grid layout)
 *  - overlay (layered/stacked z-index layout)
 *
 * Container Options:
 *  - gap: number or { row, col }
 *  - padding: number or { top, right, bottom, left } or { x, y }
 *  - align: cross-axis alignment ('start' | 'center' | 'end' | 'stretch')
 *  - justify: main-axis alignment ('start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly')
 *  - size / width / height: 'fill' | 'fit' | number
 *  - minWidth, maxWidth, minHeight, maxHeight: number constraints
 *  - flexGrow: weight (number >= 0) for absorbing leftover space
 *
 * Leaves:
 *  - text, image, shape, icon, divider
 *
 * Rules:
 *  1. Empty leaves are removed before layout.
 *  2. A container whose children are all empty collapses completely (no empty box, band or divider).
 *  3. Leftover vertical space in stack/root goes to flex-grow children so there are no large gaps.
 *  4. Output is an array of standard element items (x, y, w, h, z, style...) strictly inside
 *     the content area, respecting brand margins, with brand tokens only. Never writes into
 *     header or footer zones.
 *  5. Pure & deterministic: same input produces identical output.
 */

import {
  contentArea,
  clampRectToArea,
  ELEMENT_LIMITS,
  RULE_THICKNESS,
} from './templateElements.js';
import {
  textFit,
  wrapWords,
  getFontRatio,
  charWidthFor,
  fitPrioritizedFields,
  FIELD_PRIORITY,
  PRIORITY_ORDER,
  getPriority,
} from './textFit.js';

// Default brand tokens
export const LAYOUT_TOKENS = {
  primary: 'brand:primary',
  secondary: 'brand:secondary',
  accent: 'brand:accent',
  text: 'brand:text',
  background: 'brand:background',
  headingFont: 'brand:heading',
  bodyFont: 'brand:body',
};

/** Normalize padding option into { top, right, bottom, left } */
export function normalizePadding(pad) {
  if (typeof pad === 'number') {
    const p = Math.max(0, Math.round(pad));
    return { top: p, right: p, bottom: p, left: p };
  }
  if (pad && typeof pad === 'object') {
    const top = Math.max(0, Math.round(pad.top ?? pad.y ?? 0));
    const bottom = Math.max(0, Math.round(pad.bottom ?? pad.y ?? 0));
    const left = Math.max(0, Math.round(pad.left ?? pad.x ?? 0));
    const right = Math.max(0, Math.round(pad.right ?? pad.x ?? 0));
    return { top, right, bottom, left };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

/** Normalize gap option into { row, col } */
export function normalizeGap(gap) {
  if (typeof gap === 'number') {
    const g = Math.max(0, Math.round(gap));
    return { row: g, col: g };
  }
  if (gap && typeof gap === 'object') {
    const row = Math.max(0, Math.round(gap.row ?? gap.y ?? gap.gap ?? 0));
    const col = Math.max(0, Math.round(gap.col ?? gap.x ?? gap.gap ?? 0));
    return { row, col };
  }
  return { row: 0, col: 0 };
}

/** Check if a leaf node is empty */
export function isEmptyLeaf(node) {
  if (!node || typeof node !== 'object') return true;
  const type = String(node.type || node.kind || '').toLowerCase();

  if (type === 'text' || type === 'field') {
    const val = node.text !== undefined ? node.text : (node.content !== undefined ? node.content : node.value);
    if (val == null) return true;
    if (Array.isArray(val)) {
      return val.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).length === 0;
    }
    return String(val).trim().length === 0;
  }

  if (type === 'image') {
    const url = node.imageUrl || node.src || node.url || node.content;
    return !url || String(url).trim().length === 0;
  }

  if (type === 'icon') {
    const name = node.name || node.icon || node.content;
    return !name || String(name).trim().length === 0;
  }

  if (type === 'shape') {
    if (node.isDivider) return false;
    if (node.autoCollapse && !node.fill && !node.shape?.fill && !node.content) return true;
    return false;
  }

  if (type === 'divider') {
    return false; // Evaluated in container pruning context
  }

  return false;
}

/** Prunes empty leaves and collapses containers with no content children */
export function pruneTree(node) {
  if (!node || typeof node !== 'object') return null;
  const type = String(node.type || node.kind || '').toLowerCase();
  const isContainer = ['stack', 'row', 'grid', 'overlay'].includes(type);

  if (!isContainer) {
    if (isEmptyLeaf(node)) return null;
    return { ...node, type };
  }

  const rawChildren = Array.isArray(node.children) ? node.children : [];
  const prunedChildren = [];

  for (const child of rawChildren) {
    const prunedChild = pruneTree(child);
    if (prunedChild) {
      prunedChildren.push(prunedChild);
    }
  }

  // Remove dangling or redundant consecutive dividers
  const cleanedChildren = [];
  for (let i = 0; i < prunedChildren.length; i++) {
    const c = prunedChildren[i];
    const isDiv = c.type === 'divider' || c.isDivider;
    if (isDiv) {
      const prevIsContent =
        cleanedChildren.length > 0 &&
        !(cleanedChildren[cleanedChildren.length - 1].type === 'divider' || cleanedChildren[cleanedChildren.length - 1].isDivider);
      const nextIsContent = prunedChildren
        .slice(i + 1)
        .some((n) => !(n.type === 'divider' || n.isDivider));
      if (prevIsContent && nextIsContent) {
        cleanedChildren.push(c);
      }
    } else {
      cleanedChildren.push(c);
    }
  }

  // If container has no content children (excluding pure dividers/backgrounds), it collapses!
  const contentChildren = cleanedChildren.filter((c) => !(c.type === 'divider' || c.isDivider));
  if (contentChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    type,
    children: cleanedChildren,
  };
}

/** Deterministic text height estimation using textFit */
export function estimateTextHeight(textVal, width, style = {}, options = {}) {
  const w = Math.max(10, width);
  const size = Math.max(10, Number(style.size || style.fontSize) || 28);
  const font = style.fontFamily || style.font || 'Inter';
  const isHeading = Boolean(options.role === 'heading' || options.role === 'headline' || style.isHeading);
  const role = options.role || (isHeading ? 'headline' : 'regular');

  const fit = textFit(textVal, font, size, w, {
    lineHeight: style.lineHeight,
    weight: style.weight,
    uppercase: style.uppercase,
    letterSpacing: style.letterSpacing,
    role,
    isHeadline: isHeading,
    ...options,
  });

  return fit.height;
}

/**
 * Internal recursive layout calculation.
 * Returns { rect: { x, y, w, h }, elements: [] }
 */
function layoutNode(node, availableBox, context) {
  const { idCounter } = context;
  const nextId = (prefix) => {
    idCounter.val += 1;
    return `${prefix}-${idCounter.val}`;
  };

  const type = String(node.type || node.kind || '').toLowerCase();
  const isContainer = ['stack', 'row', 'grid', 'overlay'].includes(type);

  // Min / Max constraints
  const minW = Math.max(0, Number(node.minWidth) || 0);
  const maxW = Math.max(minW, Number(node.maxWidth) || Number.POSITIVE_INFINITY);
  const minH = Math.max(0, Number(node.minHeight) || 0);
  const maxH = Math.max(minH, Number(node.maxHeight) || Number.POSITIVE_INFINITY);

  if (!isContainer) {
    // LEAF ELEMENT
    let w = availableBox.w > 0 ? availableBox.w : (typeof node.width === 'number' ? node.width : 100);
    w = Math.min(maxW, Math.max(minW, w));

    let h = availableBox.h;
    if (availableBox.h > 0) {
      h = availableBox.h;
    } else if (typeof node.height === 'number') {
      h = node.height;
    } else if (node.height === 'fill') {
      h = availableBox.h;
    } else if (type === 'text' || type === 'field') {
      const val = node.text !== undefined ? node.text : (node.content !== undefined ? node.content : node.value);
      const isHeading = Boolean(node.role === 'heading' || node.role === 'headline' || node.style?.isHeading);
      const font = (node.style && (node.style.fontFamily || node.style.font)) || (isHeading ? LAYOUT_TOKENS.headingFont : LAYOUT_TOKENS.bodyFont);
      const initialSize = Math.max(10, Number(node.style?.size || node.style?.fontSize) || (isHeading ? 48 : 24));
      const fit = textFit(val, font, initialSize, w, {
        role: node.role || (isHeading ? 'headline' : 'regular'),
        isHeadline: isHeading,
        lineHeight: node.style?.lineHeight,
        weight: node.style?.weight,
        uppercase: node.style?.uppercase,
        letterSpacing: node.style?.letterSpacing,
        maxLines: node.maxLines,
        maxHeight: maxH !== Number.POSITIVE_INFINITY ? maxH : undefined,
      });
      h = fit.height;
      node._fitted = fit;
    } else if (type === 'divider') {
      h = typeof node.thickness === 'number' ? node.thickness : 2;
    } else if (type === 'icon') {
      h = typeof node.size === 'number' ? node.size : Math.min(w, 48);
      w = h;
    } else if (type === 'image') {
      h = typeof node.height === 'number' ? node.height : Math.round(w * 0.75);
    } else if (type === 'shape') {
      h = typeof node.height === 'number' ? node.height : Math.round(w * 0.5);
    }

    h = Math.min(maxH, Math.max(minH, h));

    const elemId = node.id || nextId(type);
    const rect = { x: availableBox.x, y: availableBox.y, w, h };

    const element = buildLeafElement(node, rect, elemId, context);
    return {
      rect,
      elements: element ? [element] : [],
    };
  }

  // CONTAINER LAYOUT
  const padding = normalizePadding(node.padding);
  const gap = normalizeGap(node.gap);
  const children = Array.isArray(node.children) ? node.children : [];

  let containerW = availableBox.w;
  if (typeof node.width === 'number') {
    containerW = node.width;
  } else if (node.width === 'fill') {
    containerW = availableBox.w;
  }
  containerW = Math.min(maxW, Math.max(minW, containerW));

  const innerW = Math.max(0, containerW - padding.left - padding.right);
  const innerX = availableBox.x + padding.left;
  const innerY = availableBox.y + padding.top;

  let containerH = availableBox.h;
  const isFillH = node.height === 'fill';
  if (typeof node.height === 'number') {
    containerH = node.height;
  }

  let childPlacements = [];
  let contentHeight = 0;

  if (type === 'stack') {
    // 1. Measure base heights
    const measured = [];
    let totalBaseH = 0;
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      let chW = innerW;
      if (typeof ch.width === 'number') {
        chW = Math.min(innerW, ch.width);
      }
      const isFill = ch.height === 'fill';
      let chH = 0;
      if (typeof ch.height === 'number') {
        chH = ch.height;
      } else if (isFill) {
        chH = 0;
      } else if (['stack', 'row', 'grid', 'overlay'].includes(ch.type || ch.kind)) {
        // Measure container child tentatively
        const tentative = layoutNode(ch, { x: innerX, y: innerY, w: chW, h: 0 }, context);
        chH = tentative.rect.h;
      } else if (ch.type === 'text' || ch.kind === 'text' || ch.type === 'field') {
        const val = ch.text !== undefined ? ch.text : (ch.content !== undefined ? ch.content : ch.value);
        const isHeading = Boolean(ch.role === 'heading' || ch.role === 'headline' || ch.style?.isHeading);
        const font = (ch.style && (ch.style.fontFamily || ch.style.font)) || (isHeading ? LAYOUT_TOKENS.headingFont : LAYOUT_TOKENS.bodyFont);
        const initialSize = Math.max(10, Number(ch.style?.size || ch.style?.fontSize) || (isHeading ? 48 : 24));
        const fit = textFit(val, font, initialSize, chW, {
          role: ch.role || (isHeading ? 'headline' : 'regular'),
          isHeadline: isHeading,
          lineHeight: ch.style?.lineHeight,
          weight: ch.style?.weight,
          uppercase: ch.style?.uppercase,
          letterSpacing: ch.style?.letterSpacing,
          maxLines: ch.maxLines,
        });
        chH = fit.height;
        ch._fitted = fit;
      } else if (ch.type === 'divider' || ch.isDivider) {
        chH = typeof ch.thickness === 'number' ? ch.thickness : 2;
      } else if (ch.type === 'icon') {
        chH = typeof ch.size === 'number' ? ch.size : 48;
      } else if (ch.type === 'image') {
        chH = typeof ch.height === 'number' ? ch.height : Math.round(chW * 0.7);
      } else if (ch.type === 'shape') {
        chH = typeof ch.height === 'number' ? ch.height : 40;
      }

      const chMinH = Math.max(0, Number(ch.minHeight) || 0);
      const chMaxH = Math.max(chMinH, Number(ch.maxHeight) || Number.POSITIVE_INFINITY);
      chH = Math.min(chMaxH, Math.max(chMinH, chH));

      const flexGrow = ch.flexGrow !== undefined
        ? Math.max(0, Number(ch.flexGrow) || 0)
        : (isFill ? 1 : 0);

      measured.push({ node: ch, w: chW, h: chH, flexGrow });
      totalBaseH += chH;
    }

    const totalGaps = gap.row * Math.max(0, children.length - 1);
    const innerAvailableH = isFillH || typeof node.height === 'number' ? Math.max(0, containerH - padding.top - padding.bottom) : totalBaseH + totalGaps;
    const leftoverH = Math.max(0, innerAvailableH - (totalBaseH + totalGaps));

    // Distribute leftover vertical space to flex-grow children
    const totalFlex = measured.reduce((sum, item) => sum + item.flexGrow, 0);
    if (leftoverH > 0 && totalFlex > 0) {
      let distributed = 0;
      const flexIndices = [];
      for (let i = 0; i < measured.length; i++) {
        if (measured[i].flexGrow > 0) flexIndices.push(i);
      }

      for (let j = 0; j < flexIndices.length; j++) {
        const idx = flexIndices[j];
        const isLast = j === flexIndices.length - 1;
        const add = isLast
          ? leftoverH - distributed
          : Math.round(leftoverH * (measured[idx].flexGrow / totalFlex));
        measured[idx].h += add;
        distributed += add;
      }
    }

    // Justify alignment if no flex absorbed leftover space
    let curY = innerY;
    let effectiveGap = gap.row;
    if (leftoverH > 0 && totalFlex === 0) {
      const justify = node.justify || 'start';
      if (justify === 'center') {
        curY += Math.round(leftoverH / 2);
      } else if (justify === 'end') {
        curY += leftoverH;
      } else if (justify === 'space-between' && children.length > 1) {
        effectiveGap += leftoverH / (children.length - 1);
      } else if (justify === 'space-around') {
        const share = leftoverH / children.length;
        curY += Math.round(share / 2);
        effectiveGap += share;
      } else if (justify === 'space-evenly') {
        const share = leftoverH / (children.length + 1);
        curY += Math.round(share);
        effectiveGap += share;
      }
    }

    // Position children
    for (let i = 0; i < measured.length; i++) {
      const m = measured[i];
      const align = m.node.alignSelf || node.align || 'stretch';
      let chX = innerX;
      if (align === 'center') {
        chX = innerX + Math.round((innerW - m.w) / 2);
      } else if (align === 'end') {
        chX = innerX + (innerW - m.w);
      }

      childPlacements.push({
        node: m.node,
        box: { x: chX, y: Math.round(curY), w: m.w, h: m.h },
      });

      curY += m.h + effectiveGap;
    }

    contentHeight = curY - innerY - effectiveGap;

  } else if (type === 'row') {
    // ROW (horizontal)
    const measured = [];
    let totalBaseW = 0;
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      const isFillW = ch.width === 'fill';
      let chW = 0;
      if (typeof ch.width === 'number') {
        chW = ch.width;
      } else if (isFillW) {
        chW = 0;
      } else if (ch.type === 'divider' || ch.isDivider) {
        chW = typeof ch.thickness === 'number' ? ch.thickness : 2;
      } else if (ch.type === 'icon') {
        chW = typeof ch.size === 'number' ? ch.size : 48;
      } else {
        chW = Math.max(ELEMENT_LIMITS.minWidth, Math.round(innerW / Math.max(1, children.length)));
      }

      const chMinW = Math.max(0, Number(ch.minWidth) || 0);
      const chMaxW = Math.max(chMinW, Number(ch.maxWidth) || Number.POSITIVE_INFINITY);
      chW = Math.min(chMaxW, Math.max(chMinW, chW));

      let chH = isFillH ? containerH - padding.top - padding.bottom : 0;
      if (typeof ch.height === 'number') chH = ch.height;

      const flexGrow = ch.flexGrow !== undefined
        ? Math.max(0, Number(ch.flexGrow) || 0)
        : (isFillW ? 1 : 0);

      measured.push({ node: ch, w: chW, h: chH, flexGrow });
      totalBaseW += chW;
    }

    const totalGaps = gap.col * Math.max(0, children.length - 1);
    const leftoverW = Math.max(0, innerW - (totalBaseW + totalGaps));

    const totalFlex = measured.reduce((sum, item) => sum + item.flexGrow, 0);
    if (leftoverW > 0 && totalFlex > 0) {
      let distributed = 0;
      const flexIndices = [];
      for (let i = 0; i < measured.length; i++) {
        if (measured[i].flexGrow > 0) flexIndices.push(i);
      }
      for (let j = 0; j < flexIndices.length; j++) {
        const idx = flexIndices[j];
        const isLast = j === flexIndices.length - 1;
        const add = isLast
          ? leftoverW - distributed
          : Math.round(leftoverW * (measured[idx].flexGrow / totalFlex));
        measured[idx].w += add;
        distributed += add;
      }
    }

    let curX = innerX;
    let effectiveGap = gap.col;
    if (leftoverW > 0 && totalFlex === 0) {
      const justify = node.justify || 'start';
      if (justify === 'center') curX += Math.round(leftoverW / 2);
      else if (justify === 'end') curX += leftoverW;
      else if (justify === 'space-between' && children.length > 1) effectiveGap += leftoverW / (children.length - 1);
    }

    let maxRowChildH = 0;
    for (let i = 0; i < measured.length; i++) {
      const m = measured[i];
      const targetH = isFillH ? containerH - padding.top - padding.bottom : (m.h || 40);
      maxRowChildH = Math.max(maxRowChildH, targetH);

      childPlacements.push({
        node: m.node,
        box: { x: Math.round(curX), y: innerY, w: m.w, h: targetH },
      });
      curX += m.w + effectiveGap;
    }

    contentHeight = maxRowChildH;

  } else if (type === 'grid') {
    // GRID
    const cols = Math.max(1, Math.round(Number(node.columns) || 2));
    const colW = Math.max(10, Math.round((innerW - gap.col * (cols - 1)) / cols));

    let curX = innerX;
    let curY = innerY;
    let rowMaxH = 0;

    for (let i = 0; i < children.length; i++) {
      const colIndex = i % cols;
      if (colIndex === 0 && i > 0) {
        curY += rowMaxH + gap.row;
        curX = innerX;
        rowMaxH = 0;
      }

      const ch = children[i];
      let chH = 60;
      if (typeof ch.height === 'number') {
        chH = ch.height;
      } else if (ch.type === 'text' || ch.kind === 'text' || ch.type === 'field') {
        const val = ch.text !== undefined ? ch.text : (ch.content !== undefined ? ch.content : ch.value);
        const isHeading = Boolean(ch.role === 'heading' || ch.role === 'headline' || ch.style?.isHeading);
        const font = (ch.style && (ch.style.fontFamily || ch.style.font)) || (isHeading ? LAYOUT_TOKENS.headingFont : LAYOUT_TOKENS.bodyFont);
        const initialSize = Math.max(10, Number(ch.style?.size || ch.style?.fontSize) || (isHeading ? 48 : 24));
        const fit = textFit(val, font, initialSize, colW, {
          role: ch.role || (isHeading ? 'headline' : 'regular'),
          isHeadline: isHeading,
          lineHeight: ch.style?.lineHeight,
          weight: ch.style?.weight,
          uppercase: ch.style?.uppercase,
          letterSpacing: ch.style?.letterSpacing,
          maxLines: ch.maxLines,
        });
        chH = fit.height;
        ch._fitted = fit;
      }
      rowMaxH = Math.max(rowMaxH, chH);

      childPlacements.push({
        node: ch,
        box: { x: curX, y: curY, w: colW, h: chH },
      });

      curX += colW + gap.col;
    }
    contentHeight = (curY + rowMaxH) - innerY;

  } else if (type === 'overlay') {
    // OVERLAY (layered)
    let maxOverlayH = 0;
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      const chW = typeof ch.width === 'number' ? Math.min(innerW, ch.width) : innerW;
      let chH = 100;
      if (typeof ch.height === 'number') {
        chH = ch.height;
      } else if (isFillH) {
        chH = containerH - padding.top - padding.bottom;
      } else if (['stack', 'row', 'grid', 'overlay'].includes(ch.type || ch.kind)) {
        const tentative = layoutNode(ch, { x: innerX, y: innerY, w: chW, h: 0 }, context);
        chH = tentative.rect.h;
      } else if (ch.type === 'text' || ch.kind === 'text' || ch.type === 'field') {
        const val = ch.text !== undefined ? ch.text : (ch.content !== undefined ? ch.content : ch.value);
        const isHeading = Boolean(ch.role === 'heading' || ch.role === 'headline' || ch.style?.isHeading);
        const font = (ch.style && (ch.style.fontFamily || ch.style.font)) || (isHeading ? LAYOUT_TOKENS.headingFont : LAYOUT_TOKENS.bodyFont);
        const initialSize = Math.max(10, Number(ch.style?.size || ch.style?.fontSize) || (isHeading ? 48 : 24));
        const fit = textFit(val, font, initialSize, chW, {
          role: ch.role || (isHeading ? 'headline' : 'regular'),
          isHeadline: isHeading,
          lineHeight: ch.style?.lineHeight,
          weight: ch.style?.weight,
          uppercase: ch.style?.uppercase,
          letterSpacing: ch.style?.letterSpacing,
          maxLines: ch.maxLines,
        });
        chH = fit.height;
        ch._fitted = fit;
      }
      maxOverlayH = Math.max(maxOverlayH, chH);

      const align = ch.align || node.align || 'center';
      const justify = ch.justify || node.justify || 'center';

      let chX = innerX;
      if (align === 'center') chX = innerX + Math.round((innerW - chW) / 2);
      else if (align === 'end') chX = innerX + (innerW - chW);

      let chY = innerY;
      const targetBoxH = isFillH ? containerH - padding.top - padding.bottom : maxOverlayH;
      if (justify === 'center') chY = innerY + Math.round((targetBoxH - chH) / 2);
      else if (justify === 'end') chY = innerY + (targetBoxH - chH);

      childPlacements.push({
        node: ch,
        box: { x: chX, y: chY, w: chW, h: chH },
        overlayIndex: i,
      });
    }
    contentHeight = maxOverlayH;
  }

  // Final container dimensions
  let finalH = isFillH || typeof node.height === 'number'
    ? containerH
    : contentHeight + padding.top + padding.bottom;
  finalH = Math.min(maxH, Math.max(minH, finalH));

  const containerRect = {
    x: availableBox.x,
    y: availableBox.y,
    w: containerW,
    h: finalH,
  };

  // Build container background element if specified
  const elements = [];
  if (node.background) {
    const bg = node.background;
    elements.push({
      id: `${node.id || nextId(type)}-bg`,
      kind: 'shape',
      x: containerRect.x,
      y: containerRect.y,
      w: containerRect.w,
      h: containerRect.h,
      z: Number(node.z || 2),
      locked: true,
      style: {
        color: LAYOUT_TOKENS.secondary,
        radius: Number(bg.radius ?? node.style?.radius ?? 0),
        opacity: Number(bg.opacity ?? 1),
      },
      shape: {
        type: bg.type || 'rect',
        fill: bg.fill || LAYOUT_TOKENS.secondary,
        stroke: bg.stroke || '',
        strokeWidth: Number(bg.strokeWidth || 0),
      },
    });
  }

  // Recursively layout children
  for (const placement of childPlacements) {
    const chResult = layoutNode(placement.node, placement.box, context);
    if (chResult && chResult.elements.length > 0) {
      if (type === 'overlay' && placement.overlayIndex !== undefined) {
        for (const el of chResult.elements) {
          el.z = (el.z || 10) + placement.overlayIndex;
        }
      }
      elements.push(...chResult.elements);
    }
  }

  return {
    rect: containerRect,
    elements,
  };
}

/** Builds a standardized element from a leaf node */
function buildLeafElement(node, rect, elemId, _context) {
  const type = String(node.type || node.kind || '').toLowerCase();
  const z = Number(node.z || 10);
  const locked = Boolean(node.locked);
  const userStyle = node.style || {};

  if (type === 'text' || type === 'field') {
    const textVal = node.text !== undefined ? node.text : (node.content !== undefined ? node.content : node.value);
    const content = Array.isArray(textVal) ? textVal : String(textVal || '').trim();
    const isHeading = Boolean(node.role === 'heading' || node.role === 'headline' || userStyle.isHeading);
    const font = userStyle.fontFamily || (isHeading ? LAYOUT_TOKENS.headingFont : LAYOUT_TOKENS.bodyFont);
    const initialSize = Math.max(10, Number(userStyle.size || userStyle.fontSize) || (isHeading ? 48 : 24));

    const fit = node._fitted || textFit(content, font, initialSize, rect.w, {
      role: node.role || (isHeading ? 'headline' : 'regular'),
      isHeadline: isHeading,
      lineHeight: userStyle.lineHeight,
      weight: userStyle.weight,
      uppercase: userStyle.uppercase,
      letterSpacing: userStyle.letterSpacing,
      maxLines: node.maxLines,
      maxHeight: rect.h > 0 ? rect.h : undefined,
    });

    const finalText = (fit.lines && fit.lines.length > 0)
      ? fit.lines.join('\n')
      : (Array.isArray(content) ? content.join('\n') : content);

    return {
      id: elemId,
      kind: node.field ? 'field' : 'text',
      role: node.role || (isHeading ? 'headline' : undefined),
      field: node.field,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h > 0 ? rect.h : fit.height,
      z,
      locked,
      text: finalText,
      variable: Boolean(node.variable),
      key: node.key,
      label: node.label,
      hint: node.hint,
      maxLength: node.maxLength,
      style: {
        fontFamily: font,
        size: fit.size || initialSize,
        color: userStyle.color || LAYOUT_TOKENS.text,
        weight: Number(userStyle.weight) || (isHeading ? 700 : 400),
        lineHeight: fit.lineHeight || (Number(userStyle.lineHeight) || (isHeading ? 1.05 : 1.2)),
        align: userStyle.align || 'left',
        letterSpacing: Number(userStyle.letterSpacing || 0),
        uppercase: Boolean(userStyle.uppercase),
      },
    };
  }

  if (type === 'image') {
    const url = node.imageUrl || node.src || node.url || node.content;
    return {
      id: elemId,
      kind: 'image',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      z,
      locked,
      imageUrl: String(url || '').trim(),
      variable: Boolean(node.variable),
      key: node.key,
      label: node.label,
      style: {
        fit: userStyle.fit || 'cover',
        radius: Number(userStyle.radius || 0),
        opacity: Number(userStyle.opacity ?? 1),
      },
    };
  }

  if (type === 'icon') {
    const iconName = node.name || node.icon || node.content;
    return {
      id: elemId,
      kind: 'icon',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      z,
      locked,
      name: String(iconName || 'calendar').toLowerCase().trim(),
      style: {
        color: userStyle.color || LAYOUT_TOKENS.accent,
        strokeWidth: Number(userStyle.strokeWidth || 2),
        opacity: Number(userStyle.opacity ?? 1),
      },
    };
  }

  if (type === 'shape' || type === 'divider') {
    const isLine = type === 'divider' || node.shape?.type === 'line';
    const fill = isLine ? (node.color || userStyle.color || LAYOUT_TOKENS.secondary) : (node.shape?.fill || node.fill || LAYOUT_TOKENS.primary);

    return {
      id: elemId,
      kind: 'shape',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      z,
      locked,
      style: {
        color: LAYOUT_TOKENS.secondary,
        radius: Number(userStyle.radius || node.shape?.radius || 0),
        opacity: Number(userStyle.opacity ?? 1),
      },
      shape: {
        type: isLine ? 'rect' : (node.shape?.type || 'rect'),
        fill,
        stroke: node.shape?.stroke || '',
        strokeWidth: Number(node.shape?.strokeWidth || 0),
      },
    };
  }

  return null;
}

/**
 * Main layout entrypoint.
 *
 * @param {object} tree - Layout container or element tree
 * @param {object} options
 * @param {object} [options.brandKit] - Tenant brand kit
 * @param {object} [options.template] - Target template
 * @param {{x:number, y:number, w:number, h:number}} [options.contentArea] - Explicit content bounds
 * @param {number|object} [options.margin] - Inward brand margin (default: 4% of width)
 * @returns {Array<object>} Flat element array positioned within contentArea
 */
export function layout(tree, options = {}) {
  if (!tree) return [];

  // 1. Prune empty leaves and collapse containers whose children are all empty
  const pruned = pruneTree(tree);
  if (!pruned) return [];

  // 2. Resolve Content Area bounds (strictly avoiding header & footer zones)
  const kit = options.brandKit || {};
  const tpl = options.template || { size: options.size || { width: 1080, height: 1350 } };
  const rawArea = options.contentArea || contentArea(kit, tpl);

  const area = {
    x: Math.round(rawArea.x),
    y: Math.round(rawArea.y),
    w: Math.round(rawArea.w),
    h: Math.round(rawArea.h),
  };

  // 3. Resolve Brand Margin
  let margin;
  if (options.margin !== undefined && options.margin !== null) {
    margin = normalizePadding(options.margin);
  } else {
    const defaultM = Math.round(area.w * 0.04);
    margin = { top: defaultM, right: defaultM, bottom: defaultM, left: defaultM };
  }

  const rootBox = {
    x: area.x + margin.left,
    y: area.y + margin.top,
    w: Math.max(0, area.w - margin.left - margin.right),
    h: Math.max(0, area.h - margin.top - margin.bottom),
  };

  // 4. Execute recursive deterministic layout
  const context = { idCounter: { val: 0 } };
  const result = layoutNode(pruned, rootBox, context);

  // 5. Ensure all elements are clamped inside contentArea (never header or footer)
  const clampedElements = [];
  const seenIds = new Set();

  for (const el of result.elements) {
    if (!el || typeof el !== 'object') continue;

    // Ensure unique ID
    let finalId = el.id || `el-${clampedElements.length + 1}`;
    if (seenIds.has(finalId)) {
      let counter = 1;
      while (seenIds.has(`${finalId}-${counter}`)) {
        counter += 1;
      }
      finalId = `${finalId}-${counter}`;
    }
    seenIds.add(finalId);
    el.id = finalId;

    // Clamp coordinates strictly to contentArea
    const clamped = clampRectToArea(
      {
        x: Math.round(el.x),
        y: Math.round(el.y),
        w: Math.max(RULE_THICKNESS.min, Math.round(el.w)),
        h: Math.max(RULE_THICKNESS.min, Math.round(el.h)),
      },
      area
    );

    el.x = clamped.x;
    el.y = clamped.y;
    el.w = clamped.w;
    el.h = clamped.h;

    clampedElements.push(el);
  }

  return clampedElements;
}

// Fluent helper builders
function normalizeContainerArgs(type, defaultProps, optionsOrChildren, maybeChildren) {
  if (Array.isArray(optionsOrChildren)) {
    return { type, ...defaultProps, children: optionsOrChildren };
  }
  const opts = optionsOrChildren && typeof optionsOrChildren === 'object' ? optionsOrChildren : {};
  const children = Array.isArray(maybeChildren)
    ? maybeChildren
    : (Array.isArray(opts.children) ? opts.children : []);
  return { type, ...defaultProps, ...opts, children };
}

export function stack(optionsOrChildren, maybeChildren) {
  return normalizeContainerArgs('stack', {}, optionsOrChildren, maybeChildren);
}

export function row(optionsOrChildren, maybeChildren) {
  return normalizeContainerArgs('row', {}, optionsOrChildren, maybeChildren);
}

export function grid(optionsOrChildren, maybeChildren) {
  return normalizeContainerArgs('grid', { columns: 2 }, optionsOrChildren, maybeChildren);
}

export function overlay(optionsOrChildren, maybeChildren) {
  return normalizeContainerArgs('overlay', {}, optionsOrChildren, maybeChildren);
}

export function text(content, options = {}) {
  return { type: 'text', content, ...options };
}

export function image(imageUrl, options = {}) {
  return { type: 'image', imageUrl, ...options };
}

export function shape(shapeType = 'rect', options = {}) {
  const shapeObj = options.shape || {};
  return {
    type: 'shape',
    ...options,
    shape: {
      type: shapeType,
      fill: options.fill || shapeObj.fill || LAYOUT_TOKENS.primary,
      ...shapeObj,
    },
  };
}

export function icon(name, options = {}) {
  return { type: 'icon', name, ...options };
}

export function divider(options = {}) {
  return { type: 'divider', isDivider: true, ...options };
}

export {
  textFit,
  wrapWords,
  getFontRatio,
  charWidthFor,
  fitPrioritizedFields,
  FIELD_PRIORITY,
  PRIORITY_ORDER,
  getPriority,
};

export default {
  layout,
  stack,
  row,
  grid,
  overlay,
  text,
  image,
  shape,
  icon,
  divider,
  pruneTree,
  isEmptyLeaf,
  normalizePadding,
  normalizeGap,
  estimateTextHeight,
  textFit,
  wrapWords,
  getFontRatio,
  charWidthFor,
  fitPrioritizedFields,
  FIELD_PRIORITY,
  PRIORITY_ORDER,
  getPriority,
};
