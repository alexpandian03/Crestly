/**
 * A brand kit can lay its header and footer out as items of its own, the same way a template
 * customizes a band for one design. When it has, those items are what every poster of this
 * organization draws - unless the template carries a band of its own, which always wins.
 *
 * A kit nobody has laid out still keeps mode "legacy", meaning its settings are painted the way
 * they always were. Nothing here rewrites a kit: it only decides which language the canvas reads.
 */
import {
  BAND_HEIGHTS,
  BRAND_BAND_KINDS,
  DEFAULT_PAGE_BACKGROUND,
  EDITOR_VERSION,
  brandBandForEditing,
  defaultBrandBand,
  defaultPage,
  effectiveBand,
  templateSizeOf,
} from '../../../shared/templateElements.js';

export function withKitBands(sections, brandKit, template) {
  if (!sections || !brandKit) return sections;
  let next = sections;
  for (const kind of BRAND_BAND_KINDS) {
    const section = next[kind];
    if (!section || section.mode === 'custom') continue;
    if (brandKit[kind]?.mode !== 'elements') continue;
    const band = effectiveBand(brandKit, template, kind);
    if (!band || band.source !== 'brand' || band.mode !== 'elements' || band.elements.length === 0) continue;
    next = {
      ...next,
      [kind]: {
        ...section,
        mode: 'custom',
        height: band.height ?? section.height,
        background: band.background ?? section.background,
        elements: band.elements,
      },
    };
  }
  return next;
}

/**
 * Is this band the organization's own, drawn from items it placed? Used by the editor to say
 * "this header belongs to the brand" instead of letting a single template move it.
 */
export function kitBandIsLaidOut(brandKit, kind) {
  if (!brandKit || !BRAND_BAND_KINDS.includes(kind)) return false;
  return brandKit[kind]?.mode === 'elements' && (brandKit[kind]?.elements || []).length > 0;
}

/**
 * A template's band taken over as that design's own: the header or footer the organization draws
 * today, copied into pieces the editor can move. A band that still follows the organization is
 * painted from the brand kit, so anything placed on it before this copy exists never appears on
 * the poster - which is why placing something on one has to start here.
 */
export function bandToCustomize(brandKit, kind, { size, current = null } = {}) {
  if (!brandKit || !BRAND_BAND_KINDS.includes(kind)) return null;
  if (current?.mode === 'custom') return null;
  const band = brandBandForEditing(brandKit, kind, { size });
  if (!band) return null;
  const kitBackground = brandKit?.[kind]?.background;
  const background = kitBackground
    ? { ...kitBackground }
    : current?.background
      ? { ...current.background }
      : { ...DEFAULT_PAGE_BACKGROUND };
  return {
    mode: 'custom',
    height: band.height ?? current?.height ?? BAND_HEIGHTS[kind].default,
    background,
    elements: band.elements || [],
  };
}

/**
 * Where the words an organization paints in its header and footer sit, as pieces a canvas can put
 * a frame around. A band that still follows the organization carries none of its own, so without
 * these there is nothing to click on the poster - picking one of them hands the band over.
 */
export function borrowedBandPieces(brandKit, sections, size) {
  const borrowed = {};
  if (!brandKit || !sections) return borrowed;
  for (const kind of BRAND_BAND_KINDS) {
    const band = bandToCustomize(brandKit, kind, { size, current: sections[kind] });
    if (band?.elements?.length) borrowed[kind] = band.elements;
  }
  return borrowed;
}

/* ------------------------------------------------------------------ *
 * The brand-layer editor: the organization's own header and footer, laid out with the
 * same tools a template uses. What follows only reshapes data - the editor itself stays
 * the one editor, and a poster is drawn by the very rules above.
 * ------------------------------------------------------------------ */

const bandShape = (band) =>
  JSON.stringify({
    height: band?.height ?? null,
    background: band?.background ?? null,
    elements: band?.elements ?? [],
  });

/**
 * Only the bands that actually changed, in the words the brand kit saves in. A band emptied
 * completely goes back to being drawn from the organization's own settings, which is the one
 * state that needs no items.
 */
export function changedBrandBands(sections, baselineSections) {
  const payload = {};
  for (const kind of BRAND_BAND_KINDS) {
    if (bandShape(sections?.[kind]) === bandShape(baselineSections?.[kind])) continue;
    const elements = Array.isArray(sections?.[kind]?.elements) ? sections[kind].elements : [];
    payload[kind] = {
      mode: elements.length > 0 ? 'elements' : 'legacy',
      height: sections?.[kind]?.height,
      background: sections?.[kind]?.background,
      elements,
    };
  }
  return payload;
}

const sizeOf = (template) => templateSizeOf(template);

function sameSize(one, other) {
  return one.width === other.width && one.height === other.height;
}

/**
 * A layout to show behind the bands while they are being placed: the organization's own work,
 * at the size their posters are made at. Items are only borrowed when the size matches, so the
 * sample never appears in the wrong place; otherwise the words flow the way they always have.
 */
export function pickSampleTemplate(templates, size) {
  const list = Array.isArray(templates) ? templates : [];
  const poster = templateSizeOf({ size });
  const matching = list.filter((tpl) => tpl?.isActive !== false && sameSize(sizeOf(tpl), poster));
  const pool = matching.length > 0 ? matching : list;
  return (
    pool.find((tpl) => itemsOfTemplate(tpl).length > 0 && sameSize(sizeOf(tpl), poster)) ||
    pool.find((tpl) => sameSize(sizeOf(tpl), poster)) ||
    pool[0] ||
    null
  );
}

export function itemsOfTemplate(template) {
  const fromSections = template?.sections?.content?.elements;
  if (Array.isArray(fromSections)) return fromSections;
  return Array.isArray(template?.elements) ? template.elements : [];
}

/** The poster the brand-layer editor draws: the bands being placed, over a sample of real work. */
export function brandLayerTemplate(sections, sample, size) {
  const poster = templateSizeOf({ size });
  const borrowed = sample && sameSize(sizeOf(sample), poster) ? itemsOfTemplate(sample) : [];
  return {
    id: sample?.id || 'brand-layer',
    name: 'Organization header and footer',
    category: sample?.category || 'Event',
    size: poster,
    zones: [],
    layout: {},
    editorVersion: EDITOR_VERSION,
    sections: {
      ...sections,
      content: { ...sections.content, elements: borrowed },
    },
    elements: borrowed,
    page: sections?.content?.page,
  };
}

/**
 * The kit as the brand-layer editor opens it: its two bands and the items on them - the ones the
 * organization placed, or the ones its own settings turn into. The middle is left empty here
 * because a sample layout is only borrowed for the picture, never edited.
 */
export function editingTemplateFromKit(brandKit, size) {
  const poster = templateSizeOf({ size });
  const bandOf = (kind) => ({
    /* Either the items the organization placed itself, or the ones its settings turn into, so the
       editor always opens on something to move instead of an empty strip. */
    ...brandBandForEditing(brandKit, kind, { size: poster }),
    mode: 'custom',
    background:
      brandKit?.[kind]?.background && typeof brandKit[kind].background === 'object'
        ? { ...brandKit[kind].background }
        : undefined,
  });
  return {
    id: 'brand-layer',
    name: 'Organization header and footer',
    category: 'Brand',
    size: poster,
    zones: [],
    layout: {},
    editorVersion: EDITOR_VERSION,
    elements: [],
    page: defaultPage(),
    sections: {
      header: bandOf('header'),
      footer: bandOf('footer'),
      content: { page: defaultPage(), elements: [] },
    },
  };
}

/**
 * One band, put back the way the organization's own settings draw it: the standard height, and
 * the items those settings turn into, so the band is exactly what a brand-new kit starts with.
 */
export function resetBandPayload(brandKit, kind, size) {
  const withDefaultHeight = { ...brandKit, [kind]: { ...brandKit?.[kind], height: BAND_HEIGHTS[kind].default } };
  const band = defaultBrandBand(withDefaultHeight, kind, { size });
  return {
    mode: 'legacy',
    height: BAND_HEIGHTS[kind].default,
    elements: band?.elements || [],
  };
}

