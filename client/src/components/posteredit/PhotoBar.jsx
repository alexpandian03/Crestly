import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Replace, Upload, X } from 'lucide-react';
import { ACCEPTED_TYPES, MAX_INPUT_BYTES, formatBytes } from '../../utils/brandImage.js';

/* ------------------------------------------------------------------ *
 * The small bar over the poster's picture.
 *
 * Four things only: use another picture the poster already has, put one of your own
 * in (it is shrunk in the browser and sent straight to the photo store), take the
 * picture out, or show the whole picture instead of filling the space.
 * ------------------------------------------------------------------ */

const FIT_LABELS = { cover: 'Fills the space', contain: 'Shows the whole photo' };

export default function PhotoBar({
  currentUrl,
  alternatives = [],
  fit = 'cover',
  busy = false,
  progress = null,
  error = '',
  canUpload = true,
  maxBytes = MAX_INPUT_BYTES,
  uploadNotice = '',
  label = 'Poster photo',
  onPick,
  onUpload,
  onRemove,
  onFit,
}) {
  const fileRef = useRef(null);
  const [menu, setMenu] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const away = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setMenu(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menu]);

  const pick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload?.(file);
  };

  const button =
    'flex items-center gap-1.5 rounded-chip border border-line bg-canvas px-2 py-1 text-[11px] font-semibold text-heading hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-1 rounded-card border border-line bg-canvas/95 p-1.5 shadow-soft"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative">
        <button
          type="button"
          className={button}
          disabled={busy}
          aria-expanded={menu}
          aria-haspopup="menu"
          onClick={() => setMenu((open) => !open)}
          title={alternatives.length ? 'Use a picture this poster already has' : 'No other picture to use yet'}
        >
          <Replace className="h-3.5 w-3.5" />
          Replace
        </button>
        {menu ? (
          <div
            role="menu"
            aria-label="Pictures to choose from"
            className="absolute left-0 top-full z-10 mt-1 w-52 rounded-card border border-line bg-canvas p-1 shadow-soft"
          >
            {alternatives.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted">
                {canUpload
                  ? 'No other picture is ready for this poster yet. Use Upload to add one.'
                  : 'No other picture is ready for this poster yet.'}
              </p>
            ) : (
              alternatives.map((option) => (
                <button
                  key={option.url}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onPick?.(option.url);
                  }}
                  className="flex w-full items-center gap-2 rounded-chip px-2 py-1.5 text-left text-[11px] font-semibold text-heading hover:bg-section"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-chip border border-line bg-preview">
                    <img src={option.url} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {canUpload ? (
        <button type="button" className={button} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      ) : null}

      {canUpload ? null : uploadNotice ? (
        <p className="px-1 text-[11px] leading-snug text-body">{uploadNotice}</p>
      ) : null}

      <button
        type="button"
        className={button}
        disabled={busy || !currentUrl}
        onClick={onRemove}
        title="Take the picture out of this poster"
      >
        <X className="h-3.5 w-3.5" />
        Remove
      </button>

      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => onFit?.(fit === 'contain' ? 'cover' : 'contain')}
        title="Choose how the picture sits in its space"
      >
        <ImageIcon className="h-3.5 w-3.5" />
        Fit: {fit === 'contain' ? 'whole' : 'fill'}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={pick}
        aria-label="Choose a picture from this device"
      />

      {busy || error ? (
        <p className="w-full px-1 text-[11px] leading-snug text-body" role="status">
          {error || `Sending your picture… ${progress == null ? '' : `${progress}%`}`}
        </p>
      ) : null}

      <p className="w-full px-1 text-[10px] text-muted">
        JPG, PNG or WebP up to {formatBytes(maxBytes)}. Fit option: {FIT_LABELS[fit]}.
      </p>
    </div>
  );
}
