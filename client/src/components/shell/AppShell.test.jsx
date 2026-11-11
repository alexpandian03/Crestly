import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = {
  user: {
    _id: 'u1',
    name: 'Platform Superadmin',
    email: 'admin@example.com',
    role: 'superadmin',
  },
  isAuthenticated: true,
  activeClientId: 'c1',
  selectActiveClient: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const api = { get: vi.fn() };
vi.mock('../../services/api', () => ({ default: api }));

const { default: AppShell } = await import('./AppShell');

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({
    data: { success: true, data: { clients: [{ _id: 'c1', name: 'Test Club', isActive: true }] } },
  });
});

describe('AppShell layout containment', () => {
  it('pins the sidebar and header outside a scrollable main container', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/create']}>
        <AppShell>
          <div>What do you want to create?</div>
        </AppShell>
      </MemoryRouter>
    );

    const root = container.firstElementChild;
    expect(root.className).toContain('h-screen');
    expect(root.className).toContain('overflow-hidden');

    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-y-auto');
    expect(main).toHaveTextContent('What do you want to create?');

    const headerWrapper = main.previousElementSibling;
    expect(headerWrapper.className).toContain('shrink-0');
    expect(headerWrapper.className).not.toContain('sticky');

    expect(await screen.findByText('Test Club')).toBeInTheDocument();
  });
});
