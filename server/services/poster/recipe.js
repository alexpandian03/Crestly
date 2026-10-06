import {
  RECIPE_VARIANTS,
  buildElements,
  designById,
  recipeIds,
} from '../../../shared/designRecipes.js';
import {
  EDITOR_VERSION,
  iconForCategory,
  normalizeIconName,
} from '../../../shared/templateElements.js';
import {
  TEMPLATE_SIZE_DEFAULT,
  badRequest,
  normalizeLayout,
  normalizeTemplateSize,
} from '../template/zones.js';

/* A design made from a recipe. Only three things ever come from outside: the design's name,
   which arrangement of it, and which small picture marks it. The items themselves are built
   here, from this tenant's own brand kit, so the look a poster stores is concrete and no later
   change to a recipe can reach a poster that was already saved. */

const ALLOWED_RECIPES = recipeIds();

/** What the poster of a design is called in lists and snapshots. */
export const AI_TEMPLATE_NAME = 'AI design';

/** The words the recipe lays out, taken from the poster's own content. */
function slotsForContent(content, icon) {
  const source = content && typeof content === 'object' ? content : {};
  return {
    headline: source.title,
    tagline: source.tagline,
    date: source.date,
    time: source.time,
    venue: source.venue,
    details: Array.isArray(source.details) ? source.details : [],
    extras: source.extras && typeof source.extras === 'object' ? source.extras : {},
    icon,
    /* A recipe never keeps a photo: the picture always comes with the poster. */
    imageUrl: '',
  };
}

export function isRecipeId(value) {
  return ALLOWED_RECIPES.includes(typeof value === 'string' ? value.trim() : '');
}

/** True only for a design that shows a picture, so a photo is looked up when it can be used. */
export function recipeNeedsPhoto(id) {
  return Boolean(designById(id)?.needsPhoto);
}

/**
 * The design a request asked for, cleaned. An unknown name, a bad arrangement or an unknown
 * mark is refused in plain words; a missing mark falls back to one that suits the design.
 */
export function readRecipe(value) {
  const source = value && typeof value === 'object' ? value : {};
  const design = designById(source.recipeId);
  if (!design || !ALLOWED_RECIPES.includes(design.id)) {
    throw badRequest(`Choose one of the designs this app offers: ${ALLOWED_RECIPES.join(', ')}.`);
  }
  const variant = RECIPE_VARIANTS.includes(Number(source.variant)) ? Number(source.variant) : 0;
  const icon =
    normalizeIconName(typeof source.icon === 'string' ? source.icon : '') ||
    iconForCategory(design.suits[0]);
  return { recipeId: design.id, name: design.name, variant, icon, design };
}

/**
 * Builds one AI design into the shape a poster stores as its look: name, size and items.
 * `size` may come from a template or the brand kit; anything missing uses the default poster.
 */
export function buildRecipeDesign({ recipe, content = {}, brandKit = null, size = null }) {
  const clean = recipe && recipe.design ? recipe : readRecipe(recipe);
  const canvas = normalizeTemplateSize(size || brandKit?.defaultPosterSize || TEMPLATE_SIZE_DEFAULT);
  const slots = slotsForContent(content, clean.icon);
  const built = buildElements(clean.recipeId, {
    brandKit,
    size: canvas,
    slots,
    options: { variant: clean.variant },
  });

  return {
    name: AI_TEMPLATE_NAME,
    editorVersion: EDITOR_VERSION,
    size: canvas,
    zones: [],
    layout: normalizeLayout(null, []),
    version: 1,
    elements: built.elements,
    recipeId: clean.recipeId,
    variant: clean.variant,
    recipeVersion: clean.design.recipeVersion,
    icon: clean.icon,
  };
}

/** The same design as the answer a client sees: the mode, the choice and the items. */
export function recipePayload(template) {
  return {
    mode: 'ai',
    recipeId: template.recipeId,
    variant: template.variant,
    recipeVersion: template.recipeVersion,
    /* The mark the design was drawn with, echoed so saving the same poster rebuilds the same
       picture: a design is only reproducible from what the answer already contains. */
    icon: template.icon,
    template: {
      name: template.name,
      editorVersion: template.editorVersion,
      elements: template.elements,
    },
  };
}
