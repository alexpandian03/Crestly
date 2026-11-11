import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';

const SIZE = { width: 1080, height: 1350 };

const settingsKit = {
  orgName: 'Water Aid Trust',
  colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#F59E0B', text: '#111827', background: '#FFFFFF' },
  fonts: { heading: 'Outfit', body: 'Inter' },
  defaultPosterSize: SIZE,
  header: {
    height: 140,
    background: { type: 'color', color: '#0f172a' },
    logo: { show: false, size: 40, position: 'left' },
    orgName: { show: true, text: 'Water Aid Trust' },
  },
  footer: { height: 130, background: { type: 'color', color: '#0b0f17' }, phone: '+91 90000 00000' },
};

const bannerKit = {
  ...settingsKit,
  logos: [{ url: 'https://example.com/logo.png', isPrimary: true }],
  header: {
    height: 140,
    background: { type: 'image', imageUrl: 'https://example.com/header-banner.png', fit: 'cover', overlayOpacity: 0.6 },
    showLogo: true,
    showOrgName: true,
    logo: { show: true },
    orgName: { show: true, text: 'Stale Org Name' },
    tagline: { show: true, text: 'Stale Tagline' },
  },
  footer: {
    height: 130,
    background: { type: 'image', imageUrl: 'https://example.com/footer-banner.png', fit: 'cover', overlayOpacity: 0.6 },
    phone: '+1 (555) 019-2830',
    website: 'example.com',
    contactText: '+1 (555) 019-2830',
    socials: ['@brand', 'linkedin.com/company/brand'],
    legalText: '© All rights reserved.',
  },
};

const template = {
  name: 'Plain layout',
  editorVersion: 2,
  size: SIZE,
  zones: [],
  elements: [],
};

describe('PosterCanvas locked header and footer bands', () => {
  it('draws default brand header and footer bands from brand kit settings', () => {
    render(<PosterCanvas brandKit={settingsKit} template={template} content={{}} />);
    expect(screen.getByText('Water Aid Trust')).toBeInTheDocument();
    expect(screen.getByText('+91 90000 00000')).toBeInTheDocument();
  });

  it('draws uploaded header and footer banner images in locked bands without overlapping text or logo', () => {
    const { container } = render(<PosterCanvas brandKit={bannerKit} template={template} content={{}} />);
    const headerImg = container.querySelector('[data-section="header"] img[src="https://example.com/header-banner.png"]');
    const footerImg = container.querySelector('[data-section="footer"] img[src="https://example.com/footer-banner.png"]');
    const logoImg = container.querySelector('[data-section="header"] img[src="https://example.com/logo.png"]');
    expect(headerImg).toBeInTheDocument();
    expect(footerImg).toBeInTheDocument();
    expect(logoImg).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Org Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Tagline')).not.toBeInTheDocument();
    expect(screen.queryByText('+1 (555) 019-2830')).not.toBeInTheDocument();
    expect(screen.queryByText('example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('@brand')).not.toBeInTheDocument();
    expect(screen.queryByText('linkedin.com/company/brand')).not.toBeInTheDocument();
    expect(screen.queryByText('© All rights reserved.')).not.toBeInTheDocument();
  });

  it('ignores stale per-template brandKit overrides so locked brand kit banners render', () => {
    const templateWithStaleKit = { ...template, brandKit: settingsKit };
    const { container } = render(
      <PosterCanvas brandKit={bannerKit} template={templateWithStaleKit} content={{}} />
    );
    const headerImg = container.querySelector('[data-section="header"] img[src="https://example.com/header-banner.png"]');
    const footerImg = container.querySelector('[data-section="footer"] img[src="https://example.com/footer-banner.png"]');
    expect(headerImg).toBeInTheDocument();
    expect(footerImg).toBeInTheDocument();
    expect(screen.queryByText('Water Aid Trust')).not.toBeInTheDocument();
    expect(screen.queryByText('+91 90000 00000')).not.toBeInTheDocument();
    expect(screen.queryByText('© All rights reserved.')).not.toBeInTheDocument();
  });
});
