import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ------------------------------------------------------------------ *
 * Reading the two switches of an organization.
 *
 * A client administrator belongs to one organization and never picks it, so the card has to ask
 * for its own settings instead of waiting for a choice that is never coming.
 * ------------------------------------------------------------------ */

const authState = { activeClientId: '' };

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

const api = { get: vi.fn(), patch: vi.fn() };
vi.mock('../../services/api', () => ({ default: api }));

const { default: DesignModesCard } = await import('./DesignModesCard');

const client = { _id: '64b00000000000000000000a', designModes: { ai: true, templates: false } };

let user;

beforeEach(() => {
  user = userEvent.setup();
  authState.activeClientId = '';
  api.get.mockReset().mockResolvedValue({ data: { data: { client } } });
  api.patch.mockReset();
});

describe('the organization settings card', () => {
  it('reads its own organization when none was picked', async () => {
    render(<DesignModesCard />);
    expect(await screen.findByText('Let AI design posters')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/clients/me');
    expect(screen.queryByText(/Reading your organization settings/)).toBe(null);
  });

  it('reads the organization an administrator chose', async () => {
    authState.activeClientId = client._id;
    render(<DesignModesCard />);
    await screen.findByText('Let people pick layouts');
    expect(api.get).toHaveBeenCalledWith(`/clients/${client._id}`);
  });

  it('saves against the organization it read', async () => {
    api.patch.mockResolvedValue({ data: { data: { client } } });
    render(<DesignModesCard />);
    await screen.findByRole('switch', { name: /Let AI design posters/i });
    await user.click(screen.getByRole('switch', { name: /Let people pick layouts/i }));
    await user.click(await screen.findByRole('button', { name: /Save settings/i }));
    await vi.waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][0]).toBe(`/clients/${client._id}`);
  });
});
