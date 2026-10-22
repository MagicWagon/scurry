import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DownloadReviewModal from '../app/components/DownloadReviewModal.jsx';

vi.mock('next/image', () => ({
  default: ({ alt, ...props }) => <img alt={alt} {...props} />,
}));

const book = {
  id: 'book-1',
  title: 'Test Book',
  author: 'Author',
  narrator: null,
  size: '10 MB',
  filetypes: 'epub',
  seeders: '12',
  leechers: '1',
  downloads: '20',
  addedDate: '2026-01-01',
  torrentUrl: 'https://www.myanonamouse.net/t/1',
  vip: false,
  freeleech: false,
  snatched: false,
};

const audiobook = {
  ...book,
  id: 'audio-1',
  title: 'Test Audiobook',
  narrator: 'Narrator',
  size: '1 GB',
  filetypes: 'm4b',
};

const settings = {
  tags: {
    enabled: true,
    available: ['fiction', 'audio'],
    defaults: { books: ['fiction'], audiobooks: ['audio'] },
  },
};

afterEach(cleanup);

describe('DownloadReviewModal', () => {
  it('confirms a single download with the configured default tags', () => {
    const item = { result: book, category: 'books', useWedge: false, onToggleWedge: vi.fn() };
    const onConfirm = vi.fn();

    render(
      <DownloadReviewModal
        items={[item]}
        userStats={{ uploaded: '2 GB', downloaded: '1 GB', flWedges: 1 }}
        settings={settings}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Download review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove tag: fiction' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ratio Impact')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onConfirm).toHaveBeenCalledWith([item], [['fiction']]);
  });

  it('keeps per-medium default tags separate in dual mode', () => {
    const items = [
      { result: book, category: 'books', useWedge: false, onToggleWedge: vi.fn() },
      { result: audiobook, category: 'audiobooks', useWedge: true, onToggleWedge: vi.fn() },
    ];
    const onConfirm = vi.fn();

    render(
      <DownloadReviewModal
        items={items}
        userStats={{ uploaded: '2 GB', downloaded: '1 GB', flWedges: 1 }}
        settings={settings}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Audiobook')).toBeInTheDocument();
    expect(screen.getByText(/narrated by Narrator/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onConfirm).toHaveBeenCalledWith(items, [['fiction'], ['audio']]);
  });

  it('cancels after the close animation', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <DownloadReviewModal
        items={[{ result: book, category: 'books', useWedge: false, onToggleWedge: vi.fn() }]}
        userStats={null}
        settings={{ tags: { enabled: false, available: [], defaults: {} } }}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        loading={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close review' }));
    const panel = container.querySelector('[role="dialog"] > div');
    fireEvent.animationEnd(panel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
