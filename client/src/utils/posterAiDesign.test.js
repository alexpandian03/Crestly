import { describe, it, expect } from 'vitest';
import {
  aiDesignOf,
  designModesOf,
  firstAllowedMode,
  modeAllowed,
} from './posterAiDesign.js';

describe('posterAiDesign', () => {
  it('design mode defaults and organization settings stay usable', () => {
    expect(designModesOf(null)).toEqual({ ai: true, templates: true });
    expect(designModesOf({ designModes: { ai: false } })).toEqual({
      ai: false,
      templates: true,
    });
    expect(modeAllowed({ ai: false, templates: true }, 'ai')).toBe(false);
    expect(firstAllowedMode({ ai: false, templates: true })).toBe('template');
  });

  it('assistant designs preserve the saved-template rendering shape', () => {
    const answer = {
      recipeId: 'hero',
      variant: 2,
      template: {
        elements: [{ id: 'headline', kind: 'field', field: 'headline' }],
      },
    };
    const design = aiDesignOf(answer, { width: 1080, height: 1350 });

    expect(design.template.editorVersion).toBe(2);
    expect(design.template.recipeId).toBe('hero');
    expect(design.template.variant).toBe(2);
    expect(design.template.size.width).toBe(1080);
    expect(design.template.elements[0].field).toBe('headline');
    expect('brandKit' in design).toBe(false);
  });
});
