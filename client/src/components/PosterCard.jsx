import React, { useEffect, useRef, useState } from 'react';
import { Copy, ImageIcon, MoreVertical, PenLine, Trash2 } from 'lucide-react';
import { timeAgo } from '../utils/timeAgo';

const STATUS_STYLES = {
  draft: 'bg-section text-muted border border-line',
  pending: 'bg-amber-500/10 text-amber-600 border border-amber-500/30',
  approved: 'bg-success/10 text-success border border-success/30',
};

const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Waiting for review',
  approved: 'Approved',
};

export default function PosterCard({
  poster,
  category = '',
  createdByName = '',
  aspectRatio = 0.8,
  busy = false,
  onOpenDetail,
  onOpenInEditor,
  onDuplicate,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const menuRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
    const node = imageRef.current;
    if (node?.complete && node.naturalWidth > 0) setImageReady(true);
  }, [poster.thumbnailUrl]);

  const status = poster.status || 'draft';
  const showImage = poster.thumbnailUrl && !imageFailed;

  const stop = (event) => event.stopPropagation();

  const runAction = (action) => {
    setMenuOpen(false);
    action();
  };

  return (
    <article
      className="card-surface overflow-hidden flex flex-col cursor-pointer group hover:border-primary/50 transition-colors"
      onClick={() => onOpenDetail(poster)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(poster);
        }
      }}
      aria-label={`Open details for ${poster.title || 'poster'}`}
    >
      <div
        className="relative w-full bg-preview overflow-hidden"
        style={{ aspectRatio: String(aspectRatio) }}
      >
        {showImage && (
          <img
            ref={imageRef}
            src={poster.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              imageReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        {(!showImage || !imageReady) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 animate-pulse bg-section/60" aria-hidden="true" />
            <ImageIcon className="relative w-8 h-8 text-muted/60" aria-hidden="true" />
          </div>
        )}

        <span
          className={`absolute top-3 left-3 rounded-chip px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}
        >
          {STATUS_LABELS[status] || STATUS_LABELS.draft}
        </span>

        <div ref={menuRef} className="absolute top-2 right-2" onClick={stop}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="w-8 h-8 rounded-chip bg-canvas/90 border border-line flex items-center justify-center text-body hover:text-heading"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Poster actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-44 rounded-card border border-line bg-canvas shadow-soft py-1 z-10"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(() => onOpenInEditor(poster))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-body hover:bg-section hover:text-heading"
              >
                <PenLine className="w-4 h-4 shrink-0" /> Open
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => runAction(() => onDuplicate(poster))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-body hover:bg-section hover:text-heading disabled:opacity-50"
              >
                <Copy className="w-4 h-4 shrink-0" /> Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => runAction(() => onDelete(poster))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 shrink-0" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-heading leading-snug line-clamp-2">
          {poster.title || 'Untitled poster'}
        </h2>
        {category && <p className="text-xs text-muted">{category}</p>}
        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <p className="text-xs text-muted flex items-center gap-1">
            {busy && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            <span>Updated {timeAgo(poster.updatedAt || poster.createdAt)}</span>
          </p>
          {createdByName && (
            <p className="text-[11px] text-muted truncate max-w-[45%]" title={createdByName}>
              Created by {createdByName}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function PosterCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="w-full bg-preview animate-pulse" style={{ aspectRatio: '0.8' }} />
      <div className="p-4 space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-section animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-section animate-pulse" />
      </div>
    </div>
  );
}
