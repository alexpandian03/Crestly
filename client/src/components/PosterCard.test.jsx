import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PosterCard from './PosterCard';

const samplePoster = {
  _id: 'poster-1',
  title: 'Annual Cultural Program',
  status: 'draft',
  thumbnailUrl: 'https://example.com/poster-thumb.png',
  content: { headline: 'Annual Cultural Program' },
  updatedAt: '2026-11-11T05:00:00.000Z',
};

describe('PosterCard actions menu', () => {
  it('shows Download, Duplicate, and Delete without Open', async () => {
    const user = userEvent.setup();
    render(
      <PosterCard
        poster={samplePoster}
        category="Event"
        onOpenDetail={vi.fn()}
        onDownload={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /poster actions/i }));

    expect(await screen.findByRole('menuitem', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^open$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('calls onDownload with the poster and does not trigger onOpenDetail', async () => {
    const user = userEvent.setup();
    const onOpenDetail = vi.fn();
    const onDownload = vi.fn();

    render(
      <PosterCard
        poster={samplePoster}
        category="Event"
        onOpenDetail={onOpenDetail}
        onDownload={onDownload}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /poster actions/i }));
    const downloadItem = await screen.findByRole('menuitem', { name: /download/i });
    await user.click(downloadItem);

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(samplePoster);
    expect(onOpenDetail).not.toHaveBeenCalled();
  });
});
