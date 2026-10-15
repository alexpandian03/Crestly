import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_DOC_TOO_BIG_MESSAGE,
  versionsThatFit,
} from '../../server/services/template/elements.js';
import { TEMPLATE_DOC_MAX_BYTES, jsonBytes } from '../../shared/templateElements.js';

/** One item of roughly this many words is about 2 KB once stored, so 20 of them plus ten
    saved states of the same design is the situation a real template gets into. */
const SMALL = 20;
const HUGE = 250;

function item(index) {
  return {
    id: `item-${index}`,
    kind: 'text',
    x: 70,
    y: 240,
    w: 900,
    h: 80,
    text: 'x'.repeat(2000),
  };
}

function design(count) {
  return {
    name: 'Fair',
    size: { width: 1080, height: 1350 },
    elements: Array.from({ length: count }, (_, index) => item(index)),
  };
}

/** A saved state holding the same items as the design beside it. */
function version(number, count) {
  return { version: number, note: 'Edited', elements: Array.from({ length: count }, (_, i) => item(i)) };
}

const bytesOf = (candidate, versions) => jsonBytes({ ...candidate, versions });

describe('template document size rule', () => {
  it('keeps the newest saved states and sheds the oldest until the document fits', () => {
    const candidate = design(SMALL);
    const history = Array.from({ length: 10 }, (_, index) => version(index + 1, SMALL));
    expect(bytesOf(candidate, history)).toBeGreaterThan(TEMPLATE_DOC_MAX_BYTES);

    const kept = versionsThatFit(candidate, history);

    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(history.length);
    expect(kept).toEqual(history.slice(-kept.length));
    expect(bytesOf(candidate, kept)).toBeLessThanOrEqual(TEMPLATE_DOC_MAX_BYTES);
  });

  it('keeps every saved state while the whole document still fits', () => {
    const candidate = design(2);
    const history = [version(1, 2), version(2, 2)];

    expect(versionsThatFit(candidate, history)).toEqual(history);
  });

  it('refuses a design that is too big on its own, whatever its history holds', () => {
    const candidate = design(HUGE);
    expect(bytesOf(candidate, [])).toBeGreaterThan(TEMPLATE_DOC_MAX_BYTES);

    expect(() => versionsThatFit(candidate, [version(1, 2)])).toThrow(TEMPLATE_DOC_TOO_BIG_MESSAGE);
  });

  it('does not count history when judging the design itself', () => {
    const candidate = design(SMALL);
    const history = Array.from({ length: 10 }, (_, index) => version(index + 1, SMALL));
    expect(bytesOf(candidate, history)).toBeGreaterThan(TEMPLATE_DOC_MAX_BYTES);

    expect(() => versionsThatFit(candidate, history)).not.toThrow();
  });
});
