import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';

describe('PosterCanvas AI poster and blank content area behavior', () => {
  const brandKit = {
    orgName: 'Rotary Club',
    colors: {
      primary: '#0B2545',
      secondary: '#134074',
      accent: '#EE6C4D',
      text: '#111827',
      background: '#FFFFFF',
    },
    fonts: {
      heading: 'Outfit',
      body: 'Inter',
    },
    header: {
      showOrgName: true,
      orgName: { text: 'Rotary Club International', show: true },
      height: 140,
    },
    footer: {
      address: '789 Service Lane',
      phone: '+1 555-0199',
      email: 'contact@rotary.org',
      height: 130,
    },
  };

  const template = {
    name: 'Standard',
    size: { width: 1080, height: 1350 },
    elements: [],
    zones: [],
  };

  it('renders default locked header and footer, but leaves content area fully blank with NO headings before generation', () => {
    const content = {
      title: 'Blood Donation Camp',
      tagline: 'Give blood, save lives',
      isAiGenerated: true,
    };

    const { container } = render(
      <PosterCanvas brandKit={brandKit} template={template} content={content} />
    );

    // Header and footer are present
    expect(screen.getByText(/Rotary Club International/i)).toBeInTheDocument();
    expect(screen.getByText(/789 Service Lane/i)).toBeInTheDocument();

    // No heading or subheading rendered in the content area
    expect(screen.queryByText(/Blood Donation Camp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Give blood, save lives/i)).not.toBeInTheDocument();

    // Content section is present but empty of text overlays
    const contentSection = container.querySelector('[data-section="content"]');
    expect(contentSection).toBeInTheDocument();
  });

  it('fills content area with the full-bleed AI image when photoUrl is generated, with zero heading or default date/venue overlays', () => {
    const aiImageUrl = 'https://example.com/ai-flux-generated-poster.png';
    const content = {
      title: 'Blood Donation Camp',
      date: '18 Oct',
      time: '8 AM',
      venue: 'School ground',
      details: ['Medals for every winner'],
      imageUrl: aiImageUrl,
      isAiGenerated: true,
    };

    const { container } = render(
      <PosterCanvas brandKit={brandKit} template={template} content={content} />
    );

    // Header and footer are present
    expect(screen.getByText(/Rotary Club International/i)).toBeInTheDocument();
    expect(screen.getByText(/789 Service Lane/i)).toBeInTheDocument();

    // AI image is rendered strictly within content box using objectFit: contain so header/footer never clip it
    const img = container.querySelector('img[src="https://example.com/ai-flux-generated-poster.png"]');
    expect(img).toBeInTheDocument();
    expect(img.style.objectFit).toBe('contain');
    const contentBox = container.querySelector('[data-section="content"] > div');
    expect(contentBox.style.top).toBe('140px');
    expect(contentBox.style.height).toBe('1080px');

    // No heading or default date/time/venue overlays on top of the image
    expect(screen.queryByText(/Blood Donation Camp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/18 Oct/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/8 AM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/School ground/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Medals for every winner/i)).not.toBeInTheDocument();
  });
});
