import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiDesignOf,
  designModesOf,
  firstAllowedMode,
  modeAllowed,
} from './posterAiDesign.js';

test('design mode defaults and organization settings stay usable', () => {
  assert.deepEqual(designModesOf(null), { ai: true, templates: true });
  assert.deepEqual(designModesOf({ designModes: { ai: false } }), {
    ai: false,
    templates: true,
  });
  assert.equal(modeAllowed({ ai: false, templates: true }, 'ai'), false);
  assert.equal(firstAllowedMode({ ai: false, templates: true }), 'template');
});

test('assistant designs preserve the saved-template rendering shape', () => {
  const answer = {
    recipeId: 'hero',
    variant: 2,
    template: {
      elements: [{ id: 'headline', kind: 'field', field: 'headline' }],
    },
  };
  const design = aiDesignOf(answer, { width: 1080, height: 1350 });

  assert.equal(design.template.editorVersion, 2);
  assert.equal(design.template.recipeId, 'hero');
  assert.equal(design.template.variant, 2);
  assert.equal(design.template.size.width, 1080);
  assert.equal(design.template.elements[0].field, 'headline');
  assert.equal('brandKit' in design, false);
});
