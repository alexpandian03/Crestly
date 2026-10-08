/* Reading, drawing and re-using a design the assistant laid out.
 *
 * The server builds an AI design from a recipe and this tenant's own brand kit, then hands
 * back the pieces it placed (see server/services/poster/recipe.js). Until the poster is
 * saved there is no snapshot, so this file builds the same shape the client already knows
 * how to draw: a design with a template and no brand kit, which falls back to the current
 * one. */

import { EDITOR_VERSION, contentArea, templateSizeOf } from '../../../shared/templateElements.js';
import { LAYOUT_BASE, TEMPLATE_SIZE_DEFAULT } from './templateRender.js';

export const MODE_AI = 'ai';
export const MODE_TEMPLATE = 'template';

/** What the assistant's own designs are called on a poster. */
export const AI_DESIGN_NAME = 'AI design';

/** The one sentence that explains why nothing brand-related is asked for. */
export const BRAND_LINE = 'Your logo, colors and contact details are always added by your brand.';

export const DESIGN_MODES_DEFAULT = { ai: true, templates: true };

const MODE_KEYS = { [MODE_AI]: 'ai', [MODE_TEMPLATE]: 'templates' };

export const MODE_CARDS = [
  {
    mode: MODE_AI,
    title: 'AI designs it',
    note: 'The assistant chooses the look and writes the words from your description.',
  },
  {
    mode: MODE_TEMPLATE,
    title: 'Use one of our layouts',
    note: 'Pick a layout your organization made and fill in the words.',
  },
];

/** The organization's two switches, with the shipped defaults when nothing was saved yet. */
export function designModesOf(client) {
  const stored = client?.designModes;
  if (!stored || typeof stored !== 'object') return { ...DESIGN_MODES_DEFAULT };
  return {
    ai: stored.ai !== false,
    templates: stored.templates !== false,
  };
}

export function modeAllowed(modes, mode) {
  const key = MODE_KEYS[mode];
  if (!key) return false;
  return (modes || DESIGN_MODES_DEFAULT)[key] !== false;
}

/** Only the modes this organization may use, in the order the page shows them. */
export function allowedModes(modes) {
  return MODE_CARDS.filter((card) => modeAllowed(modes, card.mode)).map((card) => card.mode);
}

export function firstAllowedMode(modes) {
  return allowedModes(modes)[0] || MODE_TEMPLATE;
}

/** Both switches are the settings route's own shape; the server refuses both off. */
export const BOTH_OFF_MESSAGE = 'Keep at least one way of making posters switched on.';

export function designModesPayload(modes) {
  return { designModes: { ai: Boolean(modes?.ai), templates: Boolean(modes?.templates) } };
}

/**
 * The size the server will build this design at: the chosen layout's own size, else the
 * brand kit's poster size, else the standard poster.
 */
export function designSizeFor(template, brandKit) {
  if (template?.size?.width && template?.size?.height) return templateSizeOf(template);
  const own = brandKit?.defaultPosterSize;
  if (own?.width && own?.height) return templateSizeOf({ size: own });
  return { ...TEMPLATE_SIZE_DEFAULT };
}

/** The look an assistant-made poster is drawn with, before the server stores a snapshot. */
export function aiDesignOf(answer, size) {
  const items = Array.isArray(answer?.template?.elements) ? answer.template.elements : [];
  if (items.length === 0) return null;
  return {
    capturedAt: new Date().toISOString(),
    template: {
      name: String(answer?.template?.name || AI_DESIGN_NAME),
      editorVersion: EDITOR_VERSION,
      version: 1,
      size,
      zones: [],
      layout: { ...LAYOUT_BASE },
      elements: items,
      archetype: answer?.archetype || answer?.recipeId,
      recipeId: answer?.recipeId || answer?.archetype,
      variant: Number.isFinite(Number(answer?.variant)) ? Number(answer.variant) : 0,
      recipeVersion: Number.isFinite(Number(answer?.recipeVersion))
        ? Number(answer.recipeVersion)
        : undefined,
      icon: answer?.icon,
    },
  };
}

/** True when this design came from the assistant rather than from an organization layout. */
export function isAiDesign(template) {
  return Boolean(template?.recipeId || template?.archetype) && Array.isArray(template?.elements) && template.elements.length > 0;
}

/** The three values that rebuild this design: the field POST /posters expects. */
export function recipeOf(template) {
  const id = template?.archetype || template?.recipeId;
  if (!id) return null;
  const recipe = {
    archetype: String(id),
    recipeId: String(id),
  };
  if (Number.isFinite(Number(template.variant))) recipe.variant = Number(template.variant);
  if (typeof template.icon === 'string' && template.icon) recipe.icon = template.icon;
  return recipe;
}

export function recipeKeyOf(template) {
  const recipe = recipeOf(template);
  const id = recipe?.archetype || recipe?.recipeId || '';
  return recipe ? `${id}|${recipe.variant ?? 0}|${recipe.icon || ''}` : '';
}

/**
 * The brand bands a design was laid out between, as the three areas a template stores.
 * Both bands keep the minimum an area may have, and the text area always keeps at least
 * two fifths of the poster, which is what a template save insists on.
 */
export function zonesForAiDesign(size, brandKit) {
  const canvas = templateSizeOf({ size });
  const area = contentArea(brandKit, { size: canvas });
  const MIN_ZONE = 80;
  let header = Math.max(MIN_ZONE, Math.round(area.y));
  let footer = Math.max(MIN_ZONE, Math.round(canvas.height - (area.y + area.h)));
  const room = Math.floor(canvas.height * 0.6);
  if (header + footer > room) {
    const scale = room / (header + footer);
    header = Math.max(MIN_ZONE, Math.floor(header * scale));
    footer = Math.max(MIN_ZONE, room - header);
  }
  return [
    { id: 'band-header', type: 'header', x: 0, y: 0, w: canvas.width, h: header, locked: true },
    {
      id: 'area-content',
      type: 'content',
      x: 0,
      y: header,
      w: canvas.width,
      h: Math.max(MIN_ZONE, canvas.height - header - footer),
      locked: false,
    },
    {
      id: 'band-footer',
      type: 'footer',
      x: 0,
      y: canvas.height - footer,
      w: canvas.width,
      h: footer,
      locked: true,
    },
  ];
}

/** The body POST /templates needs to keep an assistant's design as an organization layout. */
export function aiTemplateBody({ name, design, brandKit }) {
  const template = design?.template || design || {};
  const size = templateSizeOf({ size: template.size });
  return {
    name: String(name || '').trim(),
    category: 'Custom',
    size,
    zones: zonesForAiDesign(size, brandKit),
    layout: { ...LAYOUT_BASE },
    elements: Array.isArray(template.elements) ? template.elements : [],
  };
}

/** Plain words for the two answers a template save gives back. */
export function friendlyTemplateError(err) {
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.error?.message;
  if (status === 409) return 'A layout with that name already exists. Choose another name.';
  if (status === 400 && serverMessage) return serverMessage;
  if (status === 403) {
    return 'Only an administrator can save a design as a layout for your organization.';
  }
  return 'We could not save this design as a layout. Please try again.';
}

/** What the button that asks for a drawn picture says. */
export const PICTURE_BUTTON_LABEL = 'Create a picture with AI';

/**
 * The one place on this design a picture can go: the space that carries the poster's own photo,
 * or a picture the design holds by itself. A design with neither keeps its mark.
 */
export function pictureSlotOf(template) {
  const items = Array.isArray(template?.elements) ? template.elements : [];
  return (
    items.find(
      (item) => (item?.kind === 'field' && item?.field === 'photo') || item?.kind === 'image'
    ) || null
  );
}

export function hasPictureArea(template) {
  return Boolean(pictureSlotOf(template));
}

/**
 * Plain words for what a picture request gives back. The server already answers in plain words,
 * so its sentence is used whenever there is one; only a hung or broken call needs these.
 */
export function friendlyPictureError(err) {
  const serverMessage = String(err?.response?.data?.error?.message || '').trim();
  if (serverMessage) return serverMessage;
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return 'Making that picture took too long, so your poster keeps the picture it had. Try again, or choose a photo instead.';
  }
  return 'We could not make a picture just now. Your poster keeps the picture it had, so you can choose one from your library.';
}
