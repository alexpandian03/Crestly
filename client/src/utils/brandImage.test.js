import { describe, it, expect } from 'vitest';
import { friendlyError } from './brandImage.js';

/** An axios failure the way the browser hands it over: `response` only exists once a server answered. */
function httpError(status, data) {
  return {
    message: `Request failed with status code ${status}`,
    response: { status, data },
  };
}

const LOAD_LINE = 'We could not load the brand kit. Refresh the page to try again.';

describe('friendlyError', () => {
  it('never shows the machinery its own words when a server answered without a message', () => {
    /* The dev proxy answers 500 with an empty body while the API process is restarting. */
    expect(friendlyError(httpError(500, ''), LOAD_LINE)).toBe(LOAD_LINE);
    expect(friendlyError(httpError(500, 'Internal Server Error'), LOAD_LINE)).toBe(LOAD_LINE);
    expect(friendlyError(httpError(502, '<!DOCTYPE html>'), LOAD_LINE)).toBe(LOAD_LINE);
    expect(friendlyError(httpError(500, { error: { message: 'Internal Server Error' } }), LOAD_LINE)).toBe(
      LOAD_LINE
    );
  });

  it('keeps a message this app wrote for the screen', () => {
    expect(
      friendlyError(httpError(400, { error: { message: 'Add the organization name before saving.' } }), LOAD_LINE)
    ).toBe('Add the organization name before saving.');
  });

  it('turns a database complaint into the part a person can act on', () => {
    expect(
      friendlyError(
        httpError(500, { error: { message: 'Validation failed: header.height: Header height must be between 60 and 200.' } }),
        LOAD_LINE
      )
    ).toBe('Header height must be between 60 and 200.');
  });

  it('says nothing technical when nothing answered at all', () => {
    expect(friendlyError({ message: 'Network Error' }, LOAD_LINE)).toBe('The connection dropped. Please try again.');
    expect(friendlyError({ message: 'timeout of 30000ms exceeded' }, LOAD_LINE)).toBe(
      'The connection dropped. Please try again.'
    );
    expect(friendlyError({ message: 'canceled' }, LOAD_LINE)).toBe(LOAD_LINE);
  });

  it('falls back to a plain line when there is nothing to go on', () => {
    expect(friendlyError({}, 'Something went wrong. Please try again.')).toBe('Something went wrong. Please try again.');
    expect(friendlyError(httpError(500, { error: { message: "Cannot read properties of undefined (reading 'x')" } })))
      .toBe('Something went wrong. Please try again.');
  });
});
