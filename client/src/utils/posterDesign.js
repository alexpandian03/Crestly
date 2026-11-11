/* The look a poster was saved with, and whether the brand has moved on since then. */

export function designBrandKit(design, fallback) {
  return design?.brandKit || fallback || null;
}

export function designTemplate(design, fallback) {
  return design?.template || fallback || null;
}

/** True when the brand kit or the template changed after this snapshot was taken. */
export function isDesignStale(design, { brandKit, templates = [] } = {}) {
  if (!design) return false;
  const captured = Date.parse(design.capturedAt || '');
  const kitChanged = Date.parse(brandKit?.updatedAt || '');
  if (captured && kitChanged && kitChanged > captured) return true;

  const pinned = design.template;
  if (pinned?.templateId) {
    const live = templates.find((item) => String(item._id || item.id || '') === String(pinned.templateId));
    if (
      live &&
      Number.isFinite(live.version) &&
      Number.isFinite(pinned.version) &&
      live.version !== pinned.version
    ) {
      return true;
    }
  }
  return false;
}

export const DESIGN_STALE_MESSAGE = 'The brand design has changed since this poster was made.';
export const DESIGN_APPLY_LABEL = 'Use the latest brand design';
export const DESIGN_APPLY_CONFIRM = 'This adds a new version. Your current version stays in the history.';
