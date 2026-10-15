import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';
import { buildElements } from '../../../shared/designRecipes.js';

describe('PosterCanvas with recipe design', () => {
  it('renders header, footer and text elements properly', () => {
    const brandKit = {
      orgName: 'Greenwood High School',
      colors: {
        primary: '#2563EB',
        secondary: '#1E293B',
        accent: '#F59E0B',
        text: '#111827',
        background: '#FFFFFF',
      },
      fonts: {
        heading: 'Outfit',
        body: 'Inter',
      },
      header: {
        showOrgName: true,
        orgName: { text: 'Greenwood High School', show: true },
        height: 140,
      },
      footer: {
        address: '123 Main Street, Bangalore',
        phone: '+91 9876543210',
        email: 'info@greenwood.edu',
        website: 'www.greenwood.edu',
        height: 130,
      },
    };

    const built = buildElements('photo-hero', {
      area: { x: 0, y: 140, w: 1080, h: 1080 },
      slots: {
        headline: 'Annual Sports Festival',
        tagline: 'Join the athletic spirit',
        date: 'Nov 20, 2026',
        time: '9:00 AM',
        venue: 'Main Ground',
      },
    });

    const template = {
      name: 'AI design',
      editorVersion: 2,
      size: { width: 1080, height: 1350 },
      elements: built.elements,
      zones: [],
    };

    const content = {
      title: 'Annual Sports Festival',
      tagline: 'Join the athletic spirit',
      date: 'Nov 20, 2026',
      time: '9:00 AM',
      venue: 'Main Ground',
      details: ['Track and field', 'Relay race'],
    };

    const onLayoutSettled = vi.fn();

    const { container } = render(
      <PosterCanvas
        brandKit={brandKit}
        template={template}
        content={content}
        onLayoutSettled={onLayoutSettled}
      />
    );

    // 1. Header rendered with organization name
    const headerElement = screen.getByText(/Greenwood High School/i);
    expect(headerElement).toBeInTheDocument();

    // 2. Footer rendered with contact info or address
    const footerElement = screen.getByText(/123 Main Street, Bangalore/i);
    expect(footerElement).toBeInTheDocument();

    // 3. Text element from recipe/content rendered
    const headlineElement = screen.getByText(/Annual Sports Festival/i);
    expect(headlineElement).toBeInTheDocument();

    expect(container.querySelector('#poster-canvas-root')).toBeInTheDocument();
  });
});
