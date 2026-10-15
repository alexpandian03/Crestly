import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: { items: [] } } })) },
}));

import VariableFields from './VariableFields.jsx';

/* ------------------------------------------------------------------ *
 * The panel that fills in the picture spaces.
 *
 * What the designer left in a space is an example for the template editor only, so this panel
 * must never show it, never offer it, and never let it stand as this poster's answer.
 * ------------------------------------------------------------------ */

const SAMPLE = 'https://images.pexels.com/photos/1000/sample.jpg';
const CHOSEN = 'https://images.unsplash.com/photo-3000?w=1000';
const OTHER = 'https://images.pexels.com/photos/2000/other.jpg';

const picture = (key, extra = {}) => ({
  id: `pic-${key}`,
  kind: 'image',
  variable: true,
  key,
  label: `Picture ${key}`,
  x: 60,
  y: 320,
  w: 420,
  h: 320,
  z: 2,
  ...extra,
});

const design = (items) => ({ template: { editorVersion: 2, elements: items } });

function Panel({ items = [picture('hero', { imageUrl: SAMPLE })], start = null, ...rest }) {
  const [content, setContent] = useState(start || { title: 'City Care Drive' });
  return (
    <VariableFields
      design={design(items)}
      content={content}
      view={null}
      canUpload
      onContentChange={setContent}
      onViewChange={() => {}}
      {...rest}
    />
  );
}

const slot = (key) => document.querySelector(`[data-slot-picture="${key}"]`);

afterEach(() => {
  cleanup();
});

describe('an empty picture space', () => {
  it('offers a way to fill it and shows no example picture', () => {
    render(<Panel />);
    const box = within(slot('hero'));
    expect(box.getByText('Picture hero')).toBeTruthy();
    expect(box.getByText('Nothing here yet')).toBeTruthy();
    expect(box.getByRole('button', { name: /Upload/ })).toBeTruthy();
    expect(box.getByRole('button', { name: /Choose from my uploads/ })).toBeTruthy();
    expect(box.getByLabelText('Picture hero picture address')).toBeTruthy();
    expect(box.getByRole('button', { name: 'Use' }).disabled).toBe(true);
    expect(box.queryByText(/designer/i)).toBeNull();
    expect(document.querySelectorAll('[data-slot-picture="hero"] img')).toHaveLength(0);
  });

  it('never offers the example picture as one to use', async () => {
    const user = userEvent.setup();
    render(
      <Panel
        alternatives={[{ url: CHOSEN, label: 'Your picture' }]}
        start={{ title: 'City Care Drive', images: { hero: OTHER } }}
      />,
    );
    await user.click(within(slot('hero')).getByRole('button', { name: /Replace/ }));
    const menu = await screen.findByRole('menu', { name: 'Pictures to choose from' });
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Your picture',
    ]);
    expect(menu.innerHTML).not.toContain(SAMPLE);
    expect(slot('hero').innerHTML).not.toContain('sample.jpg');
  });
});

describe('filling a picture space', () => {
  it('puts an addressed picture in and takes it back out again', async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await user.type(within(slot('hero')).getByLabelText('Picture hero picture address'), CHOSEN);
    await user.click(within(slot('hero')).getByRole('button', { name: 'Use' }));

    const filled = within(slot('hero'));
    expect(filled.getByText('Your picture is in place')).toBeTruthy();
    expect(slot('hero').querySelector('img').src).toContain('photo-3000');
    const remove = filled.getByRole('button', { name: /Remove/ });
    expect(remove.disabled).toBe(false);

    await user.click(remove);
    const emptied = within(slot('hero'));
    /* Taking it out leaves the space and its ways of filling it right where they were. */
    expect(emptied.getByText('Nothing here yet')).toBeTruthy();
    expect(emptied.getByRole('button', { name: /Choose from my uploads/ })).toBeTruthy();
    expect(emptied.getByText(/You took the picture out/)).toBeTruthy();
    expect(slot('hero').querySelector('img')).toBeNull();

    await user.click(emptied.getByRole('button', { name: 'Undo' }));
    expect(within(slot('hero')).getByText('Your picture is in place')).toBeTruthy();
  });

  it('keeps every picture space on its own', async () => {
    const user = userEvent.setup();
    render(<Panel items={[picture('hero', { imageUrl: SAMPLE }), picture('stage', { imageUrl: OTHER })]} />);
    await user.type(within(slot('hero')).getByLabelText('Picture hero picture address'), CHOSEN);
    await user.click(within(slot('hero')).getByRole('button', { name: 'Use' }));

    expect(within(slot('hero')).getByText('Your picture is in place')).toBeTruthy();
    expect(within(slot('stage')).getByText('Nothing here yet')).toBeTruthy();
    expect(slot('stage').querySelector('img')).toBeNull();
  });
});
